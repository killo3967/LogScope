//! Verificación contra ficheros de log reales de esta máquina.
//!
//! Está marcado como `#[ignore]` porque depende de rutas locales. Se ejecuta a
//! mano:
//!
//! ```text
//! cargo test --test formatos_reales -- --ignored --nocapture
//! ```

use std::path::Path;

use logscope_lib::deteccion_automatica;
use logscope_lib::index::EntryTable;
use logscope_lib::parser::{AutoParser, DsvParser, LogParser, LogfmtParser};

struct Caso {
    nombre: &'static str,
    ruta: &'static str,
    parsers: &'static [&'static str],
}

const CASOS: &[Caso] = &[
    Caso {
        nombre: "LM Studio (corchetes)",
        ruta: r"C:\Users\tomas\.lmstudio\server-logs\2026-02\2026-02-09.1.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "CBS de Windows (coma + BOM)",
        ruta: r"C:\Windows\Logs\CBS\CBS.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "opencode (nivel delante)",
        ruta: r"C:\Users\tomas\.local\share\opencode\log\opencode.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "calibre-mcp (pipe)",
        ruta: r"K:\Traductor\Scriptorium\logs\calibre_mcp.log",
        parsers: &["dsv"],
    },
    Caso {
        nombre: "vcpkg (sin instantes)",
        ruta: r"C:\vcpkg\buildtrees\boost-json\install-x64-windows-dbg-out.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "log4net de muestra",
        ruta: r"K:\LogScope\samples\app.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "eMule en UTF-16LE con BOM",
        ruta: r"K:\LogScope\samples\emule-utf16.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "multilínea de 4 líneas",
        ruta: r"K:\LogScope\samples\multiline.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "CLF Apache/Nginx (ClfColumnizer)",
        ruta: r"K:\LogScope\samples\formatos\clf.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "JSON log4j2 (JsonColumnizer)",
        ruta: r"K:\LogScope\samples\formatos\json.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "Log4j XML (Log4jXmlColumnizer)",
        ruta: r"K:\LogScope\samples\formatos\log4jxml.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "Glassfish (GlassfishColumnizer)",
        ruta: r"K:\LogScope\samples\formatos\glassfish.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "WebSphere (WebsphereColumnizer)",
        ruta: r"K:\LogScope\samples\formatos\websphere.log",
        parsers: &["auto"],
    },
    Caso {
        nombre: "Corchetes con fecha y hora separadas (SquareBracketColumnizer)",
        ruta: r"K:\LogScope\samples\formatos\squarebracket.log",
        parsers: &["auto"],
    },
];

/// Resuelve la ruta: si el fichero exacto no existe, toma el `.log` mayor del
/// directorio, para que el arnés siga sirviendo aunque el nombre cambie.
fn resolve(ruta: &str) -> Option<std::path::PathBuf> {
    let path = Path::new(ruta);
    if path.is_file() {
        return Some(path.to_path_buf());
    }
    let dir = path.parent()?;
    let mut best: Option<(u64, std::path::PathBuf)> = None;
    for entry in std::fs::read_dir(dir).ok()? {
        let Ok(entry) = entry else { continue };
        let candidate = entry.path();
        if !candidate.is_file() {
            continue;
        }
        if candidate.extension().and_then(|e| e.to_str()) != Some("log") {
            continue;
        }
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        if best.as_ref().map(|(best_size, _)| size > *best_size).unwrap_or(true) {
            best = Some((size, candidate));
        }
    }
    best.map(|(_, path)| path)
}

#[test]
#[ignore]
fn informa_de_cada_fichero_real() {
    let mut comprobados = 0;

    for caso in CASOS {
        let Some(path) = resolve(caso.ruta) else {
            println!("OMITIDO  {}: no se encontró {}", caso.nombre, caso.ruta);
            continue;
        };
        let path = path.as_path();

        let bytes = match std::fs::read(path) {
            Ok(bytes) => bytes,
            Err(error) => {
                println!("ERROR    {}: {error}", caso.nombre);
                continue;
            }
        };

        // Muestreo de cabecera para decidir el parser, como hace la app.
        let head = &bytes[..bytes.len().min(64 * 1024)];
        let sample: Vec<String> = String::from_utf8_lossy(head)
            .split('\n')
            .map(|line| line.trim_start_matches('\u{feff}').trim_end().to_string())
            .filter(|line| !line.trim().is_empty())
            .take(30)
            .collect();

        for kind in caso.parsers {
            let parser: std::sync::Arc<dyn LogParser> = match *kind {
                "dsv" => DsvParser::with_detection('|', &sample),
                "logfmt" => LogfmtParser::new(),
                "basic" => AutoParser::plain(),
                // El resto usa EXACTAMENTE la detección de la aplicación.
                _ => deteccion_automatica(head),
            };
            let elegido = parser.name();

            let started = std::time::Instant::now();
            let mut table = EntryTable::new(parser);
            table.ingest_bytes(&bytes);
            let elapsed = started.elapsed();
            let fields = table.present_fields(200);

            println!(
                "{}\n  fichero: {}\n  parser detectado: {}",
                caso.nombre, caso.ruta, elegido
            );
            println!(
                "  {} líneas físicas -> {} entradas, {:.1} MB en {:?}",
                bytes.iter().filter(|&&b| b == b'\n').count(),
                table.len(),
                bytes.len() as f64 / (1024.0 * 1024.0),
                elapsed
            );
            println!("  columnas: Time, Level, {fields:?}");

            if table.len() > 0 {
                let row = table.row(0);
                let campo = |name: &str| {
                    row.fields
                        .iter()
                        .find(|f| f.name == name)
                        .map(|f| f.value.clone())
                        .unwrap_or_default()
                };
                println!(
                    "  fila 1: time={:?} level={:?} thread={:?} tag={:?} logger={:?}",
                    row.ts_ms,
                    row.level,
                    campo("Thread"),
                    campo("Tag"),
                    campo("Logger")
                );
                println!("  mensaje: {}", campo("Message").chars().take(90).collect::<String>());
            }
            println!();
            comprobados += 1;
        }
    }

    assert!(comprobados > 0, "no se comprobó ningún fichero real");
}
