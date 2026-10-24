import { useEffect } from "react";

import { t } from "./textos";

interface Props {
  open: { x: number; y: number } | null;
  count: number;
  copiando: boolean;
  onCopiar: (conNumeros: boolean) => void;
  onQuitar: () => void;
  onClose: () => void;
}

/**
 * Menú contextual de las filas seleccionadas.
 *
 * Solo se abre cuando hay filas marcadas y ningún texto seleccionado: si hay
 * texto marcado manda `SelectionMenu`, que es el menú de siempre. Las clases son
 * las del menú contextual existente (`.context-menu`, `.menu-item`,
 * `.menu-title`), así que el aspecto es el mismo sin estilos nuevos.
 */
export function MenuFilas({ open, count, copiando, onCopiar, onQuitar, onClose }: Props) {
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
    left: Math.min(open.x, window.innerWidth - 320),
    top: Math.min(open.y, window.innerHeight - 230),
  };

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
        <div className="menu-title">
          {copiando
            ? t("sel.copiando")
            : t("sel.filasSeleccionadas", { n: count })}
        </div>

        <button
          className="menu-item"
          disabled={copiando}
          onClick={() => onCopiar(false)}
        >
          {t("sel.copiarFilas")}
        </button>

        <button
          className="menu-item"
          disabled={copiando}
          onClick={() => onCopiar(true)}
        >
          {t("sel.copiarFilasNumeros")}
        </button>

        <div className="menu-sep" />

        <button className="menu-item" onClick={onQuitar}>
          {t("sel.quitarSeleccion")}
        </button>
      </div>
    </>
  );
}
