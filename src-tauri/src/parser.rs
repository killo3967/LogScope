use std::sync::Arc;

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use chrono::{Datelike, DateTime, Local, NaiveDate, NaiveDateTime, NaiveTime};
use regex::Regex;

use crate::model::Level;

pub const NO_TS: i64 = i64::MIN;

#[derive(Debug, Clone, Default)]
pub struct ParsedLine {
    pub ts_ms: Option<i64>,
    pub level: Level,
    pub fields: Vec<(String, String)>,
}

pub trait LogParser: Send + Sync {
    fn name(&self) -> &'static str;
    fn field_names(&self) -> &[String];
    fn parse(&self, text: &str) -> ParsedLine;

    /// ¿Esta línea empieza una entrada nueva? Los formatos de varias líneas
    /// devuelven `false` en las líneas de continuación.
    fn starts_entry(&self, _line: &str) -> bool {
        true
    }

    /// Interpreta una línea suelta sabiendo qué posición ocupa dentro de la
    /// entrada. Es imprescindible cuando el mapeo es por posición: la tercera
    /// línea de una entrada no se interpreta igual que la primera.
    fn parse_line_at(&self, line: &str, _index: usize) -> ParsedLine {
        self.parse(line)
    }
}

// ---------------------------------------------------------------- utilidades

/// Formatos dominantes en logs de servidor: se prueban primero y suelen
/// acertar al primer intento.
const FAST_FORMATS: &[&str] = &["%Y-%m-%d %H:%M:%S%.f", "%Y-%m-%d %H:%M:%S"];
const OTHER_FORMATS: &[&str] = &[
    "%Y-%m-%dT%H:%M:%S%.f",
    "%d/%m/%Y %H:%M:%S%.f",
    "%d/%m/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M:%S",
    "%d-%b-%Y %H:%M:%S",
    "%d.%m.%Y %H:%M:%S",
];

/// Desfase local en segundos, cacheado por día.
///
/// Consultar la zona horaria en cada línea cuesta más que parsear la fecha,
/// así que se resuelve una vez por fecha: correcto también cuando el log
/// cruza un cambio de hora, y sin el coste por línea.
fn local_offset_seconds(date: NaiveDate) -> i32 {
    use chrono::TimeZone;

    static CACHE: OnceLock<Mutex<HashMap<i64, i32>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let key = date.num_days_from_ce() as i64;

    if let Ok(map) = cache.lock() {
        if let Some(offset) = map.get(&key) {
            return *offset;
        }
    }

    let offset = date
        .and_hms_opt(12, 0, 0)
        .and_then(|naive| Local.from_local_datetime(&naive).single())
        .map(|dt| dt.offset().local_minus_utc())
        .unwrap_or(0);

    if let Ok(mut map) = cache.lock() {
        map.insert(key, offset);
    }
    offset
}

fn to_ms(naive: NaiveDateTime) -> Option<i64> {
    let offset = local_offset_seconds(naive.date()) as i64;
    Some(naive.and_utc().timestamp_millis() + offset * 1000)
}

/// Reconoce un instante al principio de la línea en los formatos más comunes.
pub fn parse_timestamp(raw: &str) -> Option<i64> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    // log4net y otros escriben los milisegundos con coma decimal.
    let normalized;
    let s = if trimmed.contains(',') {
        normalized = trimmed.replacen(',', ".", 1);
        normalized.as_str()
    } else {
        trimmed
    };
    // Atajo: un instante empieza por dígito, o por letra si el mes va delante.
    let first = s.as_bytes()[0];
    if !first.is_ascii_digit() && !first.is_ascii_alphabetic() {
        return None;
    }

    for fmt in FAST_FORMATS {
        if let Ok(naive) = NaiveDateTime::parse_from_str(s, fmt) {
            return to_ms(naive);
        }
    }
    if s.len() >= 20 && s.as_bytes()[10] == b'T' {
        if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
            return Some(dt.timestamp_millis());
        }
    }
    for fmt in OTHER_FORMATS {
        if let Ok(naive) = NaiveDateTime::parse_from_str(s, fmt) {
            return to_ms(naive);
        }
    }
    // Hora suelta, sin fecha.
    if s.len() <= 15 && !s.contains('-') && !s.contains('/') {
        if let Ok(time) = NaiveTime::parse_from_str(s, "%H:%M:%S%.f") {
            let today = Local::now().date_naive();
            return to_ms(today.and_time(time));
        }
    }
    // epoch: 10 dígitos = segundos, 13 = milisegundos
    if (s.len() == 10 || s.len() == 13) && s.bytes().all(|b| b.is_ascii_digit()) {
        if let Ok(v) = s.parse::<i64>() {
            return if s.len() == 10 { Some(v * 1000) } else { Some(v) };
        }
    }
    None
}

/// Nivel a partir de un token suelto (`ERROR`, `[warn]`, `<3>`, ...).
/// Sin asignar memoria: compara sin distinguir mayúsculas.
pub fn level_of(token: &str) -> Option<Level> {
    const TABLE: &[(&str, Level)] = &[
        ("TRACE", Level::Trace),
        ("TRC", Level::Trace),
        ("VRB", Level::Trace),
        ("VERBOSE", Level::Trace),
        ("DEBUG", Level::Debug),
        ("DBG", Level::Debug),
        ("INFO", Level::Info),
        ("INF", Level::Info),
        ("INFORMATION", Level::Info),
        ("NOTICE", Level::Info),
        ("WARN", Level::Warn),
        ("WRN", Level::Warn),
        ("WARNING", Level::Warn),
        ("ERROR", Level::Error),
        ("ERR", Level::Error),
        ("SEVERE", Level::Error),
        ("FATAL", Level::Fatal),
        ("CRIT", Level::Fatal),
        ("CRITICAL", Level::Fatal),
        ("PANIC", Level::Fatal),
        ("EMERG", Level::Fatal),
        ("ALERT", Level::Fatal),
    ];

    let token = token.trim_matches(|c: char| !c.is_alphanumeric());
    if token.is_empty() {
        return None;
    }
    TABLE
        .iter()
        .find(|(name, _)| token.eq_ignore_ascii_case(name))
        .map(|(_, level)| *level)
}

