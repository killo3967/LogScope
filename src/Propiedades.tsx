import { useEffect, useState } from "react";

import type { EncodingKind, ParserKind } from "./types";
import { ENCODINGS, formatBytes } from "./types";
import { t } from "./textos";

/**
 * Mismos formatos que ofrecía el desplegable de la barra, en el mismo orden.
 * El valor viaja al núcleo tal cual: no se traduce.
 */
const PARSERS: ParserKind[] = [
  "auto",
  "basic",
  "logfmt",
  "json",
  "clf",
  "squarebracket",
  "log4jxml",
  "glassfish",
  "websphere",
  "dsv",
  "pattern",
];

export interface OpcionesApertura {
  parser: ParserKind;
  pattern: string;
  delimiter: string;
  encoding: EncodingKind;
  /** Minutos respecto de UTC; `null` = zona del equipo. */
  zonaHoraria: number | null;
}

/**
 * Zonas que se ofrecen: la del equipo y desplazamientos fijos. Los nombres de
 * zona con horario de verano necesitarían una dependencia más; un log de
 * servidor suele ir en UTC o en un desfase fijo.
 */
export const ZONAS: { valor: number | null; etiqueta: string }[] = [
  { valor: -480, etiqueta: "UTC−08:00" },
  { valor: -300, etiqueta: "UTC−05:00" },
  { valor: -180, etiqueta: "UTC−03:00" },
  { valor: 0, etiqueta: "UTC" },
  { valor: 60, etiqueta: "UTC+01:00" },
  { valor: 120, etiqueta: "UTC+02:00" },
  { valor: 330, etiqueta: "UTC+05:30" },
  { valor: 480, etiqueta: "UTC+08:00" },
];

interface Props {
  open: boolean;
  /** Rutas del log abierto; varias si es una vista combinada. */
  paths: string[];
  bytes: number;
  lines: number;
  /** Parser y codificación que resolvió el núcleo al abrir (solo lectura). */
  detectedParser: string | null;
  detectedEncoding: string | null;
  /** Opciones con las que se abriría ahora mismo, de partida para los controles. */
  parser: ParserKind;
  pattern: string;
  delimiter: string;
  encoding: EncodingKind;
  zonaHoraria: number | null;
  columnsEnabled: boolean;
  busy: boolean;
  onClose: () => void;
  onColumns: () => void;
  onApply: (opciones: OpcionesApertura) => void;
  /** Cambiar codificación o zona recarga al momento, sin cerrar el panel. */
  onApplyInmediato: (opciones: OpcionesApertura) => void;
}

/**
 * Propiedades del fichero abierto: arriba lo que detectó el núcleo y abajo los
 * controles para volver a abrirlo con otro formato o codificación. El formato se
 * aplica con el botón «Aplicar y recargar»; la codificación recarga sola, que es
 * lo que se espera al corregir una lectura mal decodificada.
 */
