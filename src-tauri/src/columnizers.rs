//! Columnizers equivalentes a los de LogExpert que no cubre el parser `auto`.
//!
//! Cada uno se detecta al abrir el fichero y también puede forzarse desde el
//! selector: `json`, `clf`, `squarebracket`, `log4jxml`, `glassfish`,
//! `websphere`.

use std::sync::Arc;

use chrono::TimeZone;
use regex::Regex;

use crate::model::Level;
use crate::parser::{level_of, parse_timestamp, push_field, set_message, LogParser, ParsedLine};

/// Extrae `nombre="valor"` de una etiqueta XML/atributos.
fn attribute(text: &str, name: &str) -> Option<String> {
    let needle = format!("{name}=\"");
    let start = text.find(&needle)? + needle.len();
    let rest = &text[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

// ------------------------------------------------------------------- JSON

/// Una línea JSON por entrada (`JsonColumnizer` / `JsonCompactColumnizer`).
pub struct JsonParser {
    fields: Vec<String>,
}

impl JsonParser {
    pub fn new() -> Arc<dyn LogParser> {
        Arc::new(JsonParser {
            fields: vec![
                "Logger".to_string(),
                "Extra".to_string(),
                "Message".to_string(),
            ],
        })
    }
}

impl LogParser for JsonParser {
    fn name(&self) -> &'static str {
        "json"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();
        let trimmed = line.trim();

        let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) else {
            set_message(&mut parsed, trimmed.to_string());
            return parsed;
        };
        let Some(object) = value.as_object() else {
            set_message(&mut parsed, trimmed.to_string());
            return parsed;
        };

        let mut logger: Option<String> = None;
        let mut mensaje: Option<String> = None;
        let mut extra: Vec<String> = Vec::new();

        for (key, value) in object {
            let name = key.to_ascii_lowercase();
            let text = match value {
                serde_json::Value::String(text) => text.clone(),
                other => other.to_string(),
            };

            match name.as_str() {
                "timestamp" | "time" | "ts" | "@timestamp" | "datetime" | "date" => {
                    let parsed_ts = parse_timestamp(&text).or_else(|| {
                        text.parse::<i64>().ok().map(|value| {
                            if text.len() >= 13 {
                                value
                            } else {
                                value * 1000
                            }
                        })
                    });
                    match parsed_ts {
                        Some(ts) => parsed.ts_ms = Some(ts),
                        None => extra.push(format!("{key}={text}")),
                    }
                }
                "level" | "severity" | "loglevel" | "lvl" | "levelname" => {
                    parsed.level = level_of(&text).unwrap_or(Level::Unknown);
                    if parsed.level == Level::Unknown {
                        extra.push(format!("{key}={text}"));
                    }
                }
                "message" | "msg" | "text" | "event" => mensaje = Some(text),
                "logger" | "logger_name" | "service" | "name" | "component" | "category"
                | "source" => logger = Some(text),
                _ => extra.push(format!("{key}={text}")),
            }
        }

        if let Some(logger) = logger {
            if !logger.is_empty() {
                push_field(&mut parsed, "Logger", &logger);
            }
        }
        if !extra.is_empty() {
            push_field(&mut parsed, "Extra", &extra.join(" "));
        }
        set_message(&mut parsed, mensaje.unwrap_or_else(|| trimmed.to_string()));
        parsed
    }
}

pub fn looks_like_json(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.starts_with('{') && trimmed.ends_with('}') && trimmed.contains('"')
}

// -------------------------------------------------------------------- CLF

/// Formato común de Apache y Nginx (`ClfColumnizer`), con o sin referer y
/// user-agent.
pub struct ClfParser {
    regex: Regex,
    fields: Vec<String>,
}

impl ClfParser {
    pub fn new() -> Arc<dyn LogParser> {
        let regex = Regex::new(
            r#"^(\S+) (\S+) (\S+) \[([^\]]+)\] "([^"]*)" (\S+) (\S+)(?: "([^"]*)" "([^"]*)")?"#,
        )
        .expect("expresión CLF válida");
        Arc::new(ClfParser {
            regex,
            fields: vec![
                "Host".to_string(),
                "Request".to_string(),
                "Status".to_string(),
                "Extra".to_string(),
            ],
        })
    }
}

impl LogParser for ClfParser {
    fn name(&self) -> &'static str {
        "clf"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();
        let trimmed = line.trim();

        let Some(caps) = self.regex.captures(trimmed) else {
            set_message(&mut parsed, trimmed.to_string());
            return parsed;
        };
        let group = |index: usize| caps.get(index).map(|m| m.as_str()).unwrap_or("");

