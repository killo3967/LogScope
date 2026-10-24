import { useEffect, useState } from "react";

import { t } from "./textos";

const ROLES = [
  "time",
  "level",
  "thread",
  "tag",
  "logger",
  "message",
  "ignore",
] as const;

interface Props {
  open: boolean;
  /** Líneas de la primera entrada, tal cual vienen del fichero. */
  sampleLines: string[];
  /** Papel actual por sub-línea. */
  mapping: string[];
  busy: boolean;
  onClose: () => void;
  onApply: (mapping: string[]) => void;
}

export function ColumnMapper({
  open,
  sampleLines,
  mapping,
  busy,
  onClose,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<string[]>(mapping);

  useEffect(() => {
    if (open) setDraft(mapping.length > 0 ? mapping : sampleLines.map(() => "ignore"));
  }, [open, mapping, sampleLines]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const setRole = (index: number, role: string) =>
    setDraft((previous) => {
      const next = [...previous];
      next[index] = role;
      return next;
    });

  return (
    <div className="browser-backdrop" onClick={onClose}>
      <div className="browser mapper" onClick={(event) => event.stopPropagation()}>
        <header className="browser-head">
          <strong>{t("cols.titulo")}</strong>
          <span className="hint">{t("cols.pista")}</span>
          <button onClick={onClose}>{t("cols.cerrar")}</button>
        </header>

        <div className="mapper-body">
          {sampleLines.map((line, index) => (
            <div className="mapper-row" key={index}>
              <span className="mapper-index">{t("cols.linea", { n: index + 1 })}</span>
              <code className="mapper-sample" title={line}>
                {line || t("cols.vacia")}
              </code>
              <select
                className={`role-${draft[index] ?? "ignore"}`}
                value={draft[index] ?? "ignore"}
                onChange={(event) => setRole(index, event.target.value)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {sampleLines.length === 0 && (
            <div className="mapper-row muted">{t("cols.sinEntradas")}</div>
          )}
        </div>

        <footer className="browser-foot">
          <span className="selected-path">
            {draft.includes("time") ? "" : t("cols.avisoSinTime")}
          </span>
          <button onClick={onClose}>{t("cols.cancelar")}</button>
          <button
            className="primary"
            disabled={busy || sampleLines.length === 0}
            onClick={() => onApply(draft)}
          >
            {busy ? t("cols.aplicando") : t("cols.aplicar")}
          </button>
        </footer>
      </div>
    </div>
  );
}