export function Propiedades({
  open,
  paths,
  bytes,
  lines,
  detectedParser,
  detectedEncoding,
  parser,
  pattern,
  delimiter,
  encoding,
  zonaHoraria,
  columnsEnabled,
  busy,
  onClose,
  onColumns,
  onApply,
  onApplyInmediato,
}: Props) {
  const [parserDraft, setParserDraft] = useState<ParserKind>(parser);
  const [patternDraft, setPatternDraft] = useState(pattern);
  const [delimiterDraft, setDelimiterDraft] = useState(delimiter);
  const [encodingDraft, setEncodingDraft] = useState<EncodingKind>(encoding);
  const [zonaDraft, setZonaDraft] = useState<number | null>(zonaHoraria);

  // Cada apertura parte de las opciones vigentes; los cambios a medias no se
  // arrastran a la siguiente vez que se abre el panel.
  useEffect(() => {
    if (!open) return;
    setParserDraft(parser);
    setPatternDraft(pattern);
    setDelimiterDraft(delimiter);
    setEncodingDraft(encoding);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sinPestana = paths.length === 0;

  return (
    <div className="browser-backdrop" onClick={onClose}>
      <div className="browser props" onClick={(event) => event.stopPropagation()}>
        <header className="browser-head">
          <strong>{t("props.titulo")}</strong>
          <span className="hint" />
          <button onClick={onClose}>{t("props.cerrar")}</button>
        </header>

        <div className="mapper-body">
          <dl className="props-info">
            <dt className="props-label">{t("props.rutas")}</dt>
            <dd className="props-value">
              <ul className="props-paths">
                {paths.map((ruta) => (
                  <li key={ruta} title={ruta}>
                    {ruta}
                  </li>
                ))}
              </ul>
            </dd>

            <dt className="props-label">{t("props.tamano")}</dt>
            <dd className="props-value">{formatBytes(bytes)}</dd>

            <dt className="props-label">{t("props.lineas")}</dt>
            <dd className="props-value">{lines.toLocaleString("es-ES")}</dd>

            <dt className="props-label">{t("props.parserDetectado")}</dt>
            <dd className="props-value">
              <code>{detectedParser ?? "—"}</code>
            </dd>

            <dt className="props-label">{t("props.codificacionDetectada")}</dt>
            <dd className="props-value">
              <code>{detectedEncoding ?? "—"}</code>
            </dd>
          </dl>

          <div className="props-controls">
            <label className="props-field">
              <span className="props-label">{t("props.formato")}</span>
              <select
                value={parserDraft}
                onChange={(event) =>
                  setParserDraft(event.target.value as ParserKind)
                }
                title={t("props.formatoTooltip")}
              >
                {PARSERS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {parserDraft === "dsv" && (
              <label className="props-field">
                <span className="props-label">{t("props.delimitador")}</span>
                <input
                  className="small"
                  value={delimiterDraft}
                  maxLength={1}
                  onChange={(event) => setDelimiterDraft(event.target.value)}
                  title={t("props.delimitadorTooltip")}
                />
              </label>
            )}

            {parserDraft === "pattern" && (
              <label className="props-field props-field-wide">
                <span className="props-label">{t("props.patron")}</span>
                <input
                  className="pattern"
                  value={patternDraft}
                  onChange={(event) => setPatternDraft(event.target.value)}
                  title={t("props.patronTooltip")}
                />
              </label>
            )}

            <label className="props-field">
              <span className="props-label">{t("props.codificacion")}</span>
              <select
                value={encodingDraft}
                onChange={(event) => {
                  const siguiente = event.target.value as EncodingKind;
                  setEncodingDraft(siguiente);
                  onApplyInmediato({
                    parser: parserDraft,
                    pattern: patternDraft,
                    delimiter: delimiterDraft,
                    encoding: siguiente,
                    zonaHoraria: zonaDraft,
                  });
                }}
                title={t("props.codificacionTooltip")}
              >
                {ENCODINGS.map((option) => (
                  <option key={option} value={option}>
                    {t(`props.encoding.${option}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="props-field">
              <span className="props-label">{t("props.zona")}</span>
              <select
                value={zonaDraft === null ? "equipo" : String(zonaDraft)}
                onChange={(event) => {
                  const valor =
                    event.target.value === "equipo"
                      ? null
                      : Number(event.target.value);
                  setZonaDraft(valor);
                  // Afecta al orden y a los filtros por fecha, así que se aplica
                  // al momento, igual que la codificación.
                  onApplyInmediato({
                    parser: parserDraft,
                    pattern: patternDraft,
                    delimiter: delimiterDraft,
                    encoding: encodingDraft,
                    zonaHoraria: valor,
                  });
                }}
                title={t("props.zonaTooltip")}
              >
                <option value="equipo">{t("props.zonaEquipo")}</option>
                {ZONAS.map((zona) => (
                  <option key={zona.etiqueta} value={String(zona.valor)}>
                    {zona.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <footer className="browser-foot">
          <button
            onClick={onColumns}
            disabled={!columnsEnabled}
            title={t("props.columnasTooltip")}
          >
            {t("props.columnas")}
          </button>
          <span className="selected-path" />
          <button onClick={onClose}>{t("props.cerrar")}</button>
          <button
            className="primary"
            disabled={sinPestana || busy}
            onClick={() =>
              onApply({
                parser: parserDraft,
                pattern: patternDraft,
                delimiter: delimiterDraft,
                encoding: encodingDraft,
                zonaHoraria: zonaDraft,
              })
            }
          >
            {t("props.aplicar")}
          </button>
        </footer>
      </div>
    </div>
  );
}