        // `10/Oct/2000:13:55:36 -0700`
        if let Ok(datetime) = chrono::DateTime::parse_from_str(group(4), "%d/%b/%Y:%H:%M:%S %z") {
            // Hora de pared tal como está escrita: el desfase del `%z` no se
            // aplica aquí, que para ordenar ya está `EntryTable::instant_at`.
            parsed.ts_ms = Some(datetime.naive_local().and_utc().timestamp_millis());
        }

        push_field(&mut parsed, "Host", group(1));
        push_field(&mut parsed, "Request", group(5));
        push_field(&mut parsed, "Status", group(6));

        let mut extra = format!("bytes={}", group(7));
        let referer = group(8);
        if !referer.is_empty() {
            extra.push_str(&format!(" referer={referer}"));
        }
        let agent = group(9);
        if !agent.is_empty() {
            extra.push_str(&format!(" ua=\"{agent}\""));
        }
        push_field(&mut parsed, "Extra", &extra);

        set_message(&mut parsed, format!("{} {}", group(6), group(5)));
        parsed
    }
}

pub fn looks_like_clf(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.contains(" [")
        && trimmed.contains("] \"")
        && (trimmed.contains(" HTTP/") || trimmed.contains("\"GET ") || trimmed.contains("\"POST "))
}

// -------------------------------------------------------- corchetes anidados

/// `[fecha] [hora] [nivel] [origen] mensaje` (`SquareBracketColumnizer`).
pub struct SquareBracketParser {
    fields: Vec<String>,
}

impl SquareBracketParser {
    pub fn new() -> Arc<dyn LogParser> {
        Arc::new(SquareBracketParser {
            fields: vec![
                "Source".to_string(),
                "Extra".to_string(),
                "Message".to_string(),
            ],
        })
    }
}

impl LogParser for SquareBracketParser {
    fn name(&self) -> &'static str {
        "squarebracket"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();
        let mut rest = line.trim_start();
        let mut fecha: Option<String> = None;
        let mut hora: Option<String> = None;
        let mut completo: Option<i64> = None;
        let mut fuentes: Vec<String> = Vec::new();

        while rest.starts_with('[') {
            let Some(close) = rest[1..].find(']') else {
                break;
            };
            let group = rest[1..close + 1].trim().to_string();
            rest = rest[close + 2..].trim_start();

            if let Some(level) = level_of(&group) {
                parsed.level = level;
                continue;
            }

            let tiene_fecha = group.contains('-') || group.contains('/');
            let tiene_hora = group.contains(':');
            if tiene_fecha && tiene_hora {
                if completo.is_none() {
                    completo = parse_timestamp(&group);
                }
            } else if tiene_fecha && fecha.is_none() {
                fecha = Some(group);
            } else if tiene_hora && hora.is_none() {
                hora = Some(group);
            } else {
                fuentes.push(group);
            }
        }

        // Fecha y hora en corchetes separados se juntan para tener un instante
        // completo; si no, vale cualquiera de los dos por separado.
        parsed.ts_ms = completo
            .or_else(|| match (&fecha, &hora) {
                (Some(fecha), Some(hora)) => parse_timestamp(&format!("{fecha} {hora}")),
                (Some(fecha), None) => parse_timestamp(fecha),
                (None, Some(hora)) => parse_timestamp(hora),
                (None, None) => None,
            });

        if let Some(first) = fuentes.first() {
            push_field(&mut parsed, "Source", first);
        }
        if fuentes.len() > 1 {
            push_field(&mut parsed, "Extra", &fuentes[1..].join(" "));
        }
        set_message(&mut parsed, rest.to_string());
        parsed
    }
}

/// Varios grupos entre corchetes con la fecha separada de la hora.
pub fn looks_like_square_bracket(line: &str) -> bool {
    let trimmed = line.trim_start();
    if !trimmed.starts_with('[') {
        return false;
    }
    let mut groups: Vec<&str> = Vec::new();
    let mut rest = trimmed;
    while rest.starts_with('[') {
        let Some(close) = rest[1..].find(']') else {
            break;
        };
        groups.push(rest[1..close + 1].trim());
        rest = rest[close + 2..].trim_start();
        if groups.len() > 5 {
            break;
        }
    }
    if groups.len() < 2 {
        return false;
    }
    // Este parser cubre lo que `auto` no puede: fecha sin hora + hora sin fecha.
    let primera_es_fecha = !groups[0].contains(':')
        && (groups[0].contains('-') || groups[0].contains('/'));
    let segunda_es_hora = groups[1].contains(':')
        && !groups[1].contains('-')
        && !groups[1].contains('/');
    primera_es_fecha && segunda_es_hora
}

