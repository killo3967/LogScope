import { useEffect, useState } from "react";

import { t } from "./textos";

export interface CopySource {
  key: string;
  label: string;
  count: number;
}

interface Props {
  open: { label: string; x: number; y: number } | null;
  sources: CopySource[];
  combineCount: number;
  onCombine: () => void;
  onCopy: (sourceKey: string) => void;
  onReload: () => void;
  onPrint: () => void;
  onClose: () => void;
}

/**
 * Menú contextual de la pestaña. Se abre con el botón derecho y ofrece copiar
 * la colorización de otro log. Es un primer nivel (acción) y un segundo nivel
 * (lista de orígenes), porque un menú plano con todas las rutas sería ilegible.
 */
export function TabMenu({
  open,
  sources,
  combineCount,
  onCombine,
  onCopy,
  onReload,
  onPrint,
  onClose,
}: Props) {
  const [picking, setPicking] = useState(false);

  // Cada apertura empieza en el primer nivel.
  useEffect(() => {
    setPicking(false);
  }, [open?.label, open?.x, open?.y]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const style: React.CSSProperties = {
    left: Math.min(open.x, window.innerWidth - 300),
    top: Math.min(open.y, window.innerHeight - 240),
  };

  const sinOrigenes = sources.length === 0;

  return (
    <>
      <div
        className="menu-backdrop"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div className="context-menu" style={style}>
        <div className="menu-title" title={open.label}>
          {open.label}
        </div>

        {!picking ? (
          <>
            <button
              className="menu-item"
              disabled={combineCount < 2}
              title={
                combineCount < 2
                  ? t("tab.combinarTooltipDeshabilitado")
                  : t("tab.combinarTooltip")
              }
              onClick={onCombine}
            >
              {combineCount >= 2
                ? t("tab.combinarN", { n: combineCount })
                : t("tab.combinarVacio")}
            </button>

            <div className="menu-sep" />

            <button
              className="menu-item"
              disabled={sinOrigenes}
              title={
                sinOrigenes
                  ? t("tab.sinOrigenesTooltip")
                  : t("tab.copiarTooltip")
              }
              onClick={() => setPicking(true)}
            >
              {t("tab.copiarColorizacion")}
            </button>

            <div className="menu-sep" />

            <button
              className="menu-item"
              title={t("tab.recargarTooltip")}
              onClick={onReload}
            >
              {t("tab.recargar")}
            </button>
            <button className="menu-item" onClick={onPrint}>
              {t("tab.imprimir")}
            </button>
          </>
        ) : (
          <>
            <button className="menu-item menu-back" onClick={() => setPicking(false)}>
              {t("tab.atras")}
            </button>
            {sources.map((source) => (
              <button
                key={source.key}
                className="menu-item"
                title={source.key}
                onClick={() => onCopy(source.key)}
              >
                <span className="menu-label">{source.label}</span>
                <span className="menu-count">{source.count}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </>
  );
}
