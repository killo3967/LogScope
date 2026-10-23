pub mod columnizers;
pub mod fsbrowse;
pub mod index;
pub mod model;
pub mod parser;
mod tail;

use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::index::{EntryTable, Filters, LogSet, Source};
use crate::model::Row;
use crate::parser::{
    AutoParser, BasicParser, DsvParser, LogParser, LogfmtParser, PatternParser, Role,
};
use crate::columnizers::{
    ClfParser, GlassfishParser, JsonParser, Log4jXmlParser, SquareBracketParser, WebsphereParser,
};

const HEAD: usize = 64 * 1024;
const CHUNK: usize = 1024 * 1024;

pub struct Session {
    pub id: String,
    /// Primer fichero: es el que sigue el tail en vivo.
    pub path: PathBuf,
    pub set: Arc<Mutex<LogSet>>,
    pub tail_stop: Arc<AtomicBool>,
    pub tail_running: Arc<AtomicBool>,
}

impl Session {
    fn new(id: String, path: PathBuf, set: LogSet) -> Arc<Session> {
        Arc::new(Session {
            id,
            path,
            set: Arc::new(Mutex::new(set)),
            tail_stop: Arc::new(AtomicBool::new(false)),
            tail_running: Arc::new(AtomicBool::new(false)),
        })
    }
}

fn lock_set(session: &Session) -> std::sync::MutexGuard<'_, LogSet> {
    match session.set.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

#[derive(Default)]
pub struct AppState {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
}

