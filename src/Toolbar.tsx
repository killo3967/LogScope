import { useEffect, useState } from "react";

import type { Level } from "./types";
import { LEVELS, LEVEL_BIT } from "./types";
import { t } from "./textos";

interface Props {
  path: string;
  onPathChange: (value: string) => void;
  onOpen: () => void;
  onBrowse: () => void;
  onProperties: () => void;
  propertiesEnabled: boolean;
  mask: number;
  onMaskChange: (value: number) => void;
  text: string;
  onTextChange: (value: string) => void;
  /** Hay un filtro avanzado activo: la barra queda sustituida. */
  filtroAvanzado: boolean;
  onFiltroAvanzado: () => void;
  onQuitarFiltroAvanzado: () => void;
  tailing: boolean;
  tailEnabled: boolean;
  onToggleTail: () => void;
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  onRules: () => void;
  onReload: () => void;
  onPrint: () => void;
  busy: boolean;
  disabled: boolean;
}

/** Interruptor de la barra: glifo identificativo, pista visual y `title`. */
function Interruptor({
  activo,
  disponible,
  icono,
  etiqueta,
  titulo,
  onClick,
}: {
  activo: boolean;
  disponible: boolean;
  icono: string;
  /** Nombre corto visible junto al interruptor: sin él no se sabe qué apaga. */
  etiqueta: string;
  titulo: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`toggle ${activo ? "on" : ""}`}
      onClick={onClick}
      disabled={!disponible}
      title={titulo}
      aria-pressed={activo}
    >
      <span className="toggle-icon" aria-hidden="true">
        {icono}
      </span>
      <span className="toggle-label">{etiqueta}</span>
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
    </button>
  );
}

export function Toolbar(props: Props) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const toggleLevel = (level: Level) => {
    props.onMaskChange(props.mask ^ LEVEL_BIT[level]);
  };

  const abrirMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const caja = event.currentTarget.getBoundingClientRect();
    setMenuPos({
      // Pegado a la derecha del botón, sin salirse de la ventana.
      x: Math.max(8, Math.min(caja.left, window.innerWidth - 240)),
      y: caja.bottom + 4,
    });
  };

  const cerrarMenu = () => setMenuPos(null);

  useEffect(() => {
    if (!menuPos) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cerrarMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuPos]);

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

        <Interruptor
          activo={props.tailing}
          disponible={props.tailEnabled}
          icono="▶"
          etiqueta={t("toolbar.tailEtiqueta")}
          titulo={
            props.tailEnabled
              ? props.tailing
                ? t("toolbar.tailDetenerTooltip")
                : t("toolbar.tailSeguirTooltip")
              : t("toolbar.tailNoDisponibleTooltip")
          }
          onClick={props.onToggleTail}
        />

        <Interruptor
          activo={props.autoScroll}
          disponible
          icono="⬇"
          etiqueta={t("toolbar.autoscrollEtiqueta")}
          titulo={
            props.autoScroll
              ? t("toolbar.autoscrollDesactivarTooltip")
              : t("toolbar.autoscrollActivarTooltip")
          }
          onClick={() => props.onAutoScrollChange(!props.autoScroll)}
        />

        <button
          onClick={props.onProperties}
          disabled={!props.propertiesEnabled}
        >
          {t("toolbar.propiedades")}
        </button>
      </div>

      <div className="toolbar-row">
        <input
          className="filter"
          placeholder={t("toolbar.filtroPlaceholder")}
          value={props.text}
          onChange={(event) => props.onTextChange(event.target.value)}
          disabled={props.disabled || props.filtroAvanzado}
          title={
            props.filtroAvanzado ? t("toolbar.filtroAvanzadoActivoTooltip") : undefined
          }
        />
        {props.filtroAvanzado && (
          <span
            className="chip filtro-avanzado"
            title={t("filtro.chipTooltip")}
          >
            <button
              className="filtro-chip-texto"
              onClick={props.onFiltroAvanzado}
              title={t("filtro.chipTooltip")}
            >
              {t("filtro.chip")}
            </button>
            <button
              className="filtro-chip-quitar"
              onClick={props.onQuitarFiltroAvanzado}
              title={t("filtro.chipQuitar")}
            >
              ✕
            </button>
          </span>
        )}
        <div className="levels">
          {LEVELS.map((level) => (
            <button
              key={level}
              className={`chip level-${level} ${
                props.mask & LEVEL_BIT[level] ? "on" : "off"
              }`}
              onClick={() => toggleLevel(level)}
              disabled={props.filtroAvanzado}
              title={
                props.filtroAvanzado
                  ? t("toolbar.filtroAvanzadoActivoTooltip")
                  : undefined
              }
            >
              {level}
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <button
            className="icon mas"
            onClick={abrirMenu}
            title={t("toolbar.masTooltip")}
            aria-haspopup="menu"
            aria-expanded={menuPos !== null}
          >
            {t("toolbar.mas")}
          </button>
        </div>
      </div>

      {menuPos && (
        <>
          <div
            className="menu-backdrop"
            onClick={cerrarMenu}
            onContextMenu={(event) => {
              event.preventDefault();
              cerrarMenu();
            }}
          />
          <div
            className="context-menu toolbar-menu"
            style={{ left: menuPos.x, top: menuPos.y }}
            role="menu"
          >
            <button
              className="menu-item"
              role="menuitem"
              title={t("filtro.chipTooltip")}
              disabled={props.disabled}
              onClick={() => {
                cerrarMenu();
                props.onFiltroAvanzado();
              }}
            >
              {/* Los puntos suspensivos son de «abre una ventana», no del
                  título: la ventana ya se llama como esta clave. */}
              {t("filtro.titulo")}…
            </button>
            <div className="menu-sep" />
            <button
              className="menu-item"
              role="menuitem"
              title={t("toolbar.reglasTooltip")}
              onClick={() => {
                cerrarMenu();
                props.onRules();
              }}
            >
              {t("toolbar.reglasVacio")}
            </button>
            <div className="menu-sep" />
            <button
              className="menu-item"
              role="menuitem"
              title={t("tab.recargarTooltip")}
              onClick={() => {
                cerrarMenu();
                props.onReload();
              }}
            >
              {t("tab.recargar")}
            </button>
            <button
              className="menu-item"
              role="menuitem"
              onClick={() => {
                cerrarMenu();
                props.onPrint();
              }}
            >
              {t("tab.imprimir")}
            </button>
          </div>
        </>
      )}
    </header>
  );
}
