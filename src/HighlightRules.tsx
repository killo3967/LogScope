import { useEffect } from "react";

import type { HighlightRule } from "./types";

const PALETTE = ["#ef6b6b", "#e0b341", "#7fbf7f", "#4c9aff", "#c792ea", "#ff9d5c"];

export { PALETTE };

interface Props {
  open: boolean;
  rules: HighlightRule[];
  onChange: (rules: HighlightRule[]) => void;
  onClose: () => void;
}

export function HighlightRules({ open, rules, onChange, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (id: string, patch: Partial<HighlightRule>) =>
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  const remove = (id: string) => onChange(rules.filter((rule) => rule.id !== id));

  const add = () => {
    const id = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onChange([
      ...rules,
      {
        id,
        pattern: "",
        isRegex: false,
        target: "word",
        color: PALETTE[rules.length % PALETTE.length],
      },
    ]);
  };

  return (
    <div className="browser-backdrop" onClick={onClose}>
      <div className="browser mapper rules" onClick={(event) => event.stopPropagation()}>
        <header className="browser-head">
          <strong>Reglas de color</strong>
          <span className="hint">
            Coincidencias de texto o expresión regular. La primera regla que coincide gana.
          </span>
          <button onClick={onClose}>Cerrar</button>
        </header>

        <div className="mapper-body">
          {rules.length === 0 && (
            <div className="mapper-row muted">
              Sin reglas. Añade una para colorear filas o palabras.
            </div>
          )}

          {rules.map((rule) => (
            <div className="rule-row" key={rule.id}>
              <input
                className="rule-pattern"
                placeholder={rule.isRegex ? "expresión regular" : "texto a buscar"}
                value={rule.pattern}
                onChange={(event) => update(rule.id, { pattern: event.target.value })}
              />
              <select
                value={rule.target}
                onChange={(event) =>
                  update(rule.id, { target: event.target.value as HighlightRule["target"] })
                }
              >
                <option value="word">palabra</option>
                <option value="row">fila entera</option>
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={rule.isRegex}
                  onChange={(event) => update(rule.id, { isRegex: event.target.checked })}
                />
                regex
              </label>
              <input
                type="color"
                className="rule-color"
                value={rule.color}
                onChange={(event) => update(rule.id, { color: event.target.value })}
              />
              <button onClick={() => remove(rule.id)} title="Eliminar regla">
                ✕
              </button>
            </div>
          ))}
        </div>

        <footer className="browser-foot">
          <span className="selected-path">
            {rules.length} regla{rules.length === 1 ? "" : "s"}
          </span>
          <button onClick={add}>Añadir regla</button>
          <button className="primary" onClick={onClose}>
            Hecho
          </button>
        </footer>
      </div>
    </div>
  );
}
