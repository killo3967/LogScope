import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { Filters, HighlightRule, PageResult, Row } from "./types";
import { COLUMN_WIDTHS, DEFAULT_COLUMN_WIDTH, formatDelta } from "./types";
import { MenuFilas } from "./MenuFilas";
import { mensajeDeError } from "./errores";
import { t } from "./textos";

const PAGE = 200;
const ROW_HEIGHT = 22;
// Al copiar, las filas que no están en memoria se piden al núcleo en tramos de
// este tamaño: una petición por línea sería lentísima y una sola por toda la
// selección, imposible (no cabe entera en memoria).
const TRAMO_COPIA = 1000;
// Tope de seguridad: por encima de esto el portapapeles no es el sitio y se
// avisa en vez de intentarlo.
const MAX_FILAS_COPIA = 50_000;
const MIN_WIDTH = 48;
// Ancho fijo de la columna de numeración: no se guarda en localStorage ni se
// arrastra, para no mezclarla con los anchos de las columnas de datos.
const ROW_NO_WIDTH = 72;

interface Props {
  sessionId: string | null;
  filters: Filters;
  filterKey: string;
  generation: number;
  fields: string[];
  merged: boolean;
  /** Columna Delta Time visible en esta pestaña. */
  delta: boolean;
  onDeltaChange: (value: boolean) => void;
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  onSelectionMenu: (menu: { text: string; x: number; y: number } | null) => void;
  onAviso: (texto: string) => void;
  rules: HighlightRule[];
  widths: Record<string, number>;
  onWidthChange: (column: string, width: number) => void;
  onTotal: (total: number) => void;
}

interface Segment {
  text: string;
  hit: boolean;
}

