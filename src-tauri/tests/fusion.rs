//! Fusión de ficheros con formatos distintos en una sola vista ordenada.
//!
//! Usa la misma detección de parser que la aplicación y las muestras del
//! repositorio. Si faltan las muestras, el test se salta.

use std::path::Path;
use std::sync::Arc;

use logscope_lib::deteccion_automatica;
use logscope_lib::index::{EntryTable, LogSet, Source};
use logscope_lib::model::Row;
use logscope_lib::parser::LogParser;

const CLF: &str = "../samples/formatos/clf.log";
const JSON: &str = "../samples/formatos/json.log";

fn cargar(path: &Path) -> Option<Source> {
    let bytes = std::fs::read(path).ok()?;
    let head = &bytes[..bytes.len().min(64 * 1024)];
    let parser: Arc<dyn LogParser> = deteccion_automatica(head);
    let mut table = EntryTable::new(parser);
    table.ingest_bytes(&bytes);
    Some(Source {
        name: path.file_name()?.to_string_lossy().into_owned(),
        table,
    })
}

fn mensaje(row: &Row) -> String {
    row.fields
        .iter()
        .find(|field| field.name == "Message")
        .map(|field| field.value.clone())
        .unwrap_or_default()
}

/// JSON con instantes intercalados con `clf.log`: el CLF empieza a las 11:55:36
/// UTC y avanza de segundo en segundo, así que medio segundo después de cada
/// uno cae una entrada JSON.
fn escribir_json_intercalado(count: usize) -> std::path::PathBuf {
    use chrono::{Duration, TimeZone, Utc};

    let base = Utc.with_ymd_and_hms(2026, 10, 22, 11, 55, 36).unwrap();
    let mut text = String::new();
    for index in 0..count {
        let momento = base + Duration::milliseconds(500 + index as i64 * 1000);
        text.push_str(&format!(
            "{{\"@timestamp\":\"{}\",\"level\":\"ERROR\",\"logger_name\":\"app.temp\",\"message\":\"json {index}\"}}\n",
            momento.format("%Y-%m-%dT%H:%M:%S%.3fZ")
        ));
    }
    let mut path = std::env::temp_dir();
    path.push("logscope-fusion-json.log");
    std::fs::write(&path, text).expect("escribir json temporal");
    path
}

#[test]
fn dos_zonas_distintas_se_ordenan_por_instante_real() {
    // La misma hora de pared en dos ficheros: uno escrito en UTC y otro en
    // UTC+2. Los dígitos son idénticos, así que solo el instante real puede
    // decidir el orden: el de UTC+2 ocurrió dos horas antes.
    let contenido = "2026-10-22 10:00:00 INFO misma hora\n";

    let en_utc = fuente_con_zona("zona-utc.log", contenido, Some(0));
    let en_utc_mas_2 = fuente_con_zona("zona-mas2.log", contenido, Some(120));

    let set = LogSet::new(vec![en_utc, en_utc_mas_2]);
    assert_eq!(set.len(), 2);
    assert!(set.is_merged());

    // Mismos dígitos en las dos filas…
    assert_eq!(set.row(0).hora.as_deref(), Some("10:00:00.000"));
    assert_eq!(set.row(1).hora.as_deref(), Some("10:00:00.000"));
    assert_eq!(set.row(0).ts_ms, set.row(1).ts_ms);
    // …pero primero la de UTC+2, que es el instante más temprano.
    assert_eq!(set.row(0).source, "zona-mas2.log");
    assert_eq!(set.row(1).source, "zona-utc.log");
}

/// Fuente a partir de un texto, escrita en una zona horaria concreta (minutos
/// respecto de UTC; `None` = la del equipo).
fn fuente_con_zona(nombre: &str, contenido: &str, zona: Option<i32>) -> Source {
    let mut path = std::env::temp_dir();
    path.push(format!("logscope-fusion-{nombre}"));
    std::fs::write(&path, contenido).expect("escribir log temporal");

    let mut table = EntryTable::new(logscope_lib::parser::BasicParser::new());
    table.set_zona(zona);
    table.ingest_bytes(contenido.as_bytes());
    Source {
        name: nombre.to_string(),
        table,
    }
}

