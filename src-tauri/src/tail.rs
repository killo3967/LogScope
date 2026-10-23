use std::io::{Read, Seek, SeekFrom};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

use crate::index::EntryTable;
use crate::Session;

const POLL: Duration = Duration::from_millis(250);
const CHUNK: usize = 64 * 1024;

/// Lee desde `pos` hasta el final del fichero, ingiriendo lo nuevo.
/// Devuelve los bytes añadidos y actualiza `pos`.
pub fn pump(
    file: &mut std::fs::File,
    table: &mut EntryTable,
    pos: &mut u64,
    buf: &mut [u8],
) -> u64 {
    if file.seek(SeekFrom::Start(*pos)).is_err() {
        return 0;
    }
    let mut appended = 0u64;
    loop {
        match file.read(buf) {
            Ok(0) => break,
            Ok(n) => {
                *pos += n as u64;
                appended += n as u64;
                table.ingest_bytes(&buf[..n]);
            }
            Err(_) => break,
        }
    }
    appended
}

/// El fichero se ha acortado por debajo de lo ya consumido: truncado.
pub fn is_truncated(file_len: u64, pos: u64) -> bool {
    file_len < pos
}

/// Sigue el fichero en un hilo propio: sondeo del tamaño, detección de
/// truncado y de rotación, e ingesta incremental.
///
/// Solo se usa con sesiones de una fuente: en una vista combinada el orden
/// tendría que recalcularse en cada línea.
pub fn spawn(app: AppHandle, session: Arc<Session>) {
    thread::spawn(move || {
        let path = session.path.clone();

        let mut file = match std::fs::File::open(&path) {
            Ok(f) => f,
            Err(_) => {
                session.tail_running.store(false, Ordering::SeqCst);
                return;
            }
        };

        let mut pos = {
            let set = match session.set.lock() {
                Ok(set) => set,
                Err(poisoned) => poisoned.into_inner(),
            };
            set.sources
                .first()
                .map(|source| source.table.consumed())
                .unwrap_or(0)
        };
        let mut identity = file_identity(&path);
        let mut buf = vec![0u8; CHUNK];

        while !session.tail_stop.load(Ordering::SeqCst) {
            // Rotación: el fichero ha sido reemplazado por otro.
            let current_identity = file_identity(&path);
            if current_identity != identity {
                identity = current_identity;
                if let Ok(f) = std::fs::File::open(&path) {
                    file = f;
                }
                pos = 0;
                if let Ok(mut set) = session.set.lock() {
                    set.reset_single_source();
                }
            }

            // Truncado: el fichero es más corto que lo ya consumido.
            if let Ok(meta) = std::fs::metadata(&path) {
                if is_truncated(meta.len(), pos) {
                    pos = 0;
                    if file.seek(SeekFrom::Start(0)).is_err() {
                        if let Ok(f) = std::fs::File::open(&path) {
                            file = f;
                        }
                    }
                    if let Ok(mut set) = session.set.lock() {
                        set.reset_single_source();
                    }
                }
            }

            let appended = {
                let mut set = match session.set.lock() {
                    Ok(set) => set,
                    Err(poisoned) => poisoned.into_inner(),
                };
                match set.sources.first_mut() {
                    Some(source) => pump(&mut file, &mut source.table, &mut pos, &mut buf),
                    None => 0,
                }
            };

            if appended > 0 {
                if let Ok(mut set) = session.set.lock() {
                    set.sync_single_source();
                }
                let _ = app.emit(
                    "log://appended",
                    serde_json::json!({ "sessionId": session.id, "bytes": appended }),
                );
            }

            thread::sleep(POLL);
        }

        session.tail_running.store(false, Ordering::SeqCst);
        let _ = app.emit(
            "log://tail-stopped",
            serde_json::json!({ "sessionId": session.id }),
        );
    });
}

/// Identidad del fichero. Solo la fecha de creación: el tamaño cambia con
/// cada línea añadida y no sirve como identidad. La versión robusta usaría
/// el índice de fichero de Windows (`GetFileInformationByHandle`).
fn file_identity(path: &std::path::Path) -> Option<std::time::SystemTime> {
    std::fs::metadata(path).ok()?.created().ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::BasicParser;
    use std::io::Write;

    fn temp_path(name: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("logscope-tail-{name}.log"));
        let _ = std::fs::remove_file(&path);
        path
    }

    #[test]
    fn sigue_lineas_anadidas() {
        let path = temp_path("append");
        let mut writer = std::fs::File::create(&path).unwrap();
        writeln!(writer, "2026-10-22 10:00:00 INFO primera").unwrap();
        writer.flush().unwrap();

        let mut file = std::fs::File::open(&path).unwrap();
        let mut table = EntryTable::new(BasicParser::new());
        let mut pos = 0u64;
        let mut buf = vec![0u8; 4096];

        assert!(pump(&mut file, &mut table, &mut pos, &mut buf) > 0);
        assert_eq!(table.len(), 1);

        // Nada nuevo: el sondeo no debe añadir ni duplicar.
        assert_eq!(pump(&mut file, &mut table, &mut pos, &mut buf), 0);
        assert_eq!(table.len(), 1);

        let mut writer = std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap();
        writeln!(writer, "2026-10-22 10:00:01 ERROR segunda").unwrap();
        writeln!(writer, "2026-10-22 10:00:02 WARN tercera").unwrap();
        writer.flush().unwrap();

        assert!(pump(&mut file, &mut table, &mut pos, &mut buf) > 0);
        assert_eq!(table.len(), 3);
        assert_eq!(table.row(1).level, crate::model::Level::Error);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn conserva_linea_a_medias_entre_sondeos() {
        let path = temp_path("partial");
        let mut writer = std::fs::File::create(&path).unwrap();
        write!(writer, "2026-10-22 10:00:00 INFO linea incompleta").unwrap();
        writer.flush().unwrap();

        let mut file = std::fs::File::open(&path).unwrap();
        let mut table = EntryTable::new(BasicParser::new());
        let mut pos = 0u64;
        let mut buf = vec![0u8; 4096];

        pump(&mut file, &mut table, &mut pos, &mut buf);
        assert_eq!(table.len(), 0, "sin salto de línea no hay entrada");

        let mut writer = std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap();
        writeln!(writer, " y termina").unwrap();
        writer.flush().unwrap();

        pump(&mut file, &mut table, &mut pos, &mut buf);
        assert_eq!(table.len(), 1);
        assert_eq!(table.row(0).line_no, 1);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn detecta_truncado() {
        assert!(is_truncated(0, 500));
        assert!(is_truncated(499, 500));
        assert!(!is_truncated(500, 500));
        assert!(!is_truncated(900, 500));
    }
}