export function LogGrid({
  sessionId,
  filters,
  filterKey,
  generation,
  fields,
  merged,
  delta,
  onDeltaChange,
  autoScroll,
  onAutoScrollChange,
  onSelectionMenu,
  onAviso,
  rules,
  widths,
  onWidthChange,
  onTotal,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  // Marca de tiempo del último desplazamiento programático: mientras dure,
  // los eventos de scroll propios no deben interpretarse como del usuario.
  const autoScrollAt = useRef(0);
  const cache = useRef(new Map<number, Row[]>());
  const inflight = useRef(new Set<number>());
  const [total, setTotal] = useState(0);
  // Selección de filas por índice visible (posición dentro del resultado ya
  // filtrado, que es sobre lo que pagina `read_page`). El ancla es el extremo
  // fijo del rango: Mayús+clic selecciona desde ahí hasta la fila pulsada.
  const [ancla, setAncla] = useState<number | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number>>(() => new Set());
  const [menuFilas, setMenuFilas] = useState<{ x: number; y: number } | null>(null);
  // Menú de la cabecera de `Time`: la única entrada conmuta la columna Delta.
  const [menuCabecera, setMenuCabecera] = useState<{ x: number; y: number } | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const columns = useMemo(() => {
    const base = merged
      ? ["Date", "Time", "Level", "Source", ...fields]
      : ["Date", "Time", "Level", ...fields];
    if (!delta) return base;
    // Delta va pegada a Time: es su lectura derivada.
    const trasTime = base.indexOf("Time") + 1;
    return [...base.slice(0, trasTime), "Delta", ...base.slice(trasTime)];
  }, [merged, fields, delta]);
  const columnWidths = columns.map(
    (name) => widths[name] ?? COLUMN_WIDTHS[name] ?? DEFAULT_COLUMN_WIDTH,
  );
  const totalWidth = ROW_NO_WIDTH + columnWidths.reduce((sum, width) => sum + width, 0);

  // Reglas compiladas una sola vez por cambio, no por fila.
  const compiled = useMemo(() => {
    return rules
      .filter((rule) => rule.pattern.trim() !== "")
      .map((rule) => {
        let regex: RegExp | null = null;
        if (rule.isRegex) {
          try {
            // La `i` solo se añade si la regla no pide distinguir mayúsculas.
            regex = new RegExp(rule.pattern, rule.caseSensitive ? "g" : "gi");
          } catch {
            regex = null;
          }
        }
        // Aguja ya normalizada para la búsqueda literal, que no pasa por regex.
        const needle = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
        return { rule, regex, needle };
      })
      .filter((entry) => !entry.rule.isRegex || entry.regex !== null);
  }, [rules]);

  const rowColor = useCallback(
    (row: Row): string | undefined => {
      for (const { rule, regex, needle } of compiled) {
        if (rule.target !== "row") continue;
        const hit = regex
          ? ((regex.lastIndex = 0), regex.test(row.raw))
          : (rule.caseSensitive ? row.raw : row.raw.toLowerCase()).includes(needle);
        if (hit) return rule.color;
      }
      return undefined;
    },
    [compiled],
  );

  /// Primera regla de palabra que coincide con el texto: se parte por ella y
  /// se colorea con su color.
  const splitHits = useCallback(
    (text: string): { segments: Segment[]; color?: string } => {
      const wordRules = compiled.filter((entry) => entry.rule.target === "word");
      if (wordRules.length === 0 || text === "") return { segments: [{ text, hit: false }] };

      for (const { rule, regex, needle } of wordRules) {
        const segments: Segment[] = [];
        if (regex) {
          regex.lastIndex = 0;
          let last = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(text)) !== null) {
            if (match[0].length === 0) break;
            if (match.index > last) segments.push({ text: text.slice(last, match.index), hit: false });
            segments.push({ text: match[0], hit: true });
            last = match.index + match[0].length;
          }
          if (segments.length === 0) continue;
          if (last < text.length) segments.push({ text: text.slice(last), hit: false });
        } else {
          const haystack = rule.caseSensitive ? text : text.toLowerCase();
          let index = haystack.indexOf(needle);
          if (index === -1) continue;
          let last = 0;
          while (index !== -1) {
            if (index > last) segments.push({ text: text.slice(last, index), hit: false });
            segments.push({ text: text.slice(index, index + needle.length), hit: true });
            last = index + needle.length;
            index = haystack.indexOf(needle, last);
          }
          if (last < text.length) segments.push({ text: text.slice(last), hit: false });
        }
        return { segments, color: rule.color };
      }
      return { segments: [{ text, hit: false }] };
    },
    [compiled],
  );

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 30,
  });

  useEffect(() => {
    cache.current.clear();
    inflight.current.clear();
    setTotal(0);
    // La selección va por índice: al cambiar de sesión o de filtro los índices
    // dejan de apuntar a las mismas entradas, así que se descarta entera.
    setAncla(null);
    setSeleccion(new Set());
    setMenuFilas(null);
    onTotal(0);
    parentRef.current?.scrollTo({ top: 0 });
  }, [sessionId, filterKey, onTotal]);

  const loadPage = useCallback(
    async (page: number) => {
      if (!sessionId) return;
      if (cache.current.has(page) || inflight.current.has(page)) return;
      inflight.current.add(page);
      try {
        const result = await invoke<PageResult>("read_page", {
          sessionId,
          start: page * PAGE,
          count: PAGE,
          filters,
        });
        setTotal((previous) => {
          if (result.total < previous) cache.current.clear();
          return result.total;
        });
        cache.current.set(page, result.rows);
        onTotal(result.total);
        bump();
      } finally {
        inflight.current.delete(page);
      }
    },
    [sessionId, filters, onTotal],
  );

  useEffect(() => {
    if (sessionId && total > 0) void loadPage(Math.floor((total - 1) / PAGE));
  }, [sessionId, total, loadPage]);

  const items = virtualizer.getVirtualItems();
  const firstIndex = items.length > 0 ? items[0].index : 0;
  const lastIndex = items.length > 0 ? items[items.length - 1].index : 0;

  useEffect(() => {
    if (!sessionId) return;
    const first = Math.floor(firstIndex / PAGE);
    const last = Math.floor(lastIndex / PAGE);
    for (let page = first; page <= last; page += 1) void loadPage(page);
  }, [sessionId, firstIndex, lastIndex, loadPage]);

  useEffect(() => {
    if (!sessionId || generation === 0) return;
    const lastPage = Math.floor(Math.max(total - 1, 0) / PAGE);

    if (merged) {
      // En una vista combinada las líneas nuevas entran **en medio**: los
      // índices visibles se desplazan y la caché de páginas entera deja de
      // valer. Se tira, se suelta la selección (apuntaría a otras filas) y se
      // vuelve a pedir lo que se está viendo.
      cache.current.clear();
      inflight.current.clear();
      setSeleccion(new Set());
      setAncla(null);
      const items = virtualizer.getVirtualItems();
      const desde = items.length > 0 ? Math.floor(items[0].index / PAGE) : lastPage;
      const hasta =
        items.length > 0 ? Math.floor(items[items.length - 1].index / PAGE) : lastPage;
      for (let page = desde; page <= hasta; page += 1) void loadPage(page);
    } else {
      cache.current.delete(lastPage);
    }
    void loadPage(lastPage);
    bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  useEffect(() => {
    if (!autoScroll || total === 0) return;
    autoScrollAt.current = Date.now();
    virtualizer.scrollToIndex(total - 1, { align: "end" });
  }, [total, autoScroll, virtualizer]);

  // Si el usuario se va hacia arriba, el autoscroll deja de tener sentido: se
  // desmarca solo para no pelearse con la rueda ni saltar mientras lee.
  const handleUserScroll = useCallback(() => {
    if (!autoScroll) return;
    if (Date.now() - autoScrollAt.current < 200) return;
    const element = parentRef.current;
    if (!element) return;
    const gap = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (gap > ROW_HEIGHT * 2) onAutoScrollChange(false);
  }, [autoScroll, onAutoScrollChange]);

  // Clic normal: una fila. Mayús+clic: rango desde el ancla. Ctrl+clic: suma o
  // resta esa fila y mueve el ancla.
  const handleRowClick = useCallback(
    (index: number, event: React.MouseEvent) => {
      if (event.shiftKey && ancla !== null) {
        // Mayús+clic no debe dejar viva la marca de texto anterior (el
        // `preventDefault` del mousedown impide que el navegador la limpie): el
        // menú contextual y Ctrl+C tienen que hablar de las filas.
        window.getSelection()?.removeAllRanges();
        const desde = Math.min(ancla, index);
        const hasta = Math.max(ancla, index);
        const rango = new Set<number>();
        for (let fila = desde; fila <= hasta; fila += 1) rango.add(fila);
        setSeleccion(rango);
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        setSeleccion((previous) => {
          const siguiente = new Set(previous);
          if (siguiente.has(index)) siguiente.delete(index);
          else siguiente.add(index);
          return siguiente;
        });
        setAncla(index);
        return;
      }
      setSeleccion(new Set([index]));
      setAncla(index);
    },
    [ancla],
  );

  /// Filas de los índices pedidos: primero la caché y, para lo que falte,
  /// peticiones al núcleo de `TRAMO_COPIA` filas, de menor a mayor. Así se
  /// copia lo seleccionado aunque no esté cargado en pantalla.
  const recogerFilas = useCallback(
    async (indices: number[]): Promise<Row[]> => {
      if (!sessionId) return [];
      const encontradas = new Map<number, Row>();
      const pendientes: number[] = [];
      for (const index of indices) {
        const row = cache.current.get(Math.floor(index / PAGE))?.[index % PAGE];
        if (row) encontradas.set(index, row);
        else pendientes.push(index);
      }

      let cursor = 0;
      while (cursor < pendientes.length) {
        const result = await invoke<PageResult>("read_page", {
          sessionId,
          start: pendientes[cursor],
          count: TRAMO_COPIA,
          filters,
        });
        // `Row.index` es la entrada real, no la posición filtrada: el índice
        // visible de cada fila es la posición dentro de `rows`.
        result.rows.forEach((row, offset) => encontradas.set(result.start + offset, row));
        const ultimo = result.start + result.rows.length - 1;
        let siguiente = cursor;
        while (siguiente < pendientes.length && pendientes[siguiente] <= ultimo) siguiente += 1;
        // Si el tramo vuelve vacío (final del fichero) hay que avanzar igual.
        cursor = siguiente > cursor ? siguiente : cursor + 1;
      }

      return indices
        .map((index) => encontradas.get(index))
        .filter((row): row is Row => row !== undefined);
    },
    [sessionId, filters],
  );

  const copiarTexto = useCallback(async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso de portapapeles se recurre al comando clásico. La selección
      // de filas no es una selección del DOM, así que el texto se pone en un
      // área temporal y se selecciona antes de copiar.
      const area = document.createElement("textarea");
      area.value = texto;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }, []);

  const copiarSeleccion = useCallback(
    async (conNumeros: boolean) => {
      if (!sessionId || seleccion.size === 0 || copiando) return;
      const indices = Array.from(seleccion).sort((a, b) => a - b);
      if (indices.length > MAX_FILAS_COPIA) {
        setMenuFilas(null);
        onAviso(t("sel.demasiadasFilas", { n: indices.length }));
        return;
      }
      setCopiando(true);
      try {
        const filas = await recogerFilas(indices);
        await copiarTexto(
          filas.map((row) => (conNumeros ? `${row.line_no}: ${row.raw}` : row.raw)).join("\n"),
        );
        setMenuFilas(null);
      } catch (cause) {
        onAviso(mensajeDeError(String(cause)));
      } finally {
        setCopiando(false);
      }
    },
    [sessionId, seleccion, copiando, recogerFilas, copiarTexto, onAviso],
  );

  /// Vuelca la selección a un fichero de texto junto al log. El núcleo decide
  /// el nombre (no sobrescribe) y devuelve la ruta escrita, que se enseña en la
  /// barra de aviso: sin diálogo, el usuario sabe dónde ha quedado el fichero.
  const exportarSeleccion = useCallback(
    async (conNumeros: boolean) => {
      if (!sessionId || seleccion.size === 0 || copiando || exportando) return;
      const indices = Array.from(seleccion).sort((a, b) => a - b);
      setExportando(true);
      try {
        const ruta = await invoke<string>("export_selection", {
          sessionId,
          indices,
          filters,
          withLineNumbers: conNumeros,
        });
        setMenuFilas(null);
        onAviso(t("sel.exportado", { ruta }));
      } catch (cause) {
        onAviso(mensajeDeError(String(cause)));
      } finally {
        setExportando(false);
      }
    },
    [sessionId, seleccion, copiando, exportando, filters, onAviso],
  );

  // Ctrl+C: el estándar del portapapeles para las filas marcadas. No se pisa
  // cuando el foco está en un campo de texto ni cuando hay texto marcado con el
  // ratón, que es lo que el usuario quiere copiar en ese caso.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "c") return;
      if (event.shiftKey || event.altKey) return;
      if (seleccion.size === 0) return;
      const target = event.target as HTMLElement | null;
      const etiqueta = target?.tagName?.toLowerCase() ?? "";
      if (etiqueta === "input" || etiqueta === "textarea" || etiqueta === "select") return;
      if (target?.isContentEditable) return;
      if ((window.getSelection()?.toString() ?? "") !== "") return;
      event.preventDefault();
      void copiarSeleccion(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seleccion, copiarSeleccion]);

  // Escape quita la selección, igual que la entrada del menú. Si hay una ventana
  // modal abierta (ajustes, reglas, propiedades, columnas) o un menú (el de la
  // cabecera o el de la selección), Escape cierra eso primero: una pulsación,
  // una cosa.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector(".browser-backdrop")) return;
      if (menuCabecera) {
        setMenuCabecera(null);
        return;
      }
      if (menuFilas) return;
      if (seleccion.size === 0) return;
      setSeleccion(new Set());
      setAncla(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuCabecera, menuFilas, seleccion]);

  // El clic derecho abre el menú de texto si hay texto marcado y, si no, el de
  // filas cuando hay filas seleccionadas. Sin nada marcado se deja pasar el
  // menú nativo de WebView2, que es el de siempre.
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const texto = window.getSelection()?.toString().trim() ?? "";
      if (texto !== "") {
        event.preventDefault();
        // Una selección de varias filas se aplana: el patrón de una regla es una
        // sola línea de texto.
        onSelectionMenu({
          text: texto.replace(/\s+/g, " ").slice(0, 200),
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      if (seleccion.size === 0) return;
      event.preventDefault();
      setMenuFilas({ x: event.clientX, y: event.clientY });
    },
    [onSelectionMenu, seleccion],
  );

  // Clic derecho en la cabecera de `Time` abre el menú de la columna Delta. En
  // el resto de cabeceras se deja pasar al menú de filas/texto de siempre.
  const handleHeaderContextMenu = useCallback((name: string, event: React.MouseEvent) => {
    if (name !== "Time") return;
    event.preventDefault();
    event.stopPropagation();
    setMenuCabecera({ x: event.clientX, y: event.clientY });
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!autoScroll || event.deltaY >= 0) return;
      const element = parentRef.current;
      // En un fichero corto no hay nada que desplazar: no se toca la casilla.
      if (!element || element.scrollHeight <= element.clientHeight + ROW_HEIGHT) return;
      onAutoScrollChange(false);
    },
    [autoScroll, onAutoScrollChange],
  );

  // Arrastre del separador de columna.
  const startResize = useCallback(
    (column: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const index = columns.indexOf(column);
      const startWidth = columnWidths[index] ?? DEFAULT_COLUMN_WIDTH;

      const onMove = (moveEvent: MouseEvent) => {
        const width = Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX));
        onWidthChange(column, width);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [columns, columnWidths, onWidthChange],
  );

  if (!sessionId) {
    return <div className="empty">{t("app.vacio")}</div>;
  }

  const cellValue = (row: Row, name: string): string => {
    // Los dígitos del fichero tal cual los formateó el núcleo: nada de `new
    // Date`, que convertiría a la zona del navegador.
    if (name === "Date") return row.fecha ?? "";
    if (name === "Time") return row.hora ?? "";
    if (name === "Delta") return formatDelta(row.delta_ms);
    if (name === "Level") return row.level;
    if (name === "Source") return row.source;
    return row.fields.find((field) => field.name === name)?.value ?? "";
  };

  const renderCell = (text: string) => {
    const { segments, color } = splitHits(text);
    if (segments.length === 1 && !segments[0].hit) return text;
    return segments.map((segment, index) =>
      segment.hit ? (
        <mark key={index} style={{ backgroundColor: color }}>
          {segment.text}
        </mark>
      ) : (
        <span key={index}>{segment.text}</span>
      ),
    );
  };

  return (
    <>
      <div
        ref={parentRef}
        className="grid-scroll"
        onScroll={handleUserScroll}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      >
      <div className="grid-inner" style={{ width: totalWidth }}>
        <div className="grid-header">
          <span
            className="col-head col-rowno"
            title={t("grid.numeroLineaTooltip")}
            style={{ width: ROW_NO_WIDTH, minWidth: ROW_NO_WIDTH }}
          >
            #
          </span>
          {columns.map((name, index) => (
            <span
              key={name}
              className={`col-head col-${name.toLowerCase()}`}
              style={{ width: columnWidths[index], minWidth: columnWidths[index] }}
              title={
                name === "Time"
                  ? t("grid.deltaCabeceraTooltip")
                  : name === "Delta"
                    ? t("grid.deltaTooltip")
                    : undefined
              }
              onContextMenu={(event) => handleHeaderContextMenu(name, event)}
            >
              {name === "Delta" ? t("grid.delta") : name}
              <span
                className="resizer"
                title={t("grid.anchoTooltip")}
                onMouseDown={(event) => startResize(name, event)}
              />
            </span>
          ))}
        </div>

        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {items.map((item) => {
            const page = Math.floor(item.index / PAGE);
            const rows = cache.current.get(page);
            const row = rows ? rows[item.index % PAGE] : undefined;
            const color = row ? rowColor(row) : undefined;
            return (
              <div
                key={item.key}
                className={`row level-${row?.level ?? "unknown"}${
                  seleccion.has(item.index) ? " selected" : ""
                }`}
                onClick={(event) => handleRowClick(item.index, event)}
                onMouseDown={(event) => {
                  // Mayús+clic marca un rango de filas: no debe arrastrar además
                  // la selección de texto del navegador.
                  if (event.shiftKey) event.preventDefault();
                }}
                title={row?.raw}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform: `translateY(${item.start}px)`,
                  width: totalWidth,
                  backgroundColor: color ? `${color}33` : undefined,
                  boxShadow: color ? `inset 3px 0 0 ${color}` : undefined,
                }}
              >
                <span
                  className="cell col-rowno"
                  style={{ width: ROW_NO_WIDTH, minWidth: ROW_NO_WIDTH }}
                >
                  {row ? row.line_no : ""}
                </span>
                {row ? (
                  columns.map((name, index) => (
                    <span
                      key={name}
                      className={`cell col-${name.toLowerCase()}`}
                      style={{ width: columnWidths[index], minWidth: columnWidths[index] }}
                    >
                      {renderCell(cellValue(row, name))}
                    </span>
                  ))
                ) : (
                  <span className="cell muted">{t("grid.cargando")}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
      {/* Fuera del contenedor: `.grid-scroll` lleva `contain: strict` y en él
          `position: fixed` se resolvería contra la rejilla, no contra la
          ventana. El portal lo cuelga del `body` para que el menú aparezca
          donde está el puntero. */}
      {createPortal(
        menuCabecera ? (
          <>
            <div className="menu-backdrop" onClick={() => setMenuCabecera(null)} />
            <div
              className="context-menu"
              style={{
                left: Math.min(menuCabecera.x, window.innerWidth - 320),
                top: Math.min(menuCabecera.y, window.innerHeight - 160),
              }}
            >
              <div className="menu-title">Time</div>
              <button
                className="menu-item"
                onClick={() => {
                  onDeltaChange(!delta);
                  setMenuCabecera(null);
                }}
              >
                <span className="menu-label">{t("grid.deltaMenu")}</span>
                {delta ? <span className="menu-count">✓</span> : null}
              </button>
            </div>
          </>
        ) : null,
        document.body,
      )}
      {createPortal(
        <MenuFilas
          open={menuFilas}
          count={seleccion.size}
          copiando={copiando}
          exportando={exportando}
          onCopiar={(conNumeros) => void copiarSeleccion(conNumeros)}
          onExportar={(conNumeros) => void exportarSeleccion(conNumeros)}
          onQuitar={() => {
            setAncla(null);
            setSeleccion(new Set());
            setMenuFilas(null);
          }}
          onClose={() => setMenuFilas(null)}
        />,
        document.body,
      )}
    </>
  );
}