// --------------------------------------------------------------- Log4j XML

/// Eventos `<log4j:event>` de varias líneas (`Log4jXmlColumnizer`).
pub struct Log4jXmlParser {
    fields: Vec<String>,
}

impl Log4jXmlParser {
    pub fn new() -> Arc<dyn LogParser> {
        Arc::new(Log4jXmlParser {
            fields: vec![
                "Thread".to_string(),
                "Logger".to_string(),
                "Message".to_string(),
            ],
        })
    }
}

impl LogParser for Log4jXmlParser {
    fn name(&self) -> &'static str {
        "log4jxml"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn starts_entry(&self, line: &str) -> bool {
        line.contains("<log4j:event")
    }

    fn parse(&self, text: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();

        if let Some(timestamp) = attribute(text, "timestamp") {
            parsed.ts_ms = timestamp
                .parse::<i64>()
                .ok()
                .map(|value| if timestamp.len() >= 13 { value } else { value * 1000 });
        }
        if let Some(level) = attribute(text, "level") {
            parsed.level = level_of(&level).unwrap_or(Level::Unknown);
        }
        if let Some(logger) = attribute(text, "logger") {
            push_field(&mut parsed, "Logger", &logger);
        }
        if let Some(thread) = attribute(text, "thread") {
            push_field(&mut parsed, "Thread", &thread);
        }

        let mut mensaje = extract_tag(text, "log4j:message")
            .or_else(|| extract_tag(text, "log4j:throwable"))
            .unwrap_or_default();
        if let Some(start) = mensaje.find("<![CDATA[") {
            let inner = &mensaje[start + 9..];
            if let Some(end) = inner.find("]]>") {
                mensaje = inner[..end].to_string();
            }
        }

        if mensaje.is_empty() {
            mensaje = "evento log4j sin mensaje".to_string();
        }
        set_message(&mut parsed, mensaje);
        parsed
    }
}

fn extract_tag(text: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = text.find(&open)? + open.len();
    let end = text[start..].find(&close)?;
    Some(text[start..start + end].trim().to_string())
}

pub fn looks_like_log4jxml(line: &str) -> bool {
    line.contains("<log4j:event")
}

// --------------------------------------------------------------- Glassfish

/// `[#|instante|NIVEL|versión|componente|hilo|mensaje|#]` (`GlassfishColumnizer`).
pub struct GlassfishParser {
    fields: Vec<String>,
}

impl GlassfishParser {
    pub fn new() -> Arc<dyn LogParser> {
        Arc::new(GlassfishParser {
            fields: vec![
                "Logger".to_string(),
                "Thread".to_string(),
                "Extra".to_string(),
                "Message".to_string(),
            ],
        })
    }
}

impl LogParser for GlassfishParser {
    fn name(&self) -> &'static str {
        "glassfish"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();
        let trimmed = line.trim();
        let inner = trimmed
            .strip_prefix("[#|")
            .unwrap_or(trimmed)
            .strip_suffix("|#]")
            .unwrap_or_else(|| trimmed.strip_prefix("[#|").unwrap_or(trimmed));
        let parts: Vec<&str> = inner.split('|').collect();

        if let Some(raw) = parts.first() {
            // `yyyy-MM-ddTHH:mm:ss.fff+0200`
            if let Ok(datetime) = chrono::DateTime::parse_from_str(raw.trim(), "%Y-%m-%dT%H:%M:%S%.f%z")
            {
                // Hora de pared: el desfase explícito se usa solo para ordenar.
                parsed.ts_ms = Some(datetime.naive_local().and_utc().timestamp_millis());
            } else {
                parsed.ts_ms = parse_timestamp(raw.trim());
            }
        }
        if let Some(level) = parts.get(1) {
            parsed.level = level_of(level).unwrap_or(Level::Unknown);
        }
        if let Some(version) = parts.get(2) {
            if !version.trim().is_empty() {
                push_field(&mut parsed, "Extra", &format!("version={}", version.trim()));
            }
        }
        if let Some(component) = parts.get(3) {
            push_field(&mut parsed, "Logger", component.trim());
        }
        if let Some(thread_info) = parts.get(4) {
            let thread = thread_info
                .split(';')
                .find_map(|part| part.trim().strip_prefix("_ThreadName="))
                .or_else(|| {
                    thread_info
                        .split(';')
                        .find_map(|part| part.trim().strip_prefix("_ThreadID="))
                })
                .unwrap_or_else(|| thread_info.trim());
            if !thread.is_empty() {
                push_field(&mut parsed, "Thread", thread);
            }
        }
        let mensaje = if parts.len() > 5 {
            parts[5..].join("|").trim().to_string()
        } else {
            String::new()
        };
        set_message(&mut parsed, mensaje);
        parsed
    }
}