fn first_token(s: &str) -> Option<(&str, &str)> {
    let s = s.trim_start();
    if s.is_empty() {
        return None;
    }
    match s.find(' ') {
        Some(i) => Some((&s[..i], s[i..].trim_start())),
        None => Some((s, "")),
    }
}

/// Busca un instante en cualquier punto del principio de la línea, no solo al
/// principio: hay formatos que ponen el nivel delante (`INFO  2026-06-06T…`)
/// o que lo encierran entre corchetes (`[2026-02-09 10:39:38]`).
///
/// Devuelve `(inicio, fin, epoch_ms)`.
pub fn find_timestamp(line: &str) -> Option<(usize, usize, i64)> {
    // Posiciones donde puede empezar el instante: el inicio y tras los dos
    // primeros huecos (para admitir `INFO  <instante>`).
    let mut starts: Vec<usize> = vec![0];
    let mut huecos = 0;
    for (i, c) in line.char_indices() {
        if i > 40 || huecos >= 2 {
            break;
        }
        if c.is_whitespace() && i + c.len_utf8() < line.len() {
            starts.push(i + c.len_utf8());
            huecos += 1;
        }
    }

    for start in starts {
        if let Some(found) = scan_timestamp_from(line, start) {
            return Some(found);
        }
    }
    None
}

fn scan_timestamp_from(line: &str, start: usize) -> Option<(usize, usize, i64)> {
    let mut begin = start;
    let mut cands: Vec<usize> = Vec::new();
    let mut espacios = 0;

    for (i, c) in line.char_indices() {
        if i < begin {
            continue;
        }
        if i > start + 96 {
            break;
        }
        // Ruido delante del instante: BOM, corchetes y espacios.
        if i == begin && (c == '[' || c == '\u{feff}' || c == '(' || c.is_whitespace()) {
            begin = i + c.len_utf8();
            continue;
        }
        match c {
            '0'..='9' | '-' | ':' | '.' | ',' | '/' | 'T' => cands.push(i + c.len_utf8()),
            // Un solo espacio dentro del instante: separa fecha y hora.
            ' ' if espacios == 0 && !cands.is_empty() => espacios += 1,
            _ => break,
        }
    }

    for &end in cands.iter().rev() {
        if end <= begin {
            continue;
        }
        let candidate = line[begin..end].trim_end_matches([' ', ',']);
        if let Some(ts) = parse_timestamp(candidate) {
            let mut fin = begin + candidate.len();
            // Cerrar el corchete forma parte del prefijo del instante.
            if line[fin..].starts_with(']') {
                fin += 1;
            }
            return Some((begin, fin, ts));
        }
    }
    None
}

/// ¿La línea empieza por un instante? Es lo que delimita entradas nuevas.
fn timestamp_prefix_end(line: &str) -> Option<usize> {
    find_timestamp(line)
        .filter(|(start, _, _)| {
            line[..*start]
                .trim_matches(|c: char| {
                    c.is_whitespace() || c == '\u{feff}' || c == '[' || c == '('
                })
                .is_empty()
        })
        .map(|(_, end, _)| end)
}

// ------------------------------------------------------------------ parsers

/// Formato libre: instante + nivel + mensaje, sin configuración.
pub struct BasicParser {
    fields: Vec<String>,
}

impl BasicParser {
    pub fn new() -> Arc<dyn LogParser> {
        Arc::new(BasicParser {
            fields: vec!["Thread".to_string(), "Message".to_string()],
        })
    }
}

impl LogParser for BasicParser {
    fn name(&self) -> &'static str {
        "basic"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        basic_header(line)
    }
}

/// ¿La línea parece `clave=valor` estructurado (logfmt)?
pub fn looks_like_logfmt(line: &str) -> bool {
    let tiene_instante = line.contains("timestamp=")
        || line.contains("time=")
        || line.contains("ts=")
        || line.contains("@timestamp=");
    let tiene_nivel = line.contains("level=")
        || line.contains("severity=")
        || line.contains("lvl=")
        || line.contains("loglevel=");
    tiene_instante && tiene_nivel
}

/// Parte una línea logfmt en pares clave/valor, respetando comillas.
pub fn logfmt_pairs(line: &str) -> Vec<(String, String)> {
    let bytes = line.as_bytes();
    let mut pairs = Vec::new();
    let mut i = 0usize;

    while i < bytes.len() {
        while i < bytes.len() && bytes[i] == b' ' {
            i += 1;
        }
        let key_start = i;
        while i < bytes.len() && bytes[i] != b'=' && bytes[i] != b' ' {
            i += 1;
        }
        if i >= bytes.len() || bytes[i] != b'=' {
            while i < bytes.len() && bytes[i] != b' ' {
                i += 1;
            }
            continue;
        }
        let key = &line[key_start..i];
        if key.is_empty() {
            i += 1;
            continue;
        }
        i += 1; // salta '='

        let mut value = String::new();
        if i < bytes.len() && bytes[i] == b'"' {
            i += 1;
            while i < bytes.len() {
                match bytes[i] {
                    b'\\' if i + 1 < bytes.len() => {
                        value.push(bytes[i + 1] as char);
                        i += 2;
                    }
                    b'"' => {
                        i += 1;
                        break;
                    }
                    _ => {
                        value.push(bytes[i] as char);
                        i += 1;
                    }
                }
            }
        } else {
            let value_start = i;
            while i < bytes.len() && bytes[i] != b' ' {
                i += 1;
            }
            value.push_str(&line[value_start..i]);
        }
        pairs.push((key.to_string(), value));
    }
    pairs
}

