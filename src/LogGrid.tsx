import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { Filters, HighlightRule, PageResult, Row } from "./types";
import { COLUMN_WIDTHS, DEFAULT_COLUMN_WIDTH, formatClock, formatDate } from "./types";
import { t } from "./textos";

const PAGE = 200;
const ROW_HEIGHT = 22;
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
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  onSelectionMenu: (menu: { text: string; x: number; y: number } | null) => void;
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
  autoScroll,
  onAutoScrollChange,
  onSelectionMenu,
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
  const [selected, setSelected] = useState<number | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const columns = useMemo(
    () =>
      merged
        ? ["Date", "Time", "Level", "Source", ...fields]
        : ["Date", "Time", "Level", ...fields],
    [merged, fields],
  );
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
    // La marca de fila va por índice: al cambiar de sesión o de filtro deja de
    // apuntar a la misma entrada, así que se descarta.
    setSelected(null);
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
    cache.current.delete(lastPage);
    void loadPage(lastPage);
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

  // Solo se intercepta el clic derecho si hay texto marcado: sin selección se
  // deja pasar el menú nativo de WebView2, que es el de siempre.
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const seleccion = window.getSelection()?.toString().trim() ?? "";
      if (seleccion === "") return;
      event.preventDefault();
      // Una selección de varias filas se aplana: el patrón de una regla es una
      // sola línea de texto.
      onSelectionMenu({
        text: seleccion.replace(/\s+/g, " ").slice(0, 200),
        x: event.clientX,
        y: event.clientY,
      });
    },
    [onSelectionMenu],
  );

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
    if (name === "Date") return formatDate(row.ts_ms);
    if (name === "Time") return formatClock(row.ts_ms);
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
            >
              {name}
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
                  selected === item.index ? " selected" : ""
                }`}
                onClick={() => setSelected(item.index)}
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
  );
}
