import { useEffect, useRef, useState } from "react";

import type { HighlightRule } from "./types";

const PALETTE = ["#ef6b6b", "#e0b341", "#7fbf7f", "#4c9aff", "#c792ea", "#ff9d5c"];

/** Cuánto de la ventana debe quedar siempre dentro de la pantalla. */
const MARGEN_X = 140;
const MARGEN_Y = 48;

/**
 * Mantiene la ventana a la vista: `MARGEN_X` píxeles de ancho y la barra de
 * título dentro de la pantalla, para que nunca se quede sin poder agarrarla.
 */
function limitar(x: number, y: number, ancho: number) {
  return {
    x: Math.min(Math.max(MARGEN_X - ancho, x), Math.max(0, window.innerWidth - MARGEN_X)),
    y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - MARGEN_Y)),
  };
}

export { PALETTE };

interface Props {
  open: boolean;
  rules: HighlightRule[];
  onChange: (rules: HighlightRule[]) => void;
  onClose: () => void;
}

export function HighlightRules({ open, rules, onChange, onClose }: Props) {
  const ventana = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // La primera vez que se abre se coloca centrada; después recuerda dónde la
  // dejó el usuario, también al cerrar y volver a abrir.
  useEffect(() => {
    if (!open) return;
    setPos((actual) => {
      const ancho = ventana.current?.offsetWidth ?? 680;
      const alto = ventana.current?.offsetHeight ?? 360;
      if (actual) return limitar(actual.x, actual.y, ancho);
      return limitar(
        Math.round((window.innerWidth - ancho) / 2),
        Math.round((window.innerHeight - alto) / 3),
        ancho,
      );
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () =>
      setPos((actual) =>
        actual ? limitar(actual.x, actual.y, ventana.current?.offsetWidth ?? 680) : actual,
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  /** Arrastre por la barra de título, con el puntero capturado en `window`. */
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const base = pos ?? { x: 0, y: 0 };
    const dx = event.clientX - base.x;
    const dy = event.clientY - base.y;
    setArrastrando(true);

    const mover = (move: PointerEvent) => {
      const ancho = ventana.current?.offsetWidth ?? 680;
      setPos(limitar(move.clientX - dx, move.clientY - dy, ancho));
    };
    const soltar = () => {
      setArrastrando(false);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    event.preventDefault();
  };

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
        caseSensitive: false,
        target: "word",
        color: PALETTE[rules.length % PALETTE.length],
      },
    ]);
  };

  /** Una expresión que no compila se marca en el campo: el grid la ignora. */
  const regexInvalida = (rule: HighlightRule): boolean => {
    if (!rule.isRegex || rule.pattern === "") return false;
    try {
      new RegExp(rule.pattern);
      return false;
    } catch {
      return true;
    }
  };

  return (
    <div
      ref={ventana}
      className="browser mapper rules flotante"
      style={{
        left: pos?.x ?? 0,
        top: pos?.y ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <header
        className={`browser-head arrastrable${arrastrando ? " arrastrando" : ""}`}
        onPointerDown={startDrag}
        title="Arrastra esta barra para mover la ventana"
      >
        <strong>Reglas de color</strong>
        <span className="hint">
          Coincidencias de texto o expresión regular. La primera regla que coincide gana.
        </span>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={onClose}>
          Cerrar
        </button>
      </header>

      <div className="mapper-body">
        {rules.length === 0 && (
          <div className="mapper-row muted">
            Sin reglas. Añade una para colorear filas o palabras.
          </div>
        )}

        {rules.map((rule) => (
          <div className="rule-block" key={rule.id}>
            <div className="rule-row">
              <input
                className={`rule-pattern${regexInvalida(rule) ? " invalid" : ""}`}
                placeholder={rule.isRegex ? "expresión regular" : "texto a buscar"}
                title={regexInvalida(rule) ? "Expresión regular no válida: la regla se ignora" : undefined}
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
              <label
                className="check"
                title="Distinguir mayúsculas y minúsculas. Desmarcado, la coincidencia no distingue."
              >
                <input
                  type="checkbox"
                  checked={rule.caseSensitive === true}
                  onChange={(event) => update(rule.id, { caseSensitive: event.target.checked })}
                />
                Aa
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
            {regexInvalida(rule) && (
              <div className="rule-error">
                Expresión regular no válida: esta regla no colorea nada hasta que la corrijas.
              </div>
            )}
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
  );
}