/// Logs estructurados `clave=valor` (logfmt), típicos de Go y Node.
pub struct LogfmtParser {
    fields: Vec<String>,
}

impl LogfmtParser {
    pub fn new() -> Arc<dyn LogParser> {
        Arc::new(LogfmtParser {
            fields: vec![
                "Logger".to_string(),
                "Extra".to_string(),
                "Message".to_string(),
            ],
        })
    }
}

impl LogParser for LogfmtParser {
    fn name(&self) -> &'static str {
        "logfmt"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();
        let mut logger: Option<String> = None;
        let mut mensaje: Option<String> = None;
        let mut extra: Vec<String> = Vec::new();

        for (key, value) in logfmt_pairs(line) {
            let name = key.to_ascii_lowercase();
            match name.as_str() {
                "timestamp" | "time" | "ts" | "@timestamp" => {
                    parsed.ts_ms = parse_timestamp(&value);
                }
                "level" | "severity" | "lvl" | "loglevel" => {
                    parsed.level = level_of(&value).unwrap_or(Level::Unknown);
                }
                "message" | "msg" => mensaje = Some(value),
                "logger" | "service" | "name" | "component" | "module" => {
                    logger = Some(value)
                }
                _ => extra.push(format!("{key}={value}")),
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
        let texto = mensaje.unwrap_or_else(|| line.to_string());
        set_message(&mut parsed, texto);
        parsed
    }
}

/// Cabecera común a los parsers de una sola línea: instante (esté donde esté),
/// nivel, hilo `[n]`, etiqueta `[Componente]` o `CBS`, y mensaje.
fn basic_header(line: &str) -> ParsedLine {
    let mut parsed = ParsedLine::default();

    // El instante puede ir precedido de un nivel (opencode) o de corchetes
    // (LM Studio), así que se busca y se separa el prefijo.
    let (prefix, tail) = match find_timestamp(line) {
        Some((start, end, ts)) => {
            parsed.ts_ms = Some(ts);
            (&line[..start], &line[end..])
        }
        None => ("", line),
    };

    let _ = consume_header_tokens(prefix, &mut parsed);

    let tail = tail.trim_start_matches(|c: char| c == ',' || c == ']' || c == ':' || c.is_whitespace());
    let rest = consume_header_tokens(tail, &mut parsed);

    if parsed.level == Level::Unknown {
        if let Some(level) = infer_level_from_text(rest) {
            parsed.level = level;
        }
    }

    set_message(&mut parsed, rest.to_string());
    parsed
}

/// Consume los tokens de cabecera que encuentre al principio y devuelve el
/// resto de la línea.
fn consume_header_tokens<'a>(input: &'a str, parsed: &mut ParsedLine) -> &'a str {
    let mut rest = input.trim_start();

    for _ in 0..4 {
        if rest.is_empty() {
            break;
        }

        // Corchetes, que pueden contener espacios: `[INFO]`, `[12]`,
        // `[LM STUDIO SERVER]`.
        if rest.starts_with('[') {
            if let Some(close) = rest[1..].find(']') {
                let close = close + 1;
                let inner = &rest[1..close];
                if !inner.is_empty() && inner.len() <= 40 {
                    if let Some(level) = level_of(inner) {
                        parsed.level = level;
                    } else if inner.chars().all(|c| c.is_ascii_digit()) {
                        push_field(parsed, "Thread", inner);
                    } else if !has_field(parsed, "Tag") {
                        push_field(parsed, "Tag", inner);
                    }
                    rest = rest[close + 1..]
                        .trim_start_matches(|c: char| c == ':' || c.is_whitespace());
                    continue;
                }
            }
        }

        let Some((token, tail)) = first_token(rest) else {
            break;
        };

        if parsed.level == Level::Unknown {
            if let Some(level) = level_of(token) {
                parsed.level = level;
                rest = tail;
                continue;
            }
        }

        // Fuente en mayúsculas, típica de los logs de Windows: `CBS`.
        if !has_field(parsed, "Tag")
            && token.len() <= 24
            && !token.contains(':')
            && token.chars().any(|c| c.is_ascii_alphabetic())
            && token
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
        {
            push_field(parsed, "Tag", token);
            rest = tail;
            continue;
        }

        break;
    }

    rest
}

/// Busca un nivel dentro del texto sin asignar memoria: compara cada token
/// alfanumérico sin construir ninguna cadena intermedia.
fn infer_level_from_text(text: &str) -> Option<Level> {
    for token in text.split(|c: char| !c.is_alphanumeric()) {
        if token.len() < 3 {
            continue;
        }
        if let Some(level) = level_of(token) {
            return Some(level);
        }
    }
    None
}

/// Regex con grupos con nombre; `ts` y `level` son reservados.
pub struct PatternParser {
    regex: Regex,
    fields: Vec<String>,
}

