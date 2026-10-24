import type { EncodingKind, ParserKind, Level } from "./types";
import { ENCODINGS, LEVELS, LEVEL_BIT } from "./types";

interface Props {
  path: string;
  onPathChange: (value: string) => void;
  parser: ParserKind;
  onParserChange: (value: ParserKind) => void;
  encoding: EncodingKind;
  onEncodingChange: (value: EncodingKind) => void;
  /** Codificación que el núcleo detectó al abrir, para mostrarla en el título. */
  detectedEncoding: string | null;
  pattern: string;
  onPatternChange: (value: string) => void;
  delimiter: string;
  onDelimiterChange: (value: string) => void;
  onOpen: () => void;
  onBrowse: () => void;
  onColumns: () => void;
  columnsEnabled: boolean;
  onRules: () => void;
  rulesCount: number;
  mask: number;
  onMaskChange: (value: number) => void;
  text: string;
  onTextChange: (value: string) => void;
  tailing: boolean;
  tailEnabled: boolean;
  onToggleTail: () => void;
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  onSettings: () => void;
  busy: boolean;
  disabled: boolean;
}

export function Toolbar(props: Props) {
  const toggleLevel = (level: Level) => {
    props.onMaskChange(props.mask ^ LEVEL_BIT[level]);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <input
          className="path"
          placeholder="C:\ruta\al\fichero.log"
          value={props.path}
          onChange={(event) => props.onPathChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") props.onOpen();
          }}
        />
        <button onClick={props.onBrowse} disabled={props.busy} title="Navegar por el árbol de directorios">
          Examinar…
        </button>
        <button onClick={props.onOpen} disabled={props.busy || props.path === ""}>
          {props.busy ? "Abriendo…" : "Abrir"}
        </button>
        <button
          onClick={props.onColumns}
          disabled={!props.columnsEnabled}
          title="Asignar cada línea del registro a su columna"
        >
          Columnas…
        </button>
        <button
          onClick={props.onRules}
          title="Colorear filas o palabras según un patrón"
        >
          Reglas{props.rulesCount > 0 ? ` (${props.rulesCount})` : "…"}
        </button>

        <button
          className={props.tailing ? "active" : ""}
          onClick={props.onToggleTail}
          disabled={!props.tailEnabled}
          title={
            props.tailEnabled
              ? "Seguir el fichero en vivo"
              : "No disponible al combinar varios ficheros"
          }
        >
          {props.tailing ? "Detener tail" : "Tail en vivo"}
        </button>

        <label className="check">
          <input
            type="checkbox"
            checked={props.autoScroll}
            onChange={(event) => props.onAutoScrollChange(event.target.checked)}
          />
          Autoscroll
        </label>

        <button className="icon" onClick={props.onSettings} title="Ajustes">
          ⚙
        </button>
      </div>

      <div className="toolbar-row">
        <input
          className="filter"
          placeholder="Filtrar por texto…"
          value={props.text}
          onChange={(event) => props.onTextChange(event.target.value)}
          disabled={props.disabled}
        />
        <div className="levels">
          {LEVELS.map((level) => (
            <button
              key={level}
              className={`chip level-${level} ${
                props.mask & LEVEL_BIT[level] ? "on" : "off"
              }`}
              onClick={() => toggleLevel(level)}
            >
              {level}
            </button>
          ))}
        </div>

        {props.parser === "dsv" && (
          <input
            className="small"
            value={props.delimiter}
            maxLength={1}
            onChange={(event) => props.onDelimiterChange(event.target.value)}
            title="Delimitador"
          />
        )}
        {props.parser === "pattern" && (
          <input
            className="pattern"
            value={props.pattern}
            onChange={(event) => props.onPatternChange(event.target.value)}
            title="Regex con grupos con nombre"
          />
        )}

        {/* Formato y codificación van a la derecha de la segunda fila: la
            primera ya tiene ruta, botones y seguimiento. */}
        <div className="toolbar-right">
          <label className="field">
            <span className="field-label">Formato</span>
            <select
              value={props.parser}
              onChange={(event) =>
                props.onParserChange(event.target.value as ParserKind)
              }
              title="Cómo interpretar cada línea del fichero"
            >
              <option value="auto">auto</option>
              <option value="basic">basic</option>
              <option value="logfmt">logfmt</option>
              <option value="json">json</option>
              <option value="clf">clf</option>
              <option value="squarebracket">squarebracket</option>
              <option value="log4jxml">log4jxml</option>
              <option value="glassfish">glassfish</option>
              <option value="websphere">websphere</option>
              <option value="dsv">dsv</option>
              <option value="pattern">pattern</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Codificación</span>
            <select
              value={props.encoding}
              onChange={(event) =>
                props.onEncodingChange(event.target.value as EncodingKind)
              }
              title={
                props.detectedEncoding
                  ? `Detectada en el log abierto: ${props.detectedEncoding}`
                  : "Codificación de los bytes del fichero"
              }
            >
              {ENCODINGS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
