import { useEffect, useState } from "react";

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
                  ? "Marca dos o más pestañas con Ctrl+clic y vuelve a abrir este menú"
                  : "Abrir una vista combinada con estas pestañas, ordenada por instante"
              }
              onClick={onCombine}
            >
              Combinar {combineCount >= 2 ? `${combineCount} pestañas` : "pestañas…"}
            </button>

            <div className="menu-sep" />

            <button
              className="menu-item"
              disabled={sinOrigenes}
              title={
                sinOrigenes
                  ? "Ningún otro log tiene reglas de color todavía"
                  : "Copiar las reglas de otro log a este"
              }
              onClick={() => setPicking(true)}
            >
              Copiar colorización de…
            </button>

            <div className="menu-sep" />

            <button
              className="menu-item"
              title="Recarga la interfaz. Se cierran las pestañas abiertas."
              onClick={onReload}
            >
              Recargar interfaz
            </button>
            <button className="menu-item" onClick={onPrint}>
              Imprimir…
            </button>
          </>
        ) : (
          <>
            <button className="menu-item menu-back" onClick={() => setPicking(false)}>
              ← Atrás
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