#[derive(Debug, Deserialize)]
pub struct OpenOptions {
    pub path: String,
    /// `auto` (por defecto), `basic`, `dsv` o `pattern`.
    pub parser: Option<String>,
    pub pattern: Option<String>,
    pub delimiter: Option<String>,
    /// Papel de cada sub-línea de la entrada, fijado a mano:
    /// `time | level | thread | tag | logger | message | ignore`.
    pub mapping: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct OpenResult {
    pub session_id: String,
    pub parser: String,
    pub entries: usize,
    pub bytes: u64,
    /// Solo los campos que el fichero trae de verdad.
    pub fields: Vec<String>,
    /// Ficheros que forman la sesión (uno o varios si están combinados).
    pub sources: Vec<String>,
    pub merged: bool,
    /// Sub-líneas de la primera entrada, para el editor de columnas.
    pub sample_lines: Vec<String>,
    /// Propuesta de papel por sub-línea.
    pub proposed_mapping: Vec<String>,
}

#[derive(Serialize)]
pub struct PageResult {
    pub total: usize,
    pub start: usize,
    pub rows: Vec<Row>,
}

#[derive(Serialize)]
pub struct Stats {
    pub entries: usize,
    pub bytes: u64,
    pub tailing: bool,
}

fn head_lines(head: &[u8], max: usize) -> Vec<String> {
    let text = String::from_utf8_lossy(head);
    text.split('\n')
        .map(|line| line.trim_end_matches('\r').trim_start_matches('\u{feff}').to_string())
        .filter(|line| !line.trim().is_empty())
        .take(max)
        .collect()
}

fn build_parser(options: &OpenOptions, head: &[u8]) -> Result<Arc<dyn LogParser>, String> {
    // Por defecto, automático: agrupa entradas de varias líneas y, en logs de
    // una sola línea, se comporta como `basic`.
    let kind = options.parser.as_deref().unwrap_or("auto");
    let sample = head_lines(head, 30);
    match kind {
        "auto" => {
            if let Some(roles) = options.mapping.as_ref() {
                let mapping = roles
                    .iter()
                    .map(|role| Role::from_str(role))
                    .collect::<Vec<Role>>();
                return Ok(AutoParser::with_mapping(Some(mapping)));
            }
            // Sin instantes en las primeras líneas no hay forma de agrupar:
            // cada línea es una entrada (YAML de compilación, texto libre).
            let logfmt = sample
                .iter()
                .filter(|line| parser::looks_like_logfmt(line))
                .count();
            if !sample.is_empty() && logfmt * 2 >= sample.len() {
                return Ok(LogfmtParser::new());
            }

            let con_instante = sample.iter().filter(|line| parser::has_timestamp(line)).count();

            // Columnizers de LogExpert que necesitan parser propio. Se prueban
            // antes del parser genérico y ninguno pisa a los ya soportados.
            if !sample.is_empty() {
                let hits = |detector: fn(&str) -> bool| {
                    sample.iter().filter(|line| detector(line)).count()
                };
                let mitad = sample.len().div_ceil(2);

                if hits(columnizers::looks_like_json) >= mitad {
                    return Ok(JsonParser::new());
                }
                if hits(columnizers::looks_like_log4jxml) > 0 {
                    return Ok(Log4jXmlParser::new());
                }
                if hits(columnizers::looks_like_glassfish) >= mitad {
                    return Ok(GlassfishParser::new());
                }
                if hits(columnizers::looks_like_clf) >= mitad {
                    return Ok(ClfParser::new());
                }
                if hits(columnizers::looks_like_websphere) >= mitad {
                    return Ok(WebsphereParser::new());
                }
                if hits(columnizers::looks_like_square_bracket) >= mitad {
                    return Ok(SquareBracketParser::new());
                }
            }

            if con_instante == 0 {
                Ok(AutoParser::plain())
            } else {
                Ok(AutoParser::new())
            }
        }
        "logfmt" => Ok(LogfmtParser::new()),
        "json" => Ok(JsonParser::new()),
        "clf" => Ok(ClfParser::new()),
        "squarebracket" => Ok(SquareBracketParser::new()),
        "log4jxml" => Ok(Log4jXmlParser::new()),
        "glassfish" => Ok(GlassfishParser::new()),
        "websphere" => Ok(WebsphereParser::new()),
        "basic" => Ok(BasicParser::new()),
        "pattern" => {
            let pattern = options
                .pattern
                .as_deref()
                .ok_or("el parser pattern necesita el campo pattern")?;
            PatternParser::new(pattern)
        }
        "dsv" => {
            let delim = options
                .delimiter
                .as_deref()
                .and_then(|d| d.chars().next())
                .unwrap_or(',');
            Ok(DsvParser::with_detection(delim, &sample))
        }
        other => Err(format!("parser desconocido: {other}")),
    }
}

/// Carga un fichero por bloques: la cabecera primero, para deducir el parser.
fn load_source(path: &PathBuf, options: &OpenOptions) -> Result<EntryTable, String> {
    let mut file = std::fs::File::open(path).map_err(|e| format!("no se puede abrir: {e}"))?;

    let mut head = vec![0u8; HEAD];
    let read = file.read(&mut head).map_err(|e| e.to_string())?;
    head.truncate(read);

    let parser = build_parser(options, &head)?;
    let mut table = EntryTable::new(parser);
    table.ingest_bytes(&head);

    let mut buf = vec![0u8; CHUNK];
    loop {
        match file.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => table.ingest_bytes(&buf[..n]),
            Err(e) => return Err(format!("error de lectura: {e}")),
        }
    }
    Ok(table)
}

/// Carga una o varias fuentes y las combina en orden de instante. Cada fichero
/// lleva su propio parser, así que se pueden mezclar formatos distintos.
fn load_sources(paths: &[PathBuf], options: &OpenOptions) -> Result<LogSet, String> {
    let mut sources: Vec<Source> = Vec::with_capacity(paths.len());
    let combinando = paths.len() > 1;
    for path in paths {
        let table = load_source(path, options)?;
        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string_lossy().into_owned());

        // Al combinar, una fuente sin instante no se puede intercalar: acabaría
        // amontonada al final y el orden dejaría de tener sentido. Se rechaza
        // en vez de devolver una vista combinada que engaña. Un fichero vacío
        // no es un problema: no aporta líneas.
        if combinando && !table.is_empty() && !table.has_timestamps() {
            return Err(format!(
                "no se puede combinar: {name} no tiene columna de fecha y hora"
            ));
        }

        sources.push(Source { name, table });
    }
    Ok(LogSet::new(sources))
}

