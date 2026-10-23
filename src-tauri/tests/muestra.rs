//! Verificación del motor contra la muestra real del repositorio.
//!
//! Si `samples/app.log` no existe (está en .gitignore), el test se salta con
//! un aviso en lugar de fallar.

use std::path::Path;
use std::time::Instant;

use logscope_lib::index::{EntryTable, Filters};
use logscope_lib::model::Level;
use logscope_lib::parser::{AutoParser, BasicParser, Role};

const SAMPLE: &str = "../samples/app.log";
const LARGE: &str = "../samples/app-large.log";
const MULTILINE: &str = "../samples/multiline.log";

#[test]
fn mapeo_manual_sobre_la_muestra_multilinea() {
    let path = Path::new(MULTILINE);
    if !path.exists() {
        eprintln!("omitido: no existe {MULTILINE}");
        return;
    }

    // Mapeo fijado a mano: fecha, etiqueta, nivel y mensaje. Es el que el
    // usuario puede ajustar desde el diálogo de columnas.
    let mapping = vec![Role::Time, Role::Tag, Role::Level, Role::Message];
    let mut table = EntryTable::new(AutoParser::with_mapping(Some(mapping)));
    let bytes = std::fs::read(path).expect("leer la muestra multilínea");
    table.ingest_bytes(&bytes);

    assert_eq!(table.len(), 5_000);

    let fields = table.present_fields(200);
    println!("columnas con mapeo manual: {fields:?}");
    println!(
        "total de columnas en la tabla: {}",
        fields.len() + 2 // + Time + Level
    );
    assert_eq!(fields, vec!["Tag".to_string(), "Message".to_string()]);

    let row = table.row(0);
    assert_eq!(row.level, Level::Info);
    assert!(row.ts_ms.is_some());
    let campo = |name: &str| {
        row.fields
            .iter()
            .find(|f| f.name == name)
            .map(|f| f.value.clone())
            .unwrap_or_default()
    };
    assert_eq!(campo("Tag"), "unknown");
    assert!(campo("Message").contains("GET /api/v1/status"));
    println!(
        "fila 1: time={:?} level={:?} tag={:?} message={:?}",
        row.ts_ms,
        row.level,
        campo("Tag"),
        campo("Message")
    );

    let _ = BasicParser::new();
}

#[test]
fn columniza_la_muestra_multilinea() {
    let path = Path::new(MULTILINE);
    if !path.exists() {
        eprintln!("omitido: no existe {MULTILINE}");
        return;
    }

    let bytes = std::fs::read(path).expect("leer la muestra multilínea");
    let started = Instant::now();
    let mut table = EntryTable::new(AutoParser::new());
    table.ingest_bytes(&bytes);
    let elapsed = started.elapsed();

    println!(
        "multilínea: {} entradas desde {} líneas físicas en {:?}",
        table.len(),
        bytes.iter().filter(|&&b| b == b'\n').count(),
        elapsed
    );
    assert_eq!(table.len(), 5_000, "cuatro líneas físicas por entrada");

    let row = table.row(0);
    let campo = |name: &str| {
        row.fields
            .iter()
            .find(|f| f.name == name)
            .map(|f| f.value.clone())
            .unwrap_or_default()
    };
    println!(
        "columnas de la primera entrada: level={:?} tag={:?} logger={:?} message={:?}",
        row.level,
        campo("Tag"),
        campo("Logger"),
        campo("Message")
    );

    assert!(row.ts_ms.is_some());
    assert_eq!(row.level, Level::Info);
    assert_eq!(campo("Tag"), "unknown");
    assert!(campo("Logger").starts_with("src."));
    assert!(campo("Message").contains("GET /api/v1/status"));
    assert!(row.raw.contains('\n'), "la entrada conserva sus líneas");
}