pub fn looks_like_glassfish(line: &str) -> bool {
    line.trim_start().starts_with("[#|")
}

// --------------------------------------------------------------- WebSphere

/// `[dd/MM/yy HH:mm:ss:SSS ZONA] hilo componente N mensaje` (`WebsphereColumnizer`).
pub struct WebsphereParser {
    fields: Vec<String>,
}

impl WebsphereParser {
    pub fn new() -> Arc<dyn LogParser> {
        Arc::new(WebsphereParser {
            fields: vec![
                "Thread".to_string(),
                "Logger".to_string(),
                "Message".to_string(),
            ],
        })
    }
}

/// Convierte `22/10/26 13:55:36:123 CEST` en algo que chrono entienda.
fn websphere_timestamp(raw: &str) -> Option<i64> {
    let mut parts = raw.split_whitespace();
    // La fecha y la hora son dos tokens; la zona horaria se descarta.
    let fecha = parts.next()?;
    let hora = parts.next()?;
    let mut texto = format!("{fecha} {hora}");

    // Los milisegundos van tras ':' en lugar de tras '.'.
    if let Some(last_colon) = texto.rfind(':') {
        let tail = &texto[last_colon + 1..];
        if tail.len() == 3 && tail.chars().all(|c| c.is_ascii_digit()) {
            texto.replace_range(last_colon..last_colon + 1, ".");
        }
    }

    // Hora de pared, sin desfase: el instante para ordenar lo calcula
    // `EntryTable::instant_at` con la zona del fichero.
    chrono::NaiveDateTime::parse_from_str(&texto, "%y/%m/%d %H:%M:%S%.f")
        .ok()
        .map(|naive| naive.and_utc().timestamp_millis())
}

fn websphere_level(token: &str) -> Option<Level> {
    match token {
        "I" => Some(Level::Info),
        "W" => Some(Level::Warn),
        "E" => Some(Level::Error),
        "D" | "F" => Some(Level::Debug),
        "A" => Some(Level::Fatal),
        _ => None,
    }
}

impl LogParser for WebsphereParser {
    fn name(&self) -> &'static str {
        "websphere"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();
        let trimmed = line.trim();

        if !trimmed.starts_with('[') {
            set_message(&mut parsed, trimmed.to_string());
            return parsed;
        }
        let Some(close) = trimmed.find(']') else {
            set_message(&mut parsed, trimmed.to_string());
            return parsed;
        };
        let inner = &trimmed[1..close];
        let mut rest = trimmed[close + 1..].trim_start();

        parsed.ts_ms = websphere_timestamp(inner).or_else(|| parse_timestamp(inner));

        let mut tokens = rest.split_whitespace();
        if let Some(thread) = tokens.next() {
            push_field(&mut parsed, "Thread", thread);
        }
        if let Some(component) = tokens.next() {
            push_field(&mut parsed, "Logger", component);
        }
        if let Some(token) = tokens.next() {
            if let Some(level) = websphere_level(token) {
                parsed.level = level;
            }
        }
        // El mensaje empieza tras hilo, componente y letra de nivel.
        for _ in 0..3 {
            if let Some(index) = rest.find(char::is_whitespace) {
                rest = rest[index..].trim_start();
            } else {
                rest = "";
                break;
            }
        }
        set_message(&mut parsed, rest.to_string());
        parsed
    }
}

pub fn looks_like_websphere(line: &str) -> bool {
    let trimmed = line.trim_start();
    if !trimmed.starts_with('[') {
        return false;
    }
    let Some(close) = trimmed.find(']') else {
        return false;
    };
    let inner = &trimmed[1..close];
    // `dd/MM/yy HH:mm:ss:SSS ZONA`
    inner.len() >= 18 && inner.contains('/') && inner.matches(':').count() >= 3
}

#[cfg(test)]
mod tests {
    use super::*;

