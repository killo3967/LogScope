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
  ts_ms: number | null;
  level: Level;
  raw: string;
  fields: Field[];
  /** Fichero de origen; vacío si la sesión tiene una sola fuente. */
  source: string;
}

export interface OpenResult {
  session_id: string;
  parser: string;
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
}

export const COLUMN_WIDTHS: Record<string, number> = {
  Time: 176,
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

export function formatTs(ts: number | null): string {
  if (ts === null) return "";
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.` +
    `${pad(d.getMilliseconds(), 3)}`
  );
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
