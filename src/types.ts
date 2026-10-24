import { idiomaDelSistema, type Idioma } from "./textos";

export type Level =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "unknown";

export interface Field {
  name: string;
  value: string;
}

export interface Row {
  index: number;
  line_no: number;
  /** Hora de pared del fichero (no es un instante): solo para ordenar y comparar. */
  ts_ms: number | null;
  /** Los dígitos del fichero, ya formateados: `2026-10-22`. */
  fecha: string | null;
  /** Los dígitos del fichero, ya formateados: `08:19:59.826`. */
  hora: string | null;
  level: Level;
  raw: string;
  fields: Field[];
  /** Fichero de origen; vacío si la sesión tiene una sola fuente. */
  source: string;
}

export interface OpenResult {
  session_id: string;
  parser: string;
  /** Codificación con la que se ha leído, ya resuelta (`utf16le`, `cp850`…). */
  encoding: string;
  entries: number;
  bytes: number;
  fields: string[];
  sources: string[];
  merged: boolean;
  sample_lines: string[];
  proposed_mapping: string[];
}

/** Regla de color aplicada a filas o a coincidencias dentro de una celda. */
export interface HighlightRule {
  id: string;
  pattern: string;
  isRegex: boolean;
  target: "row" | "word";
  color: string;
  /**
   * Distinguir mayúsculas y minúsculas. Opcional: las reglas guardadas antes
   * de existir esta casilla llegan sin el campo y se comportan como antes
   * (sin distinguir), que es donde estaban acostumbrados.
   */
  caseSensitive?: boolean;
}

export const COLUMN_WIDTHS: Record<string, number> = {
  Date: 104,
  Time: 120,
  Level: 88,
  Thread: 88,
  Tag: 150,
  Logger: 300,
  Message: 620,
  Source: 140,
  Host: 130,
  Request: 280,
  Status: 70,
  Extra: 400,
};
export const DEFAULT_COLUMN_WIDTH = 180;

export interface PageResult {
  total: number;
  start: number;
  rows: Row[];
}

export interface Filters {
  levels: number | null;
  text: string | null;
}

export interface Stats {
  entries: number;
  bytes: number;
  tailing: boolean;
}

export interface DirEntryInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export interface DirListing {
  path: string;
  parent: string | null;
  entries: DirEntryInfo[];
  truncated: boolean;
}

export type ParserKind =
  | "auto"
  | "basic"
  | "logfmt"
  | "json"
  | "clf"
  | "squarebracket"
  | "log4jxml"
  | "glassfish"
  | "websphere"
  | "dsv"
  | "pattern";

/**
 * Codificación pedida al abrir. `auto` deja que el núcleo la deduzca; el resto
 * la fuerza, que es la única salida cuando la detección no puede acertar: las
 * páginas de un solo byte comparten los mismos bytes con significados
 * distintos.
 */
export type EncodingKind =
  | "auto"
  | "utf8"
  | "utf16le"
  | "utf16be"
  | "utf32le"
  | "utf32be"
  | "windows1252"
  | "windows1250"
  | "windows1251"
  | "cp850"
  | "cp437"
  | "iso8859-15"
  | "koi8-r"
  | "shift_jis"
  | "gbk"
  | "big5"
  | "euc-jp";

/**
 * Codificaciones ofrecidas en el desplegable, en orden. Aquí solo va el valor
 * que entiende el núcleo; los nombres visibles están en el catálogo de textos
 * (`props.encoding.<valor>`).
 */
export const ENCODINGS: EncodingKind[] = [
  "auto",
  "utf8",
  "utf16le",
  "utf16be",
  "utf32le",
  "utf32be",
  "windows1252",
  "windows1250",
  "windows1251",
  "cp850",
  "cp437",
  "iso8859-15",
  "koi8-r",
  "shift_jis",
  "gbk",
  "big5",
  "euc-jp",
];

export const LEVELS: Level[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "unknown",
];

/** Debe coincidir con `Level::bit()` del núcleo. */
export const LEVEL_BIT: Record<Level, number> = {
  trace: 1,
  debug: 2,
  info: 4,
  warn: 8,
  error: 16,
  fatal: 32,
  unknown: 64,
};

export const ALL_LEVELS = 127;

/**
 * Fecha de un **instante** en la zona del navegador. El grid ya no la usa: pinta
 * `Row.fecha`, que son los dígitos del fichero. Se conserva para otras vistas.
 */
export function formatDate(ts: number | null): string {
  if (ts === null) return "";
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Hora de un **instante**; el grid pinta `Row.hora`. Ver `formatDate`. */
export function formatClock(ts: number | null): string {
  if (ts === null) return "";
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(
    d.getMilliseconds(),
    3,
  )}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * Receta del último conjunto de logs abierto. Guarda las opciones con las que
 * se abrió, no solo las rutas: sin el parser ni el mapeo, reabrir al arrancar
 * daría columnas distintas a las de la sesión anterior.
 */
export interface LastOpen {
  paths: string[];
  parser: ParserKind;
  /** Minutos de desplazamiento respecto de UTC; `null` o ausente = zona del equipo. */
  zonaHoraria?: number | null;
  pattern: string;
  delimiter: string;
  mapping: string[] | null;
  /** Opcional: las recetas guardadas antes de existir la codificación no lo traen. */
  encoding?: EncodingKind;
}

export interface Settings {
  /** Idioma de la interfaz. */
  idioma: Idioma;
  rememberLastOpened: boolean;
  lastOpen: LastOpen | null;
  /** Arrancar y abrir cada log con el tail en vivo ya en marcha. */
  startWithTail: boolean;
  /** Arrancar con el autoscroll marcado. */
  startWithAutoScroll: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  idioma: idiomaDelSistema(),
  rememberLastOpened: true,
  lastOpen: null,
  // Por defecto se mantiene el comportamiento de siempre: sin tail y con
  // autoscroll, para que activar estas opciones sea una decision explicita.
  startWithTail: false,
  startWithAutoScroll: true,
};

/**
 * Clave estable de un conjunto de logs: sus rutas normalizadas y ordenadas.
 * Las reglas de color y cualquier preferencia por fichero se guardan con esta
 * clave, así que sobreviven a reabrir el log (el id de sesión cambia).
 */
export function sourceKey(paths: string[]): string {
  return paths
    .map((path) => path.replace(/\//g, "\\").toLowerCase())
    .sort()
    .join("|");
}
