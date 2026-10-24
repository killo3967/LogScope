use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Trace = 0,
    Debug = 1,
    Info = 2,
    Warn = 3,
    Error = 4,
    Fatal = 5,
    Unknown = 6,
}

impl Default for Level {
    fn default() -> Self {
        Level::Unknown
    }
}

impl Level {
    pub fn as_u8(self) -> u8 {
        self as u8
    }

    pub fn from_u8(v: u8) -> Level {
        match v {
            0 => Level::Trace,
            1 => Level::Debug,
            2 => Level::Info,
            3 => Level::Warn,
            4 => Level::Error,
            5 => Level::Fatal,
            _ => Level::Unknown,
        }
    }

    pub fn bit(self) -> u8 {
        1u8 << (self as u8).min(6)
    }

    /// Nombre del nivel tal y como se escribe en los logs. Lo usa el filtro
    /// avanzado para comparar contra `error`, `warn`…
    pub fn name(self) -> &'static str {
        match self {
            Level::Trace => "trace",
            Level::Debug => "debug",
            Level::Info => "info",
            Level::Warn => "warn",
            Level::Error => "error",
            Level::Fatal => "fatal",
            Level::Unknown => "unknown",
        }
    }
}

pub const ALL_LEVELS: u8 = 0b0111_1111;

#[derive(Debug, Clone, Serialize)]
pub struct Field {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Row {
    pub index: u32,
    pub line_no: u32,
    pub ts_ms: Option<i64>,
    pub level: Level,
    pub raw: String,
    pub fields: Vec<Field>,
    /// Fichero de origen; vacío cuando la sesión tiene una sola fuente.
    pub source: String,
}