    fn campo<'a>(parsed: &'a ParsedLine, name: &str) -> Option<&'a str> {
        parsed
            .fields
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, v)| v.as_str())
    }

    #[test]
    fn json_log4j2() {
        let line = r#"{"@timestamp":"2026-10-23T01:23:49.683Z","level":"ERROR","logger_name":"app.db","message":"conexión perdida","run":42}"#;
        assert!(looks_like_json(line));
        let parsed = JsonParser::new().parse(line);
        assert!(parsed.ts_ms.is_some());
        assert_eq!(parsed.level, Level::Error);
        assert_eq!(campo(&parsed, "Logger"), Some("app.db"));
        assert_eq!(campo(&parsed, "Message"), Some("conexión perdida"));
        assert!(campo(&parsed, "Extra").unwrap_or("").contains("run=42"));
    }

    #[test]
    fn clf_apache_combined() {
        let line = r#"127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://www.example.com/start.html" "Mozilla/4.08 [en] (Win98; I ;Nav)""#;
        assert!(looks_like_clf(line));
        let parsed = ClfParser::new().parse(line);
        assert!(parsed.ts_ms.is_some(), "instante del formato CLF");
        assert_eq!(campo(&parsed, "Host"), Some("127.0.0.1"));
        assert_eq!(campo(&parsed, "Status"), Some("200"));
        assert!(campo(&parsed, "Request").unwrap_or("").contains("/apache_pb.gif"));
        assert!(campo(&parsed, "Extra").unwrap_or("").contains("bytes=2326"));
    }

    #[test]
    fn corchetes_con_fecha_y_hora_separadas() {
        let line = "[2026-02-09] [10:39:38] [INFO] [servidor] arrancado en el puerto 1234";
        assert!(looks_like_square_bracket(line));
        let parsed = SquareBracketParser::new().parse(line);
        assert!(parsed.ts_ms.is_some(), "fecha y hora se juntan");
        assert_eq!(parsed.level, Level::Info);
        assert_eq!(campo(&parsed, "Source"), Some("servidor"));
        assert_eq!(campo(&parsed, "Message"), Some("arrancado en el puerto 1234"));
    }

    #[test]
    fn log4jxml_evento_multilinea() {
        let text = concat!(
            "<log4j:event logger=\"com.foo.Bar\" timestamp=\"1166025112806\" level=\"DEBUG\" thread=\"main\">\n",
            "<log4j:message><![CDATA[mensaje útil]]></log4j:message>\n",
            "</log4j:event>"
        );
        let parser = Log4jXmlParser::new();
        assert!(parser.starts_entry("<log4j:event logger=\"x\">"));
        let parsed = parser.parse(text);
        assert_eq!(parsed.ts_ms, Some(1_166_025_112_806));
        assert_eq!(parsed.level, Level::Debug);
        assert_eq!(campo(&parsed, "Logger"), Some("com.foo.Bar"));
        assert_eq!(campo(&parsed, "Thread"), Some("main"));
        assert_eq!(campo(&parsed, "Message"), Some("mensaje útil"));
    }

    #[test]
    fn glassfish_completo() {
        let line = "[#|2026-10-22T13:55:36.123+0200|INFO|glassfish 7|javax.enterprise|_ThreadID=20;_ThreadName=Thread-2;|arrancado|#]";
        assert!(looks_like_glassfish(line));
        let parsed = GlassfishParser::new().parse(line);
        assert!(parsed.ts_ms.is_some());
        assert_eq!(parsed.level, Level::Info);
        assert_eq!(campo(&parsed, "Logger"), Some("javax.enterprise"));
        assert_eq!(campo(&parsed, "Thread"), Some("Thread-2"));
        assert_eq!(campo(&parsed, "Message"), Some("arrancado"));
    }

    #[test]
    fn websphere_completo() {
        let line = "[22/10/26 13:55:36:123 CEST] 00000001 Application   I   servicio iniciado";
        assert!(looks_like_websphere(line));
        let parsed = WebsphereParser::new().parse(line);
        assert!(parsed.ts_ms.is_some(), "milisegundos con dos puntos");
        assert_eq!(parsed.level, Level::Info);
        assert_eq!(campo(&parsed, "Thread"), Some("00000001"));
        assert_eq!(campo(&parsed, "Logger"), Some("Application"));
        assert_eq!(campo(&parsed, "Message"), Some("servicio iniciado"));
    }

    #[test]
    fn los_detectores_no_se_pisan() {
        let lmstudio = "[2026-02-09 10:39:38][INFO][LM STUDIO SERVER] Success!";
        assert!(!looks_like_websphere(lmstudio));
        // LM Studio lleva fecha y hora en un solo corchete: no es squarebracket
        // con fecha y hora separadas, aunque sí tenga varios grupos.
        let grupos_separados = "[2026-02-09] [10:39:38] [INFO] x";
        assert!(looks_like_square_bracket(grupos_separados));

        let cbs = "2026-10-15 22:45:21, Info  CBS  TI: x";
        assert!(!looks_like_clf(cbs));
        assert!(!looks_like_json(cbs));
        assert!(!looks_like_glassfish(cbs));
    }
}
