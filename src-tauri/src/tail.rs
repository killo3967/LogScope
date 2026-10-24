use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
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

/// Seguimiento de una fuente: su fichero abierto, la posición de lectura y la
/// identidad con la que se detecta la rotación. Una vista combinada lleva uno
/// por fichero.
struct Seguimiento {
    path: PathBuf,
    file: std::fs::File,
    pos: u64,
    identity: Option<std::time::SystemTime>,
}

impl Seguimiento {
    /// Abre el fichero y arranca desde lo ya ingerido al abrir la sesión.
    fn nuevo(path: PathBuf, consumido: u64) -> std::io::Result<Seguimiento> {
        let file = std::fs::File::open(&path)?;
        Ok(Seguimiento {
            identity: file_identity(&path),
            path,
            file,
            pos: consumido,
        })
    }

    /// Detecta rotación (otro fichero en la misma ruta) y truncado, y deja el
    /// fichero listo para leer desde el principio. Devuelve `true` si la tabla
    /// de esa fuente hay que reiniciarla.
    fn renovar(&mut self) -> bool {
        let mut reiniciar = false;

        let current_identity = file_identity(&self.path);
        if current_identity != self.identity {
            self.identity = current_identity;
            if let Ok(file) = std::fs::File::open(&self.path) {
                self.file = file;
            }
            self.pos = 0;
            reiniciar = true;
        }

        if let Ok(meta) = std::fs::metadata(&self.path) {
            if is_truncated(meta.len(), self.pos) {
                self.pos = 0;
                if self.file.seek(SeekFrom::Start(0)).is_err() {
                    if let Ok(file) = std::fs::File::open(&self.path) {
                        self.file = file;
                    }
                }
                reiniciar = true;
            }
        }

        reiniciar
    }
}

/// Sigue en un hilo propio **todas** las fuentes de la sesión: sondeo del
/// tamaño de cada fichero, detección de truncado y de rotación por fuente e
/// ingesta incremental.
///
/// Con **una sola fuente** se comporta como siempre: `sync_single_source`, que
/// empuja índices al final porque el orden de lectura ya es el de instante.
/// Con **varias**, cada vuelta lee lo nuevo de todas y llama una sola vez a
/// `LogSet::sync_merged`, que intercala por instante real; al rotar o truncar
/// una fuente se reinicia su tabla y se reconstruye el orden.
pub fn spawn(app: AppHandle, session: Arc<Session>) {
    thread::spawn(move || {
        let merged = match session.set.lock() {
            Ok(set) => set.is_merged(),
            Err(poisoned) => poisoned.into_inner().is_merged(),
        };

        let mut seguimientos: Vec<Seguimiento> = Vec::with_capacity(session.paths.len());
        for (index, path) in session.paths.iter().enumerate() {
            let consumido = {
                let set = match session.set.lock() {
                    Ok(set) => set,
                    Err(poisoned) => poisoned.into_inner(),
                };
                set.sources
                    .get(index)
                    .map(|source| source.table.consumed())
                    .unwrap_or(0)
            };
            match Seguimiento::nuevo(path.clone(), consumido) {
                Ok(seguimiento) => seguimientos.push(seguimiento),
                Err(_) => {
                    // Sin poder abrir una fuente no se puede seguir la vista.
                    session.tail_running.store(false, Ordering::SeqCst);
                    return;
                }
            }
        }

        if seguimientos.is_empty() {
            session.tail_running.store(false, Ordering::SeqCst);
            return;
        }

        let mut buf = vec![0u8; CHUNK];

        while !session.tail_stop.load(Ordering::SeqCst) {
            let mut appended = 0u64;

            for (index, seguimiento) in seguimientos.iter_mut().enumerate() {
                if seguimiento.renovar() {
                    if let Ok(mut set) = session.set.lock() {
                        if merged {
                            set.reset_source(index);
                        } else {
                            set.reset_single_source();
                        }
                    }
                }

                let leidos = {
                    let mut set = match session.set.lock() {
                        Ok(set) => set,
                        Err(poisoned) => poisoned.into_inner(),
                    };
                    match set.sources.get_mut(index) {
                        Some(source) => pump(
                            &mut seguimiento.file,
                            &mut source.table,
                            &mut seguimiento.pos,
                            &mut buf,
                        ),
                        None => 0,
                    }
                };
                appended += leidos;
            }

            if appended > 0 {
                // Una sola sincronización por vuelta, no una por fuente: con
                // varias fuentes el orden se toca una vez. En la vista combinada
                // se informa además de la primera fila insertada, para que la
                // interfaz sepa si tiene que descartar la selección.
                let insertada = match session.set.lock() {
                    Ok(mut set) => {
                        if merged {
                            set.sync_merged()
                        } else {
                            set.sync_single_source();
                            None
                        }
                    }
                    Err(poisoned) => {
                        let mut set = poisoned.into_inner();
                        if merged {
                            set.sync_merged()
                        } else {
                            set.sync_single_source();
                            None
                        }
                    }
                };
                let _ = app.emit(
                    "log://appended",
                    serde_json::json!({
                        "sessionId": session.id,
                        "bytes": appended,
                        "insertAt": insertada,
                    }),
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