impl PatternParser {
    pub fn new(pattern: &str) -> Result<Arc<dyn LogParser>, String> {
        let regex = Regex::new(pattern).map_err(|e| format!("regex inválida: {e}"))?;
        if regex.capture_names().flatten().next().is_none() {
            return Err("el patrón necesita al menos un grupo con nombre, p.ej. (?P<Message>.*)".into());
        }
        let fields: Vec<String> = regex
            .capture_names()
            .flatten()
            .filter(|n| *n != "ts" && *n != "level")
            .map(|n| n.to_string())
            .collect();
        Ok(Arc::new(PatternParser { regex, fields }))
    }
}

impl LogParser for PatternParser {
    fn name(&self) -> &'static str {
        "pattern"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();
        let Some(caps) = self.regex.captures(line) else {
            parsed
                .fields
                .push(("Message".to_string(), line.to_string()));
            return parsed;
        };

        if let Some(m) = caps.name("ts") {
            parsed.ts_ms = parse_timestamp(m.as_str());
        }
        if let Some(m) = caps.name("level") {
            parsed.level = level_of(m.as_str()).unwrap_or(Level::Unknown);
        }
        for name in &self.fields {
            if let Some(m) = caps.name(name) {
                parsed
                    .fields
                    .push((name.clone(), m.as_str().to_string()));
            }
        }
        parsed
    }
}

/// Papel de cada columna de un fichero delimitado.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ColumnRole {
    Time,
    Level,
    Thread,
    Logger,
    Message,
}

/// Delimitado: CSV, TSV, pipe o punto y coma. Los papeles de columna se deducen
/// del contenido real de las primeras líneas: la columna cuyos valores son
/// instantes es el tiempo, la que repite niveles es el nivel, y el resto se
/// reparte como logger, hilo y mensaje.
pub struct DsvParser {
    delimiter: char,
    roles: Vec<ColumnRole>,
    fields: Vec<String>,
}

impl DsvParser {
    pub fn with_detection(delimiter: char, sample: &[String]) -> Arc<dyn LogParser> {
        let rows: Vec<Vec<&str>> = sample
            .iter()
            .map(|line| line.split(delimiter).map(|cell| cell.trim()).collect())
            .filter(|row: &Vec<&str>| row.len() > 1)
            .collect();
        let width = rows.iter().map(|row| row.len()).max().unwrap_or(0);

        let ratio = |column: usize, predicate: &dyn Fn(&str) -> bool| -> f64 {
            if rows.is_empty() {
                return 0.0;
            }
            let hits = rows
                .iter()
                .filter(|row| row.get(column).map(|value| predicate(value)).unwrap_or(false))
                .count();
            hits as f64 / rows.len() as f64
        };

        let mut roles = vec![ColumnRole::Message; width];
        for column in 0..width {
            if ratio(column, &|value| parse_timestamp(value).is_some()) >= 0.6 {
                roles[column] = ColumnRole::Time;
            } else if ratio(column, &|value| level_of(value).is_some()) >= 0.6 {
                roles[column] = ColumnRole::Level;
            }
        }

        // Las columnas que quedan, en orden: logger, hilo y el resto mensaje.
        let restantes: Vec<usize> = roles
            .iter()
            .enumerate()
            .filter(|(_, role)| **role == ColumnRole::Message)
            .map(|(index, _)| index)
            .collect();
        if let Some(index) = restantes.first().copied() {
            roles[index] = ColumnRole::Logger;
        }
        if let Some(index) = restantes.get(1).copied() {
            roles[index] = ColumnRole::Thread;
        }

        let mut fields: Vec<String> = Vec::new();
        for role in &roles {
            let name = match role {
                ColumnRole::Logger => Some("Logger"),
                ColumnRole::Thread => Some("Thread"),
                ColumnRole::Message => Some("Message"),
                ColumnRole::Time | ColumnRole::Level => None,
            };
            if let Some(name) = name {
                if !fields.iter().any(|existing| existing == name) {
                    fields.push(name.to_string());
                }
            }
        }

        Arc::new(DsvParser {
            delimiter,
            roles,
            fields,
        })
    }
}

impl LogParser for DsvParser {
    fn name(&self) -> &'static str {
        "dsv"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    fn parse(&self, line: &str) -> ParsedLine {
        let mut parsed = ParsedLine::default();
        let values: Vec<&str> = line.split(self.delimiter).map(|cell| cell.trim()).collect();
        let mut mensajes: Vec<String> = Vec::new();

        for (index, role) in self.roles.iter().enumerate() {
            let value = values.get(index).copied().unwrap_or("");
            match role {
                ColumnRole::Time => parsed.ts_ms = parse_timestamp(value),
                ColumnRole::Level => {
                    parsed.level = level_of(value).unwrap_or(Level::Unknown);
                }
                ColumnRole::Thread => push_field(&mut parsed, "Thread", value),
                ColumnRole::Logger => push_field(&mut parsed, "Logger", value),
                ColumnRole::Message => {
                    if !value.is_empty() {
                        mensajes.push(value.to_string());
                    }
                }
            }
        }

        if !mensajes.is_empty() {
            set_message(&mut parsed, mensajes.join(" "));
        }
        parsed
    }
}

/// ¿Hay un instante en la línea? Lo usa la detección de formato al abrir.
pub fn has_timestamp(line: &str) -> bool {
    find_timestamp(line).is_some()
}

/// Papel de una sub-línea dentro de una entrada. El usuario puede fijarlo a
/// mano cuando la detección automática no acierte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Time,
    Level,
    Thread,
    Tag,
    Logger,
    Message,
    Ignore,
}

