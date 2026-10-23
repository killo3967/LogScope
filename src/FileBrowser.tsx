import { Fragment, useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { DirEntryInfo, DirListing } from "./types";
import { formatBytes } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (paths: string[], mode: "open" | "combine") => void;
}

export function FileBrowser({ open, onClose, onPick }: Props) {
  const [roots, setRoots] = useState<DirEntryInfo[]>([]);
  const [children, setChildren] = useState<Record<string, DirEntryInfo[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFilter("");
    // La selección es de esta apertura: si se conservara, al volver a Examinar
    // aparecería marcado el fichero anterior y el siguiente quedaría listo para
    // combinar con él sin que el usuario lo haya pedido.
    setSelected([]);
    invoke<DirEntryInfo[]>("list_roots")
      .then(setRoots)
      .catch((cause) => setError(String(cause)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Enter" && selected.length > 0) onPick(selected, "open");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, onPick, onClose]);

  const load = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const listing = await invoke<DirListing>("list_dir", { path });
      setChildren((previous) => ({ ...previous, [path]: listing.entries }));
      setError(null);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleDir = useCallback(
    (entry: DirEntryInfo) => {
      setExpanded((previous) => {
        const next = new Set(previous);
        if (next.has(entry.path)) {
          next.delete(entry.path);
        } else {
          next.add(entry.path);
          if (!children[entry.path]) void load(entry.path);
        }
        return next;
      });
    },
    [children, load],
  );

  const toggleFile = useCallback((entry: DirEntryInfo) => {
    setSelected((previous) =>
      previous.includes(entry.path)
        ? previous.filter((path) => path !== entry.path)
        : [...previous, entry.path],
    );
  }, []);

  if (!open) return null;

  const matches = (entry: DirEntryInfo) =>
    filter === "" || entry.name.toLowerCase().includes(filter.toLowerCase());

  const renderNodes = (entries: DirEntryInfo[], depth: number): React.ReactNode =>
    entries.filter(matches).map((entry) => {
      const isSelected = selected.includes(entry.path);
      return (
        <Fragment key={entry.path}>
          <div
            className={`tree-row ${isSelected ? "selected" : ""} ${
              entry.is_dir ? "dir" : "file"
            }`}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => (entry.is_dir ? toggleDir(entry) : toggleFile(entry))}
            onDoubleClick={() => {
              if (!entry.is_dir) onPick([entry.path], "open");
            }}
          >
            <span className="twisty">
              {entry.is_dir ? (expanded.has(entry.path) ? "▾" : "▸") : isSelected ? "☑" : "☐"}
            </span>
            <span className="name" title={entry.path}>
              {entry.name}
            </span>
            {!entry.is_dir && <span className="size">{formatBytes(entry.size)}</span>}
          </div>
          {entry.is_dir &&
            expanded.has(entry.path) &&
            children[entry.path] &&
            renderNodes(children[entry.path], depth + 1)}
        </Fragment>
      );
    });

  return (
    <div className="browser-backdrop" onClick={onClose}>
      <div className="browser" onClick={(event) => event.stopPropagation()}>
        <header className="browser-head">
          <strong>Abrir fichero de log</strong>
          <input
            className="browser-filter"
            placeholder="Filtrar por nombre…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            autoFocus
          />
          <button onClick={onClose}>Cerrar</button>
        </header>

        {error && <div className="browser-error">{error}</div>}

        <div className="browser-tree">
          {roots.length === 0 && <div className="tree-row muted">Cargando unidades…</div>}
          {renderNodes(roots, 0)}
          {loading && <div className="tree-row muted">Leyendo…</div>}
        </div>

        <footer className="browser-foot">
          <span className="selected-path" title={selected.join("\n")}>
            {selected.length === 0
              ? "marca uno o varios ficheros (los de distintos formatos se combinan por hora)"
              : selected.length === 1
                ? selected[0]
                : `${selected.length} ficheros seleccionados`}
          </span>
          <button
            disabled={selected.length === 0}
            onClick={() => onPick(selected, "open")}
            title={
              selected.length > 1
                ? "Abrir cada fichero marcado en su propia pestaña"
                : "Abrir el fichero marcado"
            }
          >
            Abrir{selected.length > 1 ? ` (${selected.length})` : ""}
          </button>
          <button
            className="primary"
            disabled={selected.length < 2}
            onClick={() => onPick(selected, "combine")}
            title="Combinar los ficheros marcados en orden de instante"
          >
            Combinar {selected.length > 1 ? `(${selected.length})` : ""}
          </button>
        </footer>
      </div>
    </div>
  );
}