#[test]
fn fusiona_dos_formatos_distintos_en_orden_de_instante() {
    let clf = Path::new(CLF);
    if !clf.exists() {
        eprintln!("omitido: falta {CLF}");
        return;
    }

    let json_path = escribir_json_intercalado(300);

    let (Some(mut a), Some(mut b)) = (cargar(clf), cargar(&json_path)) else {
        eprintln!("omitido: no se pudieron leer las fuentes");
        return;
    };

    // Ahora se guarda la hora de pared, así que para ordenar entre ficheros hay
    // que decir en qué zona está escrito cada uno: el CLF de muestra escribe
    // `+0200` y el JSON `Z`. Es justo el ajuste «zona del log».
    a.table.set_zona(Some(120));
    b.table.set_zona(Some(0));

    // Cada fuente conserva su propio parser: son formatos distintos.
    let parser_a = a.table.parser_name().to_string();
    let parser_b = b.table.parser_name().to_string();
    println!("parsers: {parser_a} + {parser_b}");
    assert_eq!(parser_a, "clf");
    assert_eq!(parser_b, "json");
    assert_eq!(a.table.len(), 300);
    assert_eq!(b.table.len(), 300);

    let set = LogSet::new(vec![a, b]);
    assert_eq!(set.len(), 600);
    assert!(set.is_merged());

    // Orden no decreciente por instante y ninguna fila sin tiempo.
    let mut anterior = i64::MIN;
    let mut con_instante = 0;
    let mut origenes: Vec<String> = Vec::new();
    let mut cambios = 0;

    for index in 0..set.len() {
        let row = set.row(index);
        row.ts_ms.expect("todas las fuentes traen hora");
        // Se ordena por instante real, no por la hora de pared: dos ficheros con
        // los mismos dígitos pueden haber ocurrido en momentos distintos.
        let ts = set.instant_at(index);
        assert!(
            ts >= anterior,
            "orden roto en la fila {index}: {ts} < {anterior}"
        );
        anterior = ts;
        con_instante += 1;

        if origenes.last().map(|last| last != &row.source).unwrap_or(true) {
            origenes.push(row.source.clone());
            cambios += 1;
        }
    }

    println!("fusionadas {con_instante} entradas con {cambios} tramos de fichero");
    assert_eq!(con_instante, 600);
    assert!(
        cambios > 100,
        "los ficheros deben intercalarse, no concatenarse: {cambios} tramos"
    );

    // Ambos orígenes presentes y con su columna de origen rellena.
    let nombres: Vec<String> = (0..set.len()).map(|i| set.row(i).source).collect();
    assert!(nombres.iter().any(|name| name == "clf.log"));
    assert!(nombres.iter().any(|name| name == "logscope-fusion-json.log"));

    println!("primera: [{}] {}", set.row(0).source, mensaje(&set.row(0)));
    println!(
        "última:  [{}] {}",
        set.row(set.len() - 1).source,
        mensaje(&set.row(set.len() - 1))
    );

    let _ = std::fs::remove_file(&json_path);
}

#[test]
fn el_filtro_funciona_en_la_vista_combinada() {
    let clf = Path::new(CLF);
    let json = Path::new(JSON);
    if !clf.exists() || !json.exists() {
        eprintln!("omitido: faltan muestras");
        return;
    }
    let (Some(a), Some(b)) = (cargar(clf), cargar(json)) else {
        return;
    };
    let set = LogSet::new(vec![a, b]);

    let visibles = set.visible(&logscope_lib::index::Filters {
        levels: Some(logscope_lib::model::Level::Error.bit()),
        text: None,
        avanzado: None,
    });
    println!("filas de nivel error en la vista combinada: {}", visibles.len());
    assert!(!visibles.is_empty());
    for index in visibles.iter() {
        assert_eq!(
            set.row(*index as usize).level,
            logscope_lib::model::Level::Error
        );
    }
    assert!(visibles.len() < set.len());
}
