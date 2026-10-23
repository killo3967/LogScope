import { useEffect } from "react";

interface Props {
  open: { text: string; x: number; y: number } | null;
  onCopy: (text: string) => void;
  onRules: (text: string) => void;
  onClose: () => void;
}

/**
 * Menú contextual para texto marcado en el grid.
 *
 * Solo se abre cuando hay selección: sin ella se deja pasar el menú nativo de
 * WebView2, que no se puede ampliar desde la aplicación. Las entradas imitan lo
 * útil de ese menú (Copiar) y añaden la acción propia.
 */
export function SelectionMenu({ open, onCopy, onRules, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const recorte = open.text.length > 40 ? `${open.text.slice(0, 40)}…` : open.text;

  const style: React.CSSProperties = {
    left: Math.min(open.x, window.innerWidth - 320),
    top: Math.min(open.y, window.innerHeight - 200),
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
        <div className="menu-title" title={open.text}>
          {recorte}
        </div>

        <button className="menu-item" onClick={() => onCopy(open.text)}>
          Copiar
        </button>

        <div className="menu-sep" />

        <button
          className="menu-item"
          title="Abrir las reglas de color con este texto como patrón"
          onClick={() => onRules(open.text)}
        >
          Reglas de color con «{recorte}»
        </button>
      </div>
    </>
  );
}