/// Atajo público para que los tests usen exactamente la misma detección que la
/// aplicación al abrir un fichero.
pub fn deteccion_automatica(head: &[u8]) -> Arc<dyn LogParser> {
    let options = OpenOptions {
        path: String::new(),
        parser: None,
        pattern: None,
        delimiter: None,
        mapping: None,
    };
    build_parser(&options, head).unwrap_or_else(|_| AutoParser::new())
}

fn get_session(state: &AppState, id: &str) -> Result<Arc<Session>, String> {
    let sessions = match state.sessions.lock() {
        Ok(s) => s,
        Err(p) => p.into_inner(),
    };
    sessions
        .get(id)
        .cloned()
        .ok_or_else(|| format!("sesión desconocida: {id}"))
}

#[tauri::command]
fn open_files(
    state: State<'_, AppState>,
    paths: Vec<String>,
    options: OpenOptions,
) -> Result<OpenResult, String> {
    if paths.is_empty() {
        return Err("no se indicó ningún fichero".to_string());
    }

    let mut files: Vec<PathBuf> = Vec::with_capacity(paths.len());
    for raw in &paths {
        let path = PathBuf::from(raw);
        if !path.is_file() {
            return Err(format!("no es un fichero: {raw}"));
        }
        files.push(path);
    }

    let set = load_sources(&files, &options)?;
    let id = uuid::Uuid::new_v4().to_string();

    // Primera entrada troceada, para que la UI pueda proponer y editar el mapeo.
    let first_raw = if set.len() > 0 {
        set.row(0).raw
    } else {
        String::new()
    };
    let sample_lines: Vec<String> = first_raw.split('\n').map(|line| line.to_string()).collect();
    let proposed_mapping = if sample_lines.len() > 1 {
        let refs: Vec<&str> = sample_lines.iter().map(|line| line.as_str()).collect();
        parser::propose_mapping(&refs)
            .iter()
            .map(|role| role.as_str().to_string())
            .collect()
    } else {
        Vec::new()
    };

    let result = OpenResult {
        session_id: id.clone(),
        parser: set.parser_name(),
        entries: set.len(),
        bytes: set.consumed(),
        fields: set.present_fields(200),
        sources: set.source_names(),
        merged: set.is_merged(),
        sample_lines,
        proposed_mapping,
    };

    let session = Session::new(id.clone(), files[0].clone(), set);
    let mut sessions = match state.sessions.lock() {
        Ok(s) => s,
        Err(p) => p.into_inner(),
    };
    sessions.insert(id, session);
    Ok(result)
}

#[tauri::command]
fn open_file(state: State<'_, AppState>, options: OpenOptions) -> Result<OpenResult, String> {
    let path = options.path.clone();
    open_files(state, vec![path], options)
}

#[tauri::command]
fn read_page(
    state: State<'_, AppState>,
    session_id: String,
    start: usize,
    count: usize,
    filters: Option<Filters>,
) -> Result<PageResult, String> {
    let session = get_session(&state, &session_id)?;
    let filters = filters.unwrap_or_default();
    let set = lock_set(&session);
    let visible = set.visible(&filters);
    let rows = set.page(&visible, start, count);
    Ok(PageResult {
        total: visible.len(),
        start,
        rows,
    })
}

#[tauri::command]
fn start_tail(app: AppHandle, state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let session = get_session(&state, &session_id)?;
    if lock_set(&session).is_merged() {
        return Err(
            "el tail en vivo solo está disponible con un único fichero: en una vista \
             combinada el orden se recalcularía en cada línea"
                .to_string(),
        );
    }
    if session
        .tail_running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }
    session.tail_stop.store(false, Ordering::SeqCst);
    tail::spawn(app, Arc::clone(&session));
    Ok(())
}