impl Role {
    pub fn from_str(value: &str) -> Role {
        match value.trim().to_ascii_lowercase().as_str() {
            "time" | "timestamp" | "fecha" => Role::Time,
            "level" | "severity" | "nivel" => Role::Level,
            "thread" | "hilo" => Role::Thread,
            "tag" | "category" | "etiqueta" => Role::Tag,
            "logger" | "logger_name" | "source" => Role::Logger,
            "ignore" | "ignorar" => Role::Ignore,
            _ => Role::Message,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Role::Time => "time",
            Role::Level => "level",
            Role::Thread => "thread",
            Role::Tag => "tag",
            Role::Logger => "logger",
            Role::Message => "message",
            Role::Ignore => "ignore",
        }
    }

    /// Columna de la tabla asociada al papel, si tiene una.
    pub fn field(self) -> Option<&'static str> {
        match self {
            Role::Thread => Some("Thread"),
            Role::Tag => Some("Tag"),
            Role::Logger => Some("Logger"),
            Role::Message => Some("Message"),
            Role::Time | Role::Level | Role::Ignore => None,
        }
    }
}

/// Parser automático: agrupa una entrada de varias líneas y reparte cada
/// sub-línea en su columna.
///
/// Ejemplo de entrada (formato de logging de Python):
///
/// ```text
/// 2026-10-23 01:23:49.683
/// unknown
/// info
/// src.infrastructure.web.http_common: mcp: 192.168.1.47 - "GET /api/v1/status HTTP/1.1" 200 - (0 ms)
/// ```
///
/// Sin mapeo explícito deduce el papel de cada línea. Con mapeo, manda el
/// mapeo: es la vía para corregir a mano lo que la heurística no acierte.
pub struct AutoParser {
    fields: Vec<String>,
    mapping: Option<Vec<Role>>,
    /// Ficheros sin instantes (texto libre, YAML de vcpkg): cada línea es una
    /// entrada y no se agrupa nada.
    single_line: bool,
}

impl AutoParser {
    pub fn new() -> Arc<dyn LogParser> {
        Self::with_mapping(None)
    }

    /// Sin instantes en el fichero: una entrada por línea.
    pub fn plain() -> Arc<dyn LogParser> {
        Arc::new(AutoParser {
            fields: vec!["Message".to_string()],
            mapping: None,
            single_line: true,
        })
    }

    pub fn with_mapping(mapping: Option<Vec<Role>>) -> Arc<dyn LogParser> {
        let fields = match &mapping {
            Some(map) => {
                // Solo las columnas que el mapeo usa de verdad: nada de
                // cabeceras fantasma.
                let mut fields: Vec<String> = Vec::new();
                for role in map {
                    if let Some(name) = role.field() {
                        if !fields.iter().any(|existing| existing == name) {
                            fields.push(name.to_string());
                        }
                    }
                    // El rol `logger` parte la línea en logger + mensaje, así que
                    // el mensaje también es una columna de este mapeo.
                    if *role == Role::Logger && !fields.iter().any(|existing| existing == "Message") {
                        fields.push("Message".to_string());
                    }
                }
                fields
            }
            None => vec![
                "Thread".to_string(),
                "Tag".to_string(),
                "Logger".to_string(),
                "Message".to_string(),
            ],
        };
        Arc::new(AutoParser {
            fields,
            mapping,
            single_line: false,
        })
    }
}

impl LogParser for AutoParser {
    fn name(&self) -> &'static str {
        "auto"
    }

    fn field_names(&self) -> &[String] {
        &self.fields
    }

    /// Una entrada nueva empieza cuando la línea arranca con un instante; el
    /// resto son continuaciones de la anterior. En ficheros sin instantes
    /// cada línea es su propia entrada.
    fn starts_entry(&self, line: &str) -> bool {
        self.single_line || timestamp_prefix_end(line).is_some()
    }

    fn parse(&self, text: &str) -> ParsedLine {
        if self.single_line {
            return basic_header(text.split('\n').next().unwrap_or(""));
        }

        let lines: Vec<&str> = text.split('\n').collect();
        let mut parsed = ParsedLine::default();

        if let Some(map) = &self.mapping {
            for (index, line) in lines.iter().enumerate() {
                let role = map.get(index).copied().unwrap_or(Role::Ignore);
                apply_role(role, line.trim(), &mut parsed);
            }
            return parsed;
        }

        let mut iter = lines.into_iter();
        parsed = basic_header(iter.next().unwrap_or(""));
        for line in iter {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                classify(trimmed, &mut parsed);
            }
        }
        parsed
    }

    fn parse_line_at(&self, line: &str, index: usize) -> ParsedLine {
        match &self.mapping {
            Some(map) => {
                let mut parsed = ParsedLine::default();
                let role = map.get(index).copied().unwrap_or(Role::Ignore);
                apply_role(role, line.trim(), &mut parsed);
                parsed
            }
            None => self.parse(line),
        }
    }
}

/// Propone un papel por sub-línea para que la UI lo muestre editable.
pub fn propose_mapping(lines: &[&str]) -> Vec<Role> {
    let mut mapping = Vec::with_capacity(lines.len());
    for (index, raw) in lines.iter().enumerate() {
        let line = raw.trim();
        let role = if index == 0 && parse_timestamp(line).is_some() {
            Role::Time
        } else if is_level_line(line) {
            Role::Level
        } else if is_thread_line(line) {
            Role::Thread
        } else if is_logger_line(line) {
            Role::Logger
        } else if index == 1 && is_tag_candidate(line) {
            Role::Tag
        } else {
            Role::Message
        };
        mapping.push(role);
    }
    mapping
}

