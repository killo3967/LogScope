use std::path::{Path, PathBuf};

use serde::Serialize;

/// Tope defensivo: un directorio con 300 000 entradas (p. ej. `node_modules`)
/// no debe bloquear la UI ni llenar el puente IPC.
const MAX_ENTRIES: usize = 5_000;

#[derive(Debug, Clone, Serialize)]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
pub struct DirListing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<DirEntryInfo>,
    pub truncated: bool,
}

/// Lista un único nivel del sistema de ficheros. El árbol se construye por
/// expansión perezosa: cada nodo pide sus hijos solo cuando se abre.
pub fn list_dir(path: &Path) -> Result<DirListing, String> {
    let meta = std::fs::metadata(path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !meta.is_dir() {
        return Err(format!("no es un directorio: {}", path.display()));
    }

    let read = std::fs::read_dir(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut entries = Vec::new();
    let mut truncated = false;

    for item in read {
        let Ok(item) = item else { continue };
        if entries.len() >= MAX_ENTRIES {
            truncated = true;
            break;
        }
        // Un enlace roto o un fichero sin permisos no debe romper el listado.
        let Ok(meta) = item.metadata() else { continue };
        entries.push(DirEntryInfo {
            name: item.file_name().to_string_lossy().into_owned(),
            path: item.path().to_string_lossy().into_owned(),
            is_dir: meta.is_dir(),
            size: if meta.is_file() { meta.len() } else { 0 },
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(DirListing {
        path: path.to_string_lossy().into_owned(),
        parent: path.parent().map(|p| p.to_string_lossy().into_owned()),
        entries,
        truncated,
    })
}

/// Máscara de unidades existentes según el sistema.
///
/// No se usa `is_dir()` por unidad: en una unidad que no está lista (lector
/// vacío, volumen desconectado) cualquier acceso al sistema de ficheros falla
/// y la unidad desaparecería del árbol aunque exista.
#[cfg(windows)]
fn drive_mask() -> u32 {
    extern "system" {
        fn GetLogicalDrives() -> u32;
    }
    // `GetLogicalDrives` solo consulta la tabla de unidades montadas.
    unsafe { GetLogicalDrives() }
}

#[cfg(not(windows))]
fn drive_mask() -> u32 {
    0
}

/// Puntos de partida del árbol: unidades del sistema y carpetas del perfil.
pub fn list_roots() -> Vec<DirEntryInfo> {
    let mut roots = Vec::new();

    let mask = drive_mask();
    for letter in 0..26u32 {
        if mask & (1 << letter) == 0 {
            continue;
        }
        let root = format!("{}:\\", (b'A' + letter as u8) as char);
        roots.push(DirEntryInfo {
            name: root.clone(),
            path: root,
            is_dir: true,
            size: 0,
        });
    }

    if let Ok(profile) = std::env::var("USERPROFILE") {
        let base = PathBuf::from(&profile);
        for (label, sub) in [
            ("Escritorio", "Desktop"),
            ("Descargas", "Downloads"),
            ("Documentos", "Documents"),
        ] {
            let candidate = base.join(sub);
            if candidate.is_dir() {
                roots.push(DirEntryInfo {
                    name: label.to_string(),
                    path: candidate.to_string_lossy().into_owned(),
                    is_dir: true,
                    size: 0,
                });
            }
        }
        roots.push(DirEntryInfo {
            name: "Perfil".to_string(),
            path: profile.clone(),
            is_dir: true,
            size: 0,
        });
    }

    roots
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(nombre: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("logscope-fs-{nombre}"));
        let _ = std::fs::remove_dir_all(&path);
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn lista_directorios_antes_que_ficheros() {
        let dir = temp_dir("orden");
        std::fs::write(dir.join("b.log"), b"12345").unwrap();
        std::fs::write(dir.join("A.log"), b"1").unwrap();
        std::fs::create_dir(dir.join("sub")).unwrap();

        let listing = list_dir(&dir).unwrap();
        let nombres: Vec<&str> = listing.entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(nombres, vec!["sub", "A.log", "b.log"]);
        assert!(listing.entries[0].is_dir);
        assert_eq!(listing.entries[2].size, 5);
        assert!(!listing.truncated);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn rechaza_un_fichero() {
        let dir = temp_dir("fichero");
        let file = dir.join("x.log");
        std::fs::write(&file, b"contenido").unwrap();

        let error = list_dir(&file).unwrap_err();
        assert!(error.contains("no es un directorio"), "error inesperado: {error}");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn informa_del_padre() {
        let dir = temp_dir("padre");
        std::fs::create_dir(dir.join("hijo")).unwrap();
        let listing = list_dir(&dir.join("hijo")).unwrap();
        assert_eq!(listing.parent.as_deref(), Some(dir.to_string_lossy().as_ref()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn las_raices_incluyen_alguna_unidad() {
        let roots = list_roots();
        println!("raíces del árbol:");
        for root in &roots {
            println!("  {} -> {}", root.name, root.path);
        }
        assert!(!roots.is_empty(), "debe haber al menos una unidad");
        assert!(roots.iter().any(|r| r.path.contains(":\\")));
    }
}
