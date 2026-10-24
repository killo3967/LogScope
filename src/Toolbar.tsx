import type { EncodingKind, ParserKind, Level } from "./types";
import { ENCODINGS, LEVELS, LEVEL_BIT } from "./types";
import { t } from "./textos";

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
          placeholder={t("toolbar.rutaPlaceholder")}
          value={props.path}
          onChange={(event) => props.onPathChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") props.onOpen();
          }}
        />
        <button
          onClick={props.onBrowse}
          disabled={props.busy}
          title={t("toolbar.examinarTooltip")}
        >
          {t("toolbar.examinar")}
        </button>
        <button onClick={props.onOpen} disabled={props.busy || props.path === ""}>
          {props.busy ? t("toolbar.abriendo") : t("toolbar.abrir")}
        </button>
        <button
          onClick={props.onColumns}
          disabled={!props.columnsEnabled}
          title={t("toolbar.columnasTooltip")}
        >
          {t("toolbar.columnas")}
        </button>
        <button
          onClick={props.onRules}
          title={t("toolbar.reglasTooltip")}
        >
          {props.rulesCount > 0
            ? t("toolbar.reglasN", { n: props.rulesCount })
            : t("toolbar.reglasVacio")}
        </button>

        <button
          className={props.tailing ? "active" : ""}
          onClick={props.onToggleTail}
          disabled={!props.tailEnabled}
          title={
            props.tailEnabled
              ? t("toolbar.tailSeguirTooltip")
              : t("toolbar.tailNoDisponibleTooltip")
          }
        >
          {props.tailing ? t("toolbar.detenerTail") : t("toolbar.tailEnVivo")}
        </button>

        <label className="check">
          <input
            type="checkbox"
            checked={props.autoScroll}
            onChange={(event) => props.onAutoScrollChange(event.target.checked)}
          />
          {t("toolbar.autoscroll")}
        </label>

        <button className="icon" onClick={props.onSettings} title={t("toolbar.ajustesTooltip")}>
          ⚙
        </button>
      </div>

      <div className="toolbar-row">
        <input
          className="filter"
          placeholder={t("toolbar.filtroPlaceholder")}
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
            title={t("toolbar.delimitadorTooltip")}
          />
        )}
        {props.parser === "pattern" && (
          <input
            className="pattern"
            value={props.pattern}
            onChange={(event) => props.onPatternChange(event.target.value)}
            title={t("toolbar.patronTooltip")}
          />
        )}

        {/* Formato y codificación van a la derecha de la segunda fila: la
            primera ya tiene ruta, botones y seguimiento. */}
        <div className="toolbar-right">
          <label className="field">
            <span className="field-label">{t("toolbar.formato")}</span>
            <select
              value={props.parser}
              onChange={(event) =>
                props.onParserChange(event.target.value as ParserKind)
              }
              title={t("toolbar.formatoTooltip")}
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
            <span className="field-label">{t("toolbar.codificacion")}</span>
            <select
              value={props.encoding}
              onChange={(event) =>
                props.onEncodingChange(event.target.value as EncodingKind)
              }
              title={
                props.detectedEncoding
                  ? t("toolbar.codificacionDetectadaTooltip", {
                      encoding: props.detectedEncoding,
                    })
                  : t("toolbar.codificacionTooltip")
              }
            >
              {ENCODINGS.map((option) => (
                <option key={option} value={option}>
                  {t(`toolbar.encoding.${option}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
