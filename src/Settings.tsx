import { useEffect } from "react";

import type { Settings } from "./types";
import { IDIOMAS, NOMBRE_IDIOMA, t } from "./textos";
import type { Idioma } from "./textos";

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
          <strong>{t("settings.titulo")}</strong>
          <span className="hint">{t("settings.pista")}</span>
          <button onClick={onClose}>{t("settings.cerrar")}</button>
        </header>

        <div className="mapper-body">
          <label className="settings-field">
            <span className="settings-label">{t("settings.idioma")}</span>
            <select
              value={settings.idioma}
              onChange={(event) =>
                onChange({ ...settings, idioma: event.target.value as Idioma })
              }
              title={t("settings.idiomaTooltip")}
            >
              {IDIOMAS.map((codigo) => (
                <option key={codigo} value={codigo}>
                  {NOMBRE_IDIOMA[codigo]}
                </option>
              ))}
            </select>
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.rememberLastOpened}
              onChange={(event) =>
                onChange({ ...settings, rememberLastOpened: event.target.checked })
              }
            />
            {t("settings.reabrir")}
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.startWithTail}
              onChange={(event) =>
                onChange({ ...settings, startWithTail: event.target.checked })
              }
            />
            {t("settings.iniciarTail")}
          </label>
          <div className="settings-note">{t("settings.notaTail")}</div>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.startWithAutoScroll}
              onChange={(event) =>
                onChange({ ...settings, startWithAutoScroll: event.target.checked })
              }
            />
            {t("settings.iniciarAutoscroll")}
          </label>
          <div className="settings-note">{t("settings.notaAutoscroll")}</div>

          <div className="settings-block">
            <div className="settings-title">{t("settings.ultimos")}</div>

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
                  {t("settings.parser", { parser: ultimos.parser })}
                  {ultimos.mapping
                    ? t("settings.columnasForzadas", { n: ultimos.mapping.length })
                    : ""}
                </div>
                <button onClick={() => onChange({ ...settings, lastOpen: null })}>
                  {t("settings.olvidar")}
                </button>
              </>
            ) : (
              <div className="hint">{t("settings.sinLogs")}</div>
            )}
          </div>
        </div>

        <footer className="browser-foot">
          <span className="selected-path" />
          <button className="primary" onClick={onClose}>
            {t("settings.hecho")}
          </button>
        </footer>
      </div>
    </div>
  );
}
