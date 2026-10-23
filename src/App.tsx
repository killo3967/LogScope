import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { ColumnMapper } from "./ColumnMapper";
import { FileBrowser } from "./FileBrowser";
import { HighlightRules } from "./HighlightRules";
import { LogGrid } from "./LogGrid";
import { Toolbar } from "./Toolbar";
import type { Filters, HighlightRule, OpenResult, ParserKind, Stats } from "./types";
import { ALL_LEVELS, formatBytes } from "./types";

const WIDTHS_KEY = "logscope.columnWidths.v1";
const RULES_KEY = "logscope.highlightRules.v1";

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface Tab {
  id: string;
  title: string;
  paths: string[];
  session: OpenResult;
  mask: number;
  text: string;
  tailing: boolean;
  mapping: string[] | null;
  generation: number;
  total: number;
}

export default function App() {
  const [paths, setPaths] = useState<string>("");
  const [parser, setParser] = useState<ParserKind>("auto");
  const [pattern, setPattern] = useState(
    "^(?P<ts>\\S+ \\S+) (?P<level>\\w+) (?P<Message>.*)$",
  );
  const [delimiter, setDelimiter] = useState(",");

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tabs.find((tab) => tab.id === activeId) ?? null;

  const [autoScroll, setAutoScroll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const [widths, setWidths] = useState<Record<string, number>>(() =>
    loadStored(WIDTHS_KEY, {} as Record<string, number>),
  );
  const [rules, setRules] = useState<HighlightRule[]>(() =>
    loadStored(RULES_KEY, [] as HighlightRule[]),
  );

  useEffect(() => {
    try {
      localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [widths]);

  useEffect(() => {
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(rules));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [rules]);

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((previous) =>
      previous.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
    );
  }, []);

  const openPaths = useCallback(
    async (targets: string[], mappingToUse: string[] | null) => {
      if (targets.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        const result = await invoke<OpenResult>("open_files", {
          paths: targets,
          options: {
            path: targets[0],
            parser,
            pattern: parser === "pattern" ? pattern : null,
            delimiter: parser === "dsv" ? delimiter : null,
            mapping: mappingToUse,
          },
        });

        const title =
          result.sources.length > 1
            ? `${result.sources.length} ficheros`
            : (result.sources[0] ?? targets[0]);

        const tab: Tab = {
          id: result.session_id,
          title,
          paths: targets,
          session: result,
          mask: ALL_LEVELS,
          text: "",
          tailing: false,
          mapping:
            mappingToUse ??
            (result.sample_lines.length > 1 ? result.proposed_mapping : null),
          generation: 0,
          total: result.entries,
        };
        setTabs((previous) => [...previous, tab]);
        setActiveId(tab.id);
      } catch (cause) {
        setError(String(cause));
      } finally {
        setBusy(false);
      }
    },
    [parser, pattern, delimiter],
  );

  const closeTab = useCallback(
    async (id: string) => {
      try {
        await invoke("close_session", { sessionId: id });
      } catch {
        /* la sesión puede haber desaparecido */
      }
      setTabs((previous) => {
        const next = previous.filter((tab) => tab.id !== id);
        if (id === activeId) setActiveId(next.length > 0 ? next[next.length - 1].id : null);
        return next;
      });
    },
    [activeId],
  );

  const handleToggleTail = useCallback(async () => {
    if (!active) return;
    if (active.session.merged) {
      setError(
        "El tail en vivo solo está disponible con un único fichero: en una vista combinada el orden se recalcularía en cada línea.",
      );
      return;
    }
    try {
      if (active.tailing) {
        await invoke("stop_tail", { sessionId: active.id });
        updateTab(active.id, { tailing: false });
      } else {
        await invoke("start_tail", { sessionId: active.id });
        updateTab(active.id, { tailing: true });
      }
      setError(null);
    } catch (cause) {
      setError(String(cause));
    }
  }, [active, updateTab]);

  useEffect(() => {
    const unlisten = listen<{ sessionId: string; bytes: number }>(
      "log://appended",
      async (event) => {
        const { sessionId } = event.payload;
        let merged = false;
        setTabs((previous) => {
          merged = previous.find((tab) => tab.id === sessionId)?.session.merged ?? false;
          return previous;
        });
        if (merged) return;
        try {
          const next = await invoke<Stats>("stats", { sessionId });
          setTabs((previous) =>
            previous.map((tab) =>
              tab.id === sessionId
                ? { ...tab, total: next.entries, generation: tab.generation + 1, tailing: next.tailing }
                : tab,
            ),
          );
        } catch {
          /* sesión cerrada */
        }
      },
    );
    return () => {
      void unlisten.then((un) => un());
    };
  }, []);

  const filters = useMemo<Filters>(
    () => ({
      levels: !active || active.mask === ALL_LEVELS ? null : active.mask,
      text: active && active.text.trim() !== "" ? active.text.trim() : null,
    }),
    [active?.mask, active?.text],
  );

  const filterKey = `${active?.mask ?? ALL_LEVELS}|${active?.text ?? ""}`;

  const handleApplyMapping = useCallback(
    (next: string[]) => {
      if (!active) return;
      const targets = active.paths;
      setMapperOpen(false);
      void (async () => {
        await closeTab(active.id);
        await openPaths(targets, next);
      })();
    },
    [active, closeTab, openPaths],
  );

  const handleTotal = useCallback(
    (value: number) => {
      if (!active) return;
      setTabs((previous) =>
        previous.map((tab) => (tab.id === active.id ? { ...tab, total: value } : tab)),
      );
    },
    [active?.id],
  );

  const handleWidthChange = useCallback((column: string, width: number) => {
    setWidths((previous) => ({ ...previous, [column]: width }));
  }, []);

  return (
    <div className="app">
      <Toolbar
        path={paths}
        onPathChange={setPaths}
        parser={parser}
        onParserChange={setParser}
        pattern={pattern}
        onPatternChange={setPattern}
        delimiter={delimiter}
        onDelimiterChange={setDelimiter}
        onOpen={() => void openPaths([paths], null)}
        onBrowse={() => setBrowserOpen(true)}
        onColumns={() => setMapperOpen(true)}
        columnsEnabled={!busy && !!active && active.session.sample_lines.length > 1}
        onRules={() => setRulesOpen(true)}
        rulesCount={rules.length}
        mask={active?.mask ?? ALL_LEVELS}
        onMaskChange={(value) => active && updateTab(active.id, { mask: value })}
        text={active?.text ?? ""}
        onTextChange={(value) => active && updateTab(active.id, { text: value })}
        tailing={active?.tailing ?? false}
        tailEnabled={!!active && !active.session.merged}
        onToggleTail={handleToggleTail}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        busy={busy}
        disabled={!active}
      />

      {tabs.length > 0 && (
        <div className="tabbar">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeId ? "active" : ""}`}
              onClick={() => setActiveId(tab.id)}
              title={tab.session.sources.join("\n")}
            >
              {tab.session.merged && <span className="tab-badge" title="Vista combinada">⇄</span>}
              <span className="tab-title">{tab.title}</span>
              <button
                className="tab-close"
                onClick={(event) => {
                  event.stopPropagation();
                  void closeTab(tab.id);
                }}
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {active ? (
        <LogGrid
          key={active.id}
          sessionId={active.id}
          filters={filters}
          filterKey={filterKey}
          generation={active.generation}
          fields={active.session.fields}
          merged={active.session.merged}
          autoScroll={autoScroll}
          rules={rules}
          widths={widths}
          onWidthChange={handleWidthChange}
          onTotal={handleTotal}
        />
      ) : (
        <div className="empty">Abre un fichero de log para empezar.</div>
      )}

      <FileBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onPick={(picked) => {
          setBrowserOpen(false);
          if (picked.length > 0) setPaths(picked[0]);
          void openPaths(picked, null);
        }}
      />

      <ColumnMapper
        open={mapperOpen}
        sampleLines={active?.session.sample_lines ?? []}
        mapping={active?.mapping ?? active?.session.proposed_mapping ?? []}
        busy={busy}
        onClose={() => setMapperOpen(false)}
        onApply={handleApplyMapping}
      />

      <HighlightRules
        open={rulesOpen}
        rules={rules}
        onChange={setRules}
        onClose={() => setRulesOpen(false)}
      />

      <footer className="status">
        <span>{active ? active.session.parser : "sin sesión"}</span>
        <span>
          {active ? active.total.toLocaleString("es-ES") : 0} líneas
          {active?.session.merged ? ` · ${active.session.sources.length} ficheros` : ""}
        </span>
        <span>{active ? formatBytes(active.session.bytes) : "0 B"}</span>
        <span className={active?.tailing ? "live" : ""}>
          {active?.tailing ? "tail activo" : "tail parado"}
        </span>
        <span>{tabs.length} pestaña{tabs.length === 1 ? "" : "s"}</span>
        <span>{rules.length} regla{rules.length === 1 ? "" : "s"}</span>
      </footer>
    </div>
  );
}