#[test]
fn carga_un_millon_de_lineas() {
    let path = Path::new(LARGE);
    if !path.exists() {
        eprintln!("omitido: no existe {LARGE}");
        return;
    }

    let bytes = std::fs::read(path).expect("leer la muestra grande");
    let started = Instant::now();
    let mut table = EntryTable::new(BasicParser::new());
    table.ingest_bytes(&bytes);
    let elapsed = started.elapsed();

    let mb = bytes.len() as f64 / (1024.0 * 1024.0);
    println!(
        "ingesta grande: {} líneas, {:.1} MB en {:?} ({:.1} MB/s)",
        table.len(),
        mb,
        elapsed,
        mb / elapsed.as_secs_f64()
    );
    assert_eq!(table.len(), 1_000_000);

    // Coste de filtro y de página sobre un millón de entradas.
    let started = Instant::now();
    let errors = table.matching_indices(&Filters {
        levels: Some(Level::Error.bit()),
        text: None,
    });
    println!(
        "filtro por nivel a 1M: {} coincidencias en {:?}",
        errors.len(),
        started.elapsed()
    );

    let started = Instant::now();
    let text_hits = table.matching_indices(&Filters {
        levels: None,
        text: Some("pasarela de pago".to_string()),
    });
    println!(
        "búsqueda de texto a 1M: {} coincidencias en {:?}",
        text_hits.len(),
        started.elapsed()
    );

    let visible: Vec<u32> = (0..table.len() as u32).collect();
    let started = Instant::now();
    for page in 0..20 {
        let rows = table.page(&visible, page * 200, 200);
        assert_eq!(rows.len(), 200);
    }
    println!("20 páginas de 200 filas a 1M en {:?}", started.elapsed());
    println!("última línea: {}", table.row(999_999).line_no);
}

#[test]
fn carga_la_muestra_de_200k_lineas() {
    let path = Path::new(SAMPLE);
    if !path.exists() {
        eprintln!("omitido: no existe {SAMPLE}");
        return;
    }

    let bytes = std::fs::read(path).expect("leer la muestra");
    let started = Instant::now();
    let mut table = EntryTable::new(BasicParser::new());
    table.ingest_bytes(&bytes);
    let elapsed = started.elapsed();

    let mb = bytes.len() as f64 / (1024.0 * 1024.0);
    let throughput = mb / elapsed.as_secs_f64();
    println!(
        "ingesta: {} líneas, {:.1} MB en {:?} ({:.1} MB/s)",
        table.len(),
        mb,
        elapsed,
        throughput
    );

    assert_eq!(table.len(), 200_000, "debe haber una entrada por línea");
    assert_eq!(table.consumed(), bytes.len() as u64);

    let first = table.row(0);
    let last = table.row(199_999);
    println!(
        "primera fila: ts={:?} nivel={:?} campo={:?}",
        first.ts_ms, first.level, first.fields[0].value
    );
    assert!(first.ts_ms.is_some(), "la marca de tiempo debe detectarse");
    assert_ne!(first.level, Level::Unknown, "el nivel debe detectarse");
    assert_eq!(last.line_no, 200_000);
    assert_eq!(last.index, 199_999);
}

#[test]
fn filtra_la_muestra_por_nivel_y_texto() {
    let path = Path::new(SAMPLE);
    if !path.exists() {
        eprintln!("omitido: no existe {SAMPLE}");
        return;
    }
    let bytes = std::fs::read(path).expect("leer la muestra");
    let mut table = EntryTable::new(BasicParser::new());
    table.ingest_bytes(&bytes);

    let started = Instant::now();
    let errors = table.matching_indices(&Filters {
        levels: Some(Level::Error.bit()),
        text: None,
    });
    println!(
        "filtro por nivel: {} de {} líneas en {:?}",
        errors.len(),
        table.len(),
        started.elapsed()
    );
    assert!(!errors.is_empty(), "la muestra contiene errores");
    assert!(errors.len() < table.len(), "el filtro debe descartar líneas");

    let started = Instant::now();
    let hits = table.matching_indices(&Filters {
        levels: None,
        text: Some("pasarela de pago".to_string()),
    });
    println!(
        "búsqueda de texto: {} coincidencias en {:?}",
        hits.len(),
        started.elapsed()
    );
    assert!(!hits.is_empty(), "la muestra contiene ese texto");
}

#[test]
fn pagina_la_muestra_sin_recorrerla_entera() {
    let path = Path::new(SAMPLE);
    if !path.exists() {
        eprintln!("omitido: no existe {SAMPLE}");
        return;
    }
    let bytes = std::fs::read(path).expect("leer la muestra");
    let mut table = EntryTable::new(BasicParser::new());
    table.ingest_bytes(&bytes);

    let visible: Vec<u32> = (0..table.len() as u32).collect();
    let started = Instant::now();
    for page in 0..10 {
        let rows = table.page(&visible, page * 200, 200);
        assert_eq!(rows.len(), 200);
    }
    println!("10 páginas de 200 filas en {:?}", started.elapsed());
}