/// Un nivel suelto y nada más: `info`, `ERROR`, `[WARN]`.
fn is_level_line(line: &str) -> bool {
    line.len() <= 12 && level_of(line).is_some()
}

fn is_thread_line(line: &str) -> bool {
    line.len() >= 3
        && line.len() <= 24
        && line.starts_with('[')
        && line.ends_with(']')
        && !line.contains(' ')
}

/// `namespace.modulo: mensaje`, con el logger sin espacios.
fn is_logger_line(line: &str) -> bool {
    match line.find(": ") {
        Some(index) if index > 0 && index <= 80 => {
            let head = &line[..index];
            !head.contains(' ') && !head.contains(':')
        }
        _ => false,
    }
}

/// Etiqueta: token corto, sin espacios ni dos puntos y que no sea un nivel.
fn is_tag_candidate(line: &str) -> bool {
    line.len() <= 40
        && !line.contains(' ')
        && !line.contains(':')
        && level_of(line).is_none()
        && !line.chars().all(|c| c.is_ascii_digit())
}

pub(crate) fn push_field(parsed: &mut ParsedLine, name: &str, value: &str) {
    match parsed.fields.iter_mut().find(|(n, _)| n == name) {
        Some((_, existing)) => *existing = value.to_string(),
        None => parsed.fields.push((name.to_string(), value.to_string())),
    }
}

fn append_message(parsed: &mut ParsedLine, line: &str) {
    if line.is_empty() {
        return;
    }
    match parsed.fields.iter_mut().find(|(n, _)| n == "Message") {
        Some((_, existing)) => {
            if !existing.is_empty() {
                existing.push('\n');
            }
            existing.push_str(line);
        }
        None => parsed
            .fields
            .push(("Message".to_string(), line.to_string())),
    }
}

/// Aplica un papel fijado a mano a una sub-línea.
fn apply_role(role: Role, line: &str, parsed: &mut ParsedLine) {
    match role {
        Role::Time => {
            if parsed.ts_ms.is_none() {
                parsed.ts_ms = parse_timestamp(line);
            }
        }
        Role::Level => {
            if let Some(level) = level_of(line) {
                parsed.level = level;
            }
        }
        Role::Thread => {
            let inner = line.trim_matches(|c| c == '[' || c == ']').trim();
            if !inner.is_empty() {
                push_field(parsed, "Thread", inner);
            }
        }
        Role::Tag => {
            if !line.is_empty() {
                push_field(parsed, "Tag", line);
            }
        }
        Role::Logger => match line.find(": ") {
            Some(index) => {
                let head = line[..index].trim();
                if !head.is_empty() {
                    push_field(parsed, "Logger", head);
                }
                set_message(parsed, line[index + 2..].to_string());
            }
            None => {
                if !line.is_empty() {
                    push_field(parsed, "Logger", line);
                }
            }
        },
        Role::Message => append_message(parsed, line),
        Role::Ignore => {}
    }
}

pub(crate) fn has_field(parsed: &ParsedLine, name: &str) -> bool {
    parsed.fields.iter().any(|(n, _)| n == name)
}

/// Escribe el mensaje reutilizando el campo que ya creó la cabecera, en vez de
/// añadir un segundo `Message` vacío que taparía al bueno al buscar por nombre.
pub(crate) fn set_message(parsed: &mut ParsedLine, value: String) {
    match parsed.fields.iter_mut().find(|(n, _)| n == "Message") {
        Some((_, existing)) => *existing = value,
        None => parsed.fields.push(("Message".to_string(), value)),
    }
}

