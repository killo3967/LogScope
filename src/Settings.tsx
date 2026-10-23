import { useEffect } from "react";

import type { Settings } from "./types";

interface Props {
  open: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

/**
 * Panel de ajustes. Hoy solo hay una preferencia real (reabrir los últimos
 * logs), pero el panel existe para que las siguientes no acaben como casillas
 * sueltas en la barra de herramientas.
 */
export function SettingsPanel({ open, settings, onChange, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ultimos = settings.lastOpen;

  return (
    <div className="browser-backdrop" onClick={onClose}>
      <div className="browser mapper rules settings" onClick={(event) => event.stopPropagation()}>
        <header className="browser-head">
          <strong>Ajustes</strong>
          <span className="hint">Preferencias guardadas en este equipo.</span>
          <button onClick={onClose}>Cerrar</button>
        </header>

        <div className="mapper-body">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.rememberLastOpened}
              onChange={(event) =>
                onChange({ ...settings, rememberLastOpened: event.target.checked })
              }
            />
            Reabrir los últimos logs al arrancar
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.startWithTail}
              onChange={(event) =>
                onChange({ ...settings, startWithTail: event.target.checked })
              }
            />
            Iniciar con el tail en vivo activo
          </label>
          <div className="settings-note">
            Al abrir un log, empieza a seguirlo solo. No se aplica a las vistas
            combinadas, donde el orden se recalcularía en cada línea.
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.startWithAutoScroll}
              onChange={(event) =>
                onChange({ ...settings, startWithAutoScroll: event.target.checked })
              }
            />
            Iniciar con el autoscroll activo
          </label>
          <div className="settings-note">
            Se aplica al arrancar y al abrir cada log. Puedes desmarcarlo en
            cualquier momento con la casilla de la barra o moviendo la rueda
            hacia arriba.
          </div>

          <div className="settings-block">
            <div className="settings-title">Últimos logs recordados</div>

            {ultimos && ultimos.paths.length > 0 ? (
              <>
                <ul className="settings-list">
                  {ultimos.paths.map((ruta) => (
                    <li key={ruta} title={ruta}>
                      {ruta}
                    </li>
                  ))}
                </ul>
                <div className="hint">
                  Parser {ultimos.parser}
                  {ultimos.mapping ? ` · ${ultimos.mapping.length} columnas forzadas` : ""}
                </div>
                <button onClick={() => onChange({ ...settings, lastOpen: null })}>
                  Olvidar estos logs
                </button>
              </>
            ) : (
              <div className="hint">Todavía no se ha abierto ningún log.</div>
            )}
          </div>
        </div>

        <footer className="browser-foot">
          <span className="selected-path" />
          <button className="primary" onClick={onClose}>
            Hecho
          </button>
        </footer>
      </div>
    </div>
  );
}