#[tauri::command]
fn stop_tail(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let session = get_session(&state, &session_id)?;
    session.tail_stop.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn stats(state: State<'_, AppState>, session_id: String) -> Result<Stats, String> {
    let session = get_session(&state, &session_id)?;
    let (entries, bytes) = {
        let set = lock_set(&session);
        (set.len(), set.consumed())
    };
    Ok(Stats {
        entries,
        bytes,
        tailing: session.tail_running.load(Ordering::SeqCst),
    })
}

#[tauri::command]
fn close_session(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    let session = get_session(&state, &session_id)?;
    session.tail_stop.store(true, Ordering::SeqCst);
    let mut sessions = match state.sessions.lock() {
        Ok(s) => s,
        Err(p) => p.into_inner(),
    };
    sessions.remove(&session_id);
    Ok(())
}

#[tauri::command]
fn list_dir(path: String) -> Result<fsbrowse::DirListing, String> {
    fsbrowse::list_dir(std::path::Path::new(&path))
}

#[tauri::command]
fn list_roots() -> Vec<fsbrowse::DirEntryInfo> {
    fsbrowse::list_roots()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            open_file,
            open_files,
            read_page,
            start_tail,
            stop_tail,
            stats,
            close_session,
            list_dir,
            list_roots
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar LogScope");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn escribe(nombre: &str, contenido: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("logscope-combinar-{nombre}.log"));
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(contenido.as_bytes()).unwrap();
        path
    }

    fn opciones() -> OpenOptions {
        OpenOptions {
            path: String::new(),
            parser: None,
            pattern: None,
            delimiter: None,
            mapping: None,
        }
    }

    #[test]
    fn rechaza_combinar_una_fuente_sin_instante() {
        let con = escribe("con", "2026-10-22 10:00:00 INFO con hora\n");
        let sin = escribe("sin", "linea suelta sin instante\n");

        // LogSet no implementa Debug, así que expect_err no vale aquí.
        let error = match load_sources(&[con.clone(), sin.clone()], &opciones()) {
            Ok(_) => panic!("una fuente sin instante no se puede intercalar"),
            Err(error) => error,
        };

        assert!(error.contains("no se puede combinar"), "{error}");
        assert!(error.contains("no tiene columna de fecha y hora"), "{error}");
        assert!(error.contains("logscope-combinar-sin"), "el error debe nombrar el fichero: {error}");

        let _ = std::fs::remove_file(con);
        let _ = std::fs::remove_file(sin);
    }

    #[test]
    fn combina_dos_fuentes_con_instante() {
        let a = escribe("a", "2026-10-22 10:00:00 INFO primera\n");
        let b = escribe("b", "2026-10-22 10:00:01 INFO segunda\n");

        let set = load_sources(&[a.clone(), b.clone()], &opciones()).expect("deberia combinar");
        assert_eq!(set.len(), 2);
        assert!(set.is_merged());
        // Orden cronológico entre fuentes distintas.
        assert!(set.row(0).raw.contains("primera"));
        assert!(set.row(1).raw.contains("segunda"));

        let _ = std::fs::remove_file(a);
        let _ = std::fs::remove_file(b);
    }

    #[test]
    fn un_fichero_suelto_sin_instante_se_sigue_abriendo() {
        // La validación es solo al combinar: abrir un log sin fecha y hora debe
        // seguir funcionando, que es el caso de los logs de texto libre.
        let sin = escribe("solo", "linea suelta sin instante\n");
        let set = load_sources(&[sin.clone()], &opciones()).expect("un fichero suelto se abre");
        assert_eq!(set.len(), 1);
        assert!(!set.is_merged());
        let _ = std::fs::remove_file(sin);
    }
}