/// Reparte una línea de continuación en nivel, hilo, etiqueta, logger o mensaje.
fn classify(line: &str, parsed: &mut ParsedLine) {
    // 1. Un nivel suelto: "info", "ERROR", "[WARN]". Nunca puede acabar
    // siendo una etiqueta.
    if parsed.level == Level::Unknown && is_level_line(line) {
        if let Some(level) = level_of(line) {
            parsed.level = level;
            return;
        }
    }

    let message_empezado = parsed
        .fields
        .iter()
        .find(|(n, _)| n == "Message")
        .map(|(_, v)| !v.trim().is_empty())
        .unwrap_or(false);

    // 2. Hilo entre corchetes: `[12]`, `[worker-3]`.
    if !message_empezado && !has_field(parsed, "Thread") && is_thread_line(line) {
        let inner = line.trim_matches(|c| c == '[' || c == ']').trim();
        if !inner.is_empty() {
            push_field(parsed, "Thread", inner);
        }
        return;
    }

    // 3. `logger: mensaje`.
    if !message_empezado && !has_field(parsed, "Logger") && is_logger_line(line) {
        let index = line.find(": ").unwrap_or(0);
        push_field(parsed, "Logger", line[..index].trim());
        set_message(parsed, line[index + 2..].to_string());
        return;
    }

    // 4. Etiqueta: token corto que no sea un nivel ni una dirección.
    if !message_empezado && !has_field(parsed, "Tag") && is_tag_candidate(line) {
        push_field(parsed, "Tag", line);
        return;
    }

    // 5. Todo lo demás se acumula en el mensaje, conservando los saltos.
    append_message(parsed, line);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconoce_instante_iso() {
        assert!(parse_timestamp("2026-10-22T19:30:00.123").is_some());
        assert!(parse_timestamp("2026-10-22 19:30:00").is_some());
        assert!(parse_timestamp("no es una fecha").is_none());
    }

    #[test]
    fn basic_extrae_nivel_y_mensaje() {
        let parser = BasicParser::new();
        let parsed = parser.parse("2026-10-22 19:30:00.123 ERROR algo falló");
        assert_eq!(parsed.level, Level::Error);
        assert!(parsed.ts_ms.is_some());
        assert_eq!(parsed.fields[0].1, "algo falló");
    }

    #[test]
    fn pattern_con_grupos() {
        let parser = PatternParser::new(
            r"^(?P<ts>\S+ \S+) (?P<level>\w+) \[(?P<Thread>[^\]]+)\] (?P<Message>.*)$",
        )
        .unwrap();
        let parsed = parser.parse("2026-10-22 19:30:00 WARN [worker-3] reintento");
        assert_eq!(parsed.level, Level::Warn);
        let names: Vec<&str> = parsed.fields.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(names, vec!["Thread", "Message"]);
    }

    #[test]
    fn auto_columniza_una_entrada_de_cuatro_lineas() {
        let parser = AutoParser::new();
        let text = "2026-10-23 01:23:49.683\nunknown\ninfo\nsrc.infrastructure.web.http_common: mcp: 192.168.1.47 - \"GET /api/v1/status HTTP/1.1\" 200 - (0 ms)";
        let parsed = parser.parse(text);

        assert!(parsed.ts_ms.is_some(), "debe leer el instante");
        assert_eq!(parsed.level, Level::Info);

        let campo = |name: &str| {
            parsed
                .fields
                .iter()
                .find(|(n, _)| n == name)
                .map(|(_, v)| v.as_str())
        };
        assert_eq!(campo("Tag"), Some("unknown"));
        assert_eq!(
            campo("Logger"),
            Some("src.infrastructure.web.http_common")
        );
        assert_eq!(
            campo("Message"),
            Some("mcp: 192.168.1.47 - \"GET /api/v1/status HTTP/1.1\" 200 - (0 ms)")
        );
    }

    #[test]
    fn auto_reconoce_donde_empieza_una_entrada() {
        let parser = AutoParser::new();
        assert!(parser.starts_entry("2026-10-23 01:23:49.683"));
        assert!(!parser.starts_entry("unknown"));
        assert!(!parser.starts_entry("info"));
        assert!(!parser.starts_entry(
            "src.infrastructure.web.http_common: mcp: 1.2.3.4 - GET / 200"
        ));
    }

    #[test]
    fn auto_con_una_sola_linea_se_comporta_como_basic() {
        let parser = AutoParser::new();
        let parsed = parser.parse("2026-10-22 08:00:03,103 [12] WARN App.Servicio - reintento");
        assert!(parsed.ts_ms.is_some());
        assert_eq!(parsed.level, Level::Warn);
        let thread = parsed.fields.iter().find(|(n, _)| n == "Thread");
        assert_eq!(thread.map(|(_, v)| v.as_str()), Some("12"));
    }

    #[test]
    fn propose_mapping_acierta_con_el_ejemplo_del_usuario() {
        let lines = [
            "2026-10-23 01:23:49.683",
            "unknown",
            "info",
            "src.infrastructure.web.http_common: mcp: 192.168.1.47 - GET / 200",
        ];
        assert_eq!(
            propose_mapping(&lines),
            vec![Role::Time, Role::Tag, Role::Level, Role::Logger]
        );
    }

    #[test]
    fn un_nivel_nunca_se_convierte_en_etiqueta() {
        let lines = ["2026-10-23 01:23:49.683", "info"];
        let proposal = propose_mapping(&lines);
        assert_eq!(proposal[1], Role::Level, "`info` es nivel, no tag");
    }

    #[test]
    fn mapeo_manual_sin_columnas_fantasma() {
        let parser = AutoParser::with_mapping(Some(vec![
            Role::Time,
            Role::Tag,
            Role::Level,
            Role::Message,
        ]));
        // Este fichero no tiene hilo ni logger: no deben anunciarse.
        assert_eq!(
            parser.field_names(),
            ["Tag".to_string(), "Message".to_string()]
        );

        let parsed = parser.parse(
            "2026-10-23 01:23:49.683\nunknown\ninfo\nmcp: 192.168.1.47 - GET / 200",
        );
        assert!(parsed.ts_ms.is_some());
        assert_eq!(parsed.level, Level::Info);
        let campo = |name: &str| {
            parsed
                .fields
                .iter()
                .find(|(n, _)| n == name)
                .map(|(_, v)| v.as_str())
        };
        assert_eq!(campo("Tag"), Some("unknown"));
        assert_eq!(campo("Message"), Some("mcp: 192.168.1.47 - GET / 200"));
    }

    #[test]
    fn mapeo_con_logger_separa_logger_y_mensaje() {
        let parser = AutoParser::with_mapping(Some(vec![
            Role::Time,
            Role::Level,
            Role::Logger,
        ]));
        assert_eq!(
            parser.field_names(),
            ["Logger".to_string(), "Message".to_string()]
        );
        let parsed = parser.parse("2026-10-23 01:23:49.683\nWARN\napp.db: conexión perdida");
        assert_eq!(parsed.level, Level::Warn);
        let campo = |name: &str| {
            parsed
                .fields
                .iter()
                .find(|(n, _)| n == name)
                .map(|(_, v)| v.as_str())
        };
        assert_eq!(campo("Logger"), Some("app.db"));
        assert_eq!(campo("Message"), Some("conexión perdida"));
    }

    #[test]
    fn mapeo_ignorar_descarta_la_linea() {
        let parser = AutoParser::with_mapping(Some(vec![
            Role::Time,
            Role::Ignore,
            Role::Level,
        ]));
        let parsed = parser.parse("2026-10-23 01:23:49.683\nruido\nERROR");
        assert_eq!(parsed.level, Level::Error);
        assert!(
            !parsed.fields.iter().any(|(_, v)| v == "ruido"),
            "la línea ignorada no debe aparecer"
        );
    }

    // ------------------------------------------------ familias reales

    fn campo<'a>(parsed: &'a ParsedLine, name: &str) -> Option<&'a str> {
        parsed
            .fields
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, v)| v.as_str())
    }

    #[test]
    fn lmstudio_instante_entre_corchetes_y_componente() {
        let parser = AutoParser::new();
        let line = "[2026-02-09 10:39:38][INFO][LM STUDIO SERVER] Success! HTTP server listening on port 1234";
        assert!(parser.starts_entry(line), "debe abrir entrada");

        let parsed = parser.parse(line);
        assert!(parsed.ts_ms.is_some(), "instante entre corchetes");
        assert_eq!(parsed.level, Level::Info);
        assert_eq!(campo(&parsed, "Tag"), Some("LM STUDIO SERVER"));
        assert!(campo(&parsed, "Message").unwrap_or("").starts_with("Success!"));
    }

    #[test]
    fn cbs_coma_tras_el_instante_bom_y_fuente() {
        let parser = AutoParser::new();
        let line = "\u{feff}2026-10-15 22:45:21, Info                  CBS    TI: --- Initializing Trusted Installer ---";
        let parsed = parser.parse(line);

        assert!(parsed.ts_ms.is_some(), "la coma tras el instante no debe romperlo");
        assert_eq!(parsed.level, Level::Info);
        assert_eq!(campo(&parsed, "Tag"), Some("CBS"));
        assert!(campo(&parsed, "Message")
            .unwrap_or("")
            .contains("Initializing Trusted Installer"));
    }

    #[test]
    fn opencode_nivel_delante_del_instante() {
        let parser = AutoParser::new();
        let line = "INFO  2026-06-06T07:31:40 +193ms service=file init";
        let parsed = parser.parse(line);

        assert!(parsed.ts_ms.is_some(), "instante tras el nivel");
        assert_eq!(parsed.level, Level::Info);
        assert!(campo(&parsed, "Message")
            .unwrap_or("")
            .contains("service=file init"));
    }

    #[test]
    fn calibre_pipe_deduce_las_columnas_por_contenido() {
        let sample: Vec<String> = (0..5)
            .map(|i| {
                format!("2026-07-07 12:09:3{i} | INFO  | root             | MainThread | mensaje {i}")
            })
            .collect();
        let parser = DsvParser::with_detection('|', &sample);

        let names: Vec<&str> = parser.field_names().iter().map(|n| n.as_str()).collect();
        assert_eq!(names, vec!["Logger", "Thread", "Message"]);

        let parsed = parser.parse(&sample[0]);
        assert!(parsed.ts_ms.is_some());
        assert_eq!(parsed.level, Level::Info);
        assert_eq!(campo(&parsed, "Logger"), Some("root"));
        assert_eq!(campo(&parsed, "Thread"), Some("MainThread"));
        assert_eq!(campo(&parsed, "Message"), Some("mensaje 0"));
    }

    #[test]
    fn fichero_sin_instantes_una_entrada_por_linea() {
        let parser = AutoParser::plain();
        assert!(parser.starts_entry("---"));
        assert!(parser.starts_entry("events:"));

        let parsed = parser.parse("defino las variables");
        assert!(parsed.ts_ms.is_none());
        assert_eq!(campo(&parsed, "Message"), Some("defino las variables"));
    }

    #[test]
    fn detecta_instante_en_las_familias_reales() {        assert!(has_timestamp("2026-10-22 08:00:00,004 [1] DEBUG App - x"));
        assert!(has_timestamp("[2026-02-09 10:39:38][INFO][LM STUDIO SERVER] x"));
        assert!(has_timestamp("2026-10-15 22:45:21, Info  CBS  TI: x"));
        assert!(has_timestamp("INFO  2026-06-06T07:31:40 +193ms service=file init"));
        assert!(has_timestamp("2026-10-23 01:23:49.683"));
        assert!(!has_timestamp("events:"));
        assert!(!has_timestamp("defino las variables"));
    }

    #[test]
    fn logfmt_extrae_tiempo_nivel_y_mensaje() {
        let line = "timestamp=2026-06-10T09:58:43.960Z level=INFO run=d53615b2 message=\"loading tui config\" part=1";
        assert!(looks_like_logfmt(line));

        let parser = LogfmtParser::new();
        let parsed = parser.parse(line);

        assert!(parsed.ts_ms.is_some(), "instante de la clave timestamp");
        assert_eq!(parsed.level, Level::Info);
        assert_eq!(campo(&parsed, "Message"), Some("loading tui config"));
        let extra = campo(&parsed, "Extra").unwrap_or("");
        assert!(extra.contains("run=d53615b2"), "extra: {extra}");
        assert!(extra.contains("part=1"));
    }

    #[test]
    fn logfmt_respeta_comillas_con_espacios() {
        let pairs = logfmt_pairs("a=\"uno dos\" b=tres");
        assert_eq!(
            pairs,
            vec![
                ("a".to_string(), "uno dos".to_string()),
                ("b".to_string(), "tres".to_string())
            ]
        );
    }

    #[test]
    fn logfmt_no_confunde_texto_libre() {
        assert!(!looks_like_logfmt("defino las variables"));
        assert!(!looks_like_logfmt("events:"));
        assert!(!looks_like_logfmt("2026-10-22 08:00:00,004 [1] DEBUG App - x=1"));
    }
}
