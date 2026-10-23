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
fn fusiona_dos_formatos_distintos_en_orden_de_instante() {
    let clf = Path::new(CLF);
    if !clf.exists() {
        eprintln!("omitido: falta {CLF}");
        return;
    }

    let json_path = escribir_json_intercalado(300);

    let (Some(a), Some(b)) = (cargar(clf), cargar(&json_path)) else {
        eprintln!("omitido: no se pudieron leer las fuentes");
        return;
    };

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
        let ts = row.ts_ms.expect("todas las fuentes traen instante");
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
