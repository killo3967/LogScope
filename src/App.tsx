import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { ColumnMapper } from "./ColumnMapper";
import { FileBrowser } from "./FileBrowser";
import { HighlightRules, PALETTE } from "./HighlightRules";
import { LogGrid } from "./LogGrid";
import { SelectionMenu } from "./SelectionMenu";
import { SettingsPanel } from "./Settings";
import { TabMenu } from "./TabMenu";
import { Toolbar } from "./Toolbar";
import type {
  EncodingKind,
  Filters,
  HighlightRule,
  OpenResult,
  ParserKind,
  Settings,
  Stats,
} from "./types";
import { ALL_LEVELS, DEFAULT_SETTINGS, formatBytes, sourceKey } from "./types";

const WIDTHS_KEY = "logscope.columnWidths.v1";
const RULES_KEY = "logscope.rulesBySource.v1";
// Clave del sistema anterior, cuando las reglas eran globales. Solo se lee
// para migrarlas una vez.
const LEGACY_RULES_KEY = "logscope.highlightRules.v1";
const SETTINGS_KEY = "logscope.settings.v1";

// Referencia estable para los logs sin reglas: un array nuevo en cada render
// volvería a compilar las reglas en el grid sin motivo.
const SIN_REGLAS: HighlightRule[] = [];

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
  const [encoding, setEncoding] = useState<EncodingKind>("auto");

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tabs.find((tab) => tab.id === activeId) ?? null;

  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    // Los ajustes guardados por una version anterior no traen las claves
    // nuevas; sin este merge quedarian en undefined y desactivarian opciones
    // que el usuario nunca toco.
    ...loadStored<Partial<Settings>>(SETTINGS_KEY, {}),
  }));
  const [autoScroll, setAutoScroll] = useState(settings.startWithAutoScroll);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Archivos arrastrados sobre la ventana: se muestra una capa para indicar
  // que se pueden soltar, mientras el usuario mantiene el botón pulsado.
  const [dropActive, setDropActive] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // El arranque solo intenta reabrir una vez, aunque cambien los ajustes.
  const restoreTried = useRef(false);

  const [widths, setWidths] = useState<Record<string, number>>(() =>
    loadStored(WIDTHS_KEY, {} as Record<string, number>),
  );
  const [rulesBySource, setRulesBySource] = useState<Record<string, HighlightRule[]>>(() => {
    const stored = loadStored<Record<string, HighlightRule[]> | null>(RULES_KEY, null);
    if (stored) return stored;
    // Migración: las reglas globales de antes se asignan al log recordado, que
    // es el que el usuario tenía abierto. Los demás empiezan sin reglas.
    const legacy = loadStored<HighlightRule[]>(LEGACY_RULES_KEY, []);
    if (legacy.length > 0 && settings.lastOpen) {
      return { [sourceKey(settings.lastOpen.paths)]: legacy };
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [widths]);

  useEffect(() => {
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(rulesBySource));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [rulesBySource]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [settings]);

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((previous) =>
      previous.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)),
    );
  }, []);

  const openPaths = useCallback(
    async (
      targets: string[],
      mappingToUse: string[] | null,
      // Al reabrir al arrancar hay que usar las opciones con las que se abrió,
      // no las que tenga el estado ahora mismo.
      override?: {
        parser: ParserKind;
        pattern: string;
        delimiter: string;
        encoding?: EncodingKind;
      },
    ) => {
      if (targets.length === 0) return;
      const parserToUse = override?.parser ?? parser;
      const patternToUse = override?.pattern ?? pattern;
      const delimiterToUse = override?.delimiter ?? delimiter;
      const encodingToUse = override?.encoding ?? encoding;
      setBusy(true);
      setError(null);
      try {
        const result = await invoke<OpenResult>("open_files", {
          paths: targets,
          options: {
            path: targets[0],
            parser: parserToUse,
            pattern: parserToUse === "pattern" ? patternToUse : null,
            delimiter: parserToUse === "dsv" ? delimiterToUse : null,
            mapping: mappingToUse,
            encoding: encodingToUse,
          },
        });

        const title =
          result.sources.length > 1
            ? `${result.sources.length} ficheros`
            : (result.sources[0] ?? targets[0]);

        const mapping =
          mappingToUse ??
          (result.sample_lines.length > 1 ? result.proposed_mapping : null);

        // Ajuste "iniciar con tail": solo vale con una fuente, igual que el
        // boton de la barra. Si falla, la sesion se abre sin tail.
        let tailing = false;
        if (settings.startWithTail && !result.merged) {
          try {
            await invoke("start_tail", { sessionId: result.session_id });
            tailing = true;
          } catch {
            /* se queda sin tail, sin impedir la apertura */
          }
        }
        setAutoScroll(settings.startWithAutoScroll);

        const tab: Tab = {
          id: result.session_id,
          title,
          paths: targets,
          session: result,
          mask: ALL_LEVELS,
          text: "",
          tailing,
          mapping,
          generation: 0,
          total: result.entries,
        };
        setTabs((previous) => [...previous, tab]);
        setActiveId(tab.id);

        setSettings((previous) => ({
          ...previous,
          lastOpen: {
            paths: targets,
            parser: parserToUse,
            pattern: patternToUse,
            delimiter: delimiterToUse,
            mapping,
            encoding: encodingToUse,
          },
        }));
      } catch (cause) {
        setError(String(cause));
      } finally {
        setBusy(false);
      }
    },
    [
      parser,
      pattern,
      delimiter,
      encoding,
      settings.startWithTail,
      settings.startWithAutoScroll,
    ],
  );

  // Arrastrar un fichero del explorador de Windows sobre la ventana lo abre.
  // Tauri entrega las rutas absolutas en el evento nativo del webview; leerlas
  // desde `dataTransfer.files` no serviría: WebView2 no expone la ruta del
  // fichero por seguridad.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelado = false;

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "over") return;
        if (payload.type === "enter") {
          setDropActive(true);
          return;
        }

        setDropActive(false);
        if (payload.type !== "drop" || payload.paths.length === 0) return;

        // Una pestaña por fichero y en serie, igual que al abrir varios desde
        // el navegador: el orden de las pestañas es el de los ficheros.
        void (async () => {
          for (const ruta of payload.paths) {
            await openPaths([ruta], null);
          }
        })();
      })
      .then((fn) => {
        if (cancelado) fn();
        else unlisten = fn;
      })
      .catch(() => {
        // Sin eventos de arrastre quedan Examinar… y escribir la ruta a mano.
      });

    return () => {
      cancelado = true;
      unlisten?.();
    };
  }, [openPaths]);

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
      setSelectedTabs((previous) => previous.filter((selectedId) => selectedId !== id));
    },
    [activeId],
  );

  // Cambiar la codificación recarga el log abierto: el selector sirve para
  // corregir lo que se está viendo, no solo para la próxima apertura. Se
  // reabre con el parser y el mapeo que ya tenía esa pestaña.
  const handleEncodingChange = useCallback(
    (siguiente: EncodingKind) => {
      setEncoding(siguiente);
      if (!active) return;

      const pestaña = active;
      const parserActual = pestaña.session.parser as ParserKind;
      void (async () => {
        await closeTab(pestaña.id);
        await openPaths(pestaña.paths, pestaña.mapping, {
          parser: parserActual,
          pattern,
          delimiter,
          encoding: siguiente,
        });
      })();
    },
    [active, closeTab, openPaths, pattern, delimiter],
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

  // Las reglas de color son del fichero, no globales: la clave es su ruta, así
  // que el mismo log recupera su colorización aunque cambie el id de sesión.
  const activeSource = active ? sourceKey(active.paths) : null;
  const activeRules = (activeSource && rulesBySource[activeSource]) || SIN_REGLAS;

  const setActiveRules = useCallback(
    (next: HighlightRule[]) => {
      if (!activeSource) return;
      setRulesBySource((previous) => ({ ...previous, [activeSource]: next }));
    },
    [activeSource],
  );

  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);

  // Texto marcado en el grid: si lo hay, el clic derecho abre nuestro menú.
  const [selectionMenu, setSelectionMenu] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const [tabMenu, setTabMenu] = useState<{
    tabId: string;
    label: string;
    key: string;
    x: number;
    y: number;
  } | null>(null);

  // Orígenes posibles para copiar: cualquier log con reglas guardadas, esté o
  // no abierto ahora mismo.
  const copySources = useMemo(() => {
    if (!tabMenu) return [];
    return Object.entries(rulesBySource)
      .filter(([key, list]) => key !== tabMenu.key && list.length > 0)
      .map(([key, list]) => ({
        key,
        label: key.split("|")[0].split(/[\\/]/).pop() || key,
        count: list.length,
      }));
  }, [rulesBySource, tabMenu]);

  const copyRulesFrom = useCallback(
    (origin: string) => {
      if (!tabMenu) return;
      const destino = tabMenu.key;
      setRulesBySource((previous) => {
        const actuales = previous[destino] ?? [];
        // Se añaden sin duplicar: si ya hay una regla con el mismo patrón,
        // destino y modo, copiarla otra vez no aporta nada. El modo incluye si
        // distingue mayúsculas, que es una regla distinta.
        const huellas = new Set(
          actuales.map(
            (rule) =>
              `${rule.target}|${rule.isRegex}|${rule.caseSensitive === true}|${rule.pattern}`,
          ),
        );
        const nuevas = (previous[origin] ?? [])
          .filter(
            (rule) =>
              !huellas.has(
                `${rule.target}|${rule.isRegex}|${rule.caseSensitive === true}|${rule.pattern}`,
              ),
          )
          .map((rule) => ({
            ...rule,
            id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          }));
        return { ...previous, [destino]: [...actuales, ...nuevas] };
      });
      setTabMenu(null);
    },
    [tabMenu],
  );

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

  // Reapertura al arrancar: una sola vez, y sin pisar lo que haga el usuario.
  useEffect(() => {
    if (restoreTried.current) return;
    restoreTried.current = true;
    const remembered = settings.lastOpen;
    if (!settings.rememberLastOpened || !remembered) return;
    void openPaths(remembered.paths, remembered.mapping, remembered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Texto marcado en el grid → reglas de color con ese patrón ya escrito. No
  // se duplica si la regla ya existía: solo se abre el panel.
  const seedRuleFromSelection = useCallback(
    (texto: string) => {
      setSelectionMenu(null);
      setRulesOpen(true);
      const patron = texto.trim();
      if (patron === "" || !activeSource) return;
      setRulesBySource((previous) => {
        const actuales = previous[activeSource] ?? [];
        const yaExiste = actuales.some(
          (rule) =>
            rule.target === "word" &&
            !rule.isRegex &&
            rule.caseSensitive !== true &&
            rule.pattern === patron,
        );
        if (yaExiste) return previous;
        return {
          ...previous,
          [activeSource]: [
            ...actuales,
            {
              id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              pattern: patron,
              isRegex: false,
              target: "word" as const,
              color: PALETTE[actuales.length % PALETTE.length],
            },
          ],
        };
      });
    },
    [activeSource],
  );

  const copySelection = useCallback(async (texto: string) => {
    setSelectionMenu(null);
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso de portapapeles se copia la selección tal cual, que sigue
      // activa mientras el menú está abierto.
      document.execCommand("copy");
    }
  }, []);

  // Combinar pestañas: solo cuenta la marca si la pestaña pulsada está dentro
  // de ella. Así el menú no ofrece combinar un log que no has seleccionado.
  const combineCount =
    tabMenu && selectedTabs.includes(tabMenu.tabId) ? selectedTabs.length : 0;

  const combineSelectedTabs = useCallback(() => {
    if (!tabMenu) return;
    const elegidas = tabs.filter((tab) => selectedTabs.includes(tab.id));
    if (elegidas.length < 2) return;
    setTabMenu(null);
    setSelectedTabs([]);
    // Se combinan las rutas: el núcleo vuelve a leer cada fuente con su propio
    // parser, igual que al combinar desde el navegador de ficheros.
    void openPaths(
      elegidas.flatMap((tab) => tab.paths),
      null,
    );
  }, [tabMenu, tabs, selectedTabs, openPaths]);

  // Recargar la interfaz desde el menú de la pestaña: se cierran antes las
  // sesiones, porque el núcleo en Rust las mantendría vivas y la interfaz nueva
  // ya no sabría de ellas (fuga de memoria hasta cerrar el programa).
  const reloadUi = useCallback(async () => {
    setTabMenu(null);
    await Promise.all(
      tabs.map((tab) => invoke("close_session", { sessionId: tab.id }).catch(() => undefined)),
    );
    window.location.reload();
  }, [tabs]);

  const printUi = useCallback(() => {
    setTabMenu(null);
    window.print();
  }, []);

  return (
    <div className="app">
      {dropActive && (
        <div className="drop-overlay">
          <div className="drop-box">
            <strong>Suelta el fichero para abrirlo</strong>
            <span>Se abre en una pestaña nueva. Si sueltas varios, una por fichero.</span>
          </div>
        </div>
      )}
      <Toolbar
        path={paths}
        onPathChange={setPaths}
        parser={parser}
        onParserChange={setParser}
        encoding={encoding}
        onEncodingChange={handleEncodingChange}
        detectedEncoding={active?.session.encoding ?? null}
        pattern={pattern}
        onPatternChange={setPattern}
        delimiter={delimiter}
        onDelimiterChange={setDelimiter}
        onOpen={() => void openPaths([paths], null)}
        onBrowse={() => setBrowserOpen(true)}
        onColumns={() => setMapperOpen(true)}
        columnsEnabled={!busy && !!active && active.session.sample_lines.length > 1}
        onRules={() => setRulesOpen(true)}
        rulesCount={activeRules.length}
        mask={active?.mask ?? ALL_LEVELS}
        onMaskChange={(value) => active && updateTab(active.id, { mask: value })}
        text={active?.text ?? ""}
        onTextChange={(value) => active && updateTab(active.id, { text: value })}
        tailing={active?.tailing ?? false}
        tailEnabled={!!active && !active.session.merged}
        onToggleTail={handleToggleTail}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        onSettings={() => setSettingsOpen(true)}
        busy={busy}
        disabled={!active}
      />

      {tabs.length > 0 && (
        <div className="tabbar">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeId ? "active" : ""} ${
                selectedTabs.includes(tab.id) ? "selected" : ""
              }`}
              onClick={(event) => {
                // Ctrl+clic marca pestañas para combinarlas; el clic normal
                // activa y deja la marca en una sola.
                if (event.ctrlKey || event.metaKey) {
                  setSelectedTabs((previous) =>
                    previous.includes(tab.id)
                      ? previous.filter((id) => id !== tab.id)
                      : [...previous, tab.id],
                  );
                  return;
                }
                setSelectedTabs([tab.id]);
                setActiveId(tab.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setTabMenu({
                  tabId: tab.id,
                  label: tab.title,
                  key: sourceKey(tab.paths),
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
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

      {error && (
        <div className="error">
          <span className="error-text" title={error}>
            {error}
          </span>
          <button
            className="error-close"
            onClick={() => setError(null)}
            title="Cerrar el mensaje"
          >
            ✕
          </button>
        </div>
      )}

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
          onAutoScrollChange={setAutoScroll}
          onSelectionMenu={setSelectionMenu}
          rules={activeRules}
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
        onPick={(picked, mode) => {
          setBrowserOpen(false);
          if (picked.length === 0) return;
          setPaths(picked[0]);
          if (mode === "combine") {
            void openPaths(picked, null);
            return;
          }
          // Abrir varios: cada fichero en su propia pestaña, en orden. Se hace
          // en serie porque openPaths ya lleva su propio estado de ocupado y
          // así las pestañas aparecen en el mismo orden en que se marcaron.
          void (async () => {
            for (const path of picked) await openPaths([path], null);
          })();
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
        rules={activeRules}
        onChange={setActiveRules}
        onClose={() => setRulesOpen(false)}
      />

      <TabMenu
        open={tabMenu}
        sources={copySources}
        combineCount={combineCount}
        onCombine={combineSelectedTabs}
        onCopy={copyRulesFrom}
        onReload={() => void reloadUi()}
        onPrint={printUi}
        onClose={() => setTabMenu(null)}
      />

      <SelectionMenu
        open={selectionMenu}
        onCopy={(texto) => void copySelection(texto)}
        onRules={seedRuleFromSelection}
        onClose={() => setSelectionMenu(null)}
      />

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
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
        <span>{activeRules.length} regla{activeRules.length === 1 ? "" : "s"}</span>
      </footer>
    </div>
  );
}
