import type { ClaveTexto } from "./es";

/**
 * Catálogo en alemán.
 *
 * Misma estructura y mismo orden que `es.ts`, que es el original del que salen
 * las claves. Los marcadores `{nombre}` y los espacios de los extremos forman
 * parte del render: no se tocan al traducir.
 */
export const DE: Record<ClaveTexto, string> = {
  // Zona de aplicación: capa de arrastre y estados vacíos.
  "app.soltar": "Datei zum Öffnen hier ablegen",
  "app.soltarDetalle":
    "Wird in einem neuen Tab geöffnet. Bei mehreren Dateien: ein Tab pro Datei.",
  "app.vacio": "Öffne eine Logdatei, um zu beginnen.",
  "app.cerrarMensaje": "Meldung schließen",
  "app.tailMerged":
    "Live-Tail gibt es nur mit einer einzelnen Datei: in einer kombinierten Ansicht würde die Reihenfolge bei jeder Zeile neu berechnet.",

  // Menú de aplicación.
  "menu.archivo": "Datei",
  "menu.ver": "Ansicht",
  "menu.herramientas": "Extras",
  "menu.ayuda": "Hilfe",
  "menu.abrir": "Öffnen…",
  "menu.reabrirUltimo": "Letztes Log erneut öffnen",
  "menu.salir": "Beenden",
  "menu.tailEnVivo": "Live-Tail",
  "menu.autoscroll": "Autoscroll",
  "menu.propiedades": "Dateieigenschaften…",
  "menu.reglas": "Farbregeln…",
  "menu.ajustes": "Einstellungen…",
  "menu.acercaDe": "Über LogScope",

  // Barra de herramientas.
  "toolbar.rutaPlaceholder": "C:\\Pfad\\zur\\Datei.log",
  "toolbar.examinarTooltip": "Im Verzeichnisbaum navigieren",
  "toolbar.examinar": "Durchsuchen…",
  "toolbar.abriendo": "Wird geöffnet…",
  "toolbar.abrir": "Öffnen",
  "toolbar.propiedades": "Eigenschaften",
  "toolbar.mas": "⋯",
  "toolbar.masTooltip": "Weitere Aktionen",
  "toolbar.reglasTooltip": "Zeilen oder Wörter nach einem Muster einfärben",
  "toolbar.reglasVacio": "Regeln…",
  "toolbar.tailEtiqueta": "tail",
  "toolbar.autoscrollEtiqueta": "auto",
  "toolbar.tailSeguirTooltip": "Der Datei live folgen",
  "toolbar.tailDetenerTooltip": "Live-Tail stoppen",
  "toolbar.tailNoDisponibleTooltip":
    "Beim Kombinieren mehrerer Dateien nicht verfügbar",
  "toolbar.autoscrollActivarTooltip": "Autoscroll einschalten",
  "toolbar.autoscrollDesactivarTooltip": "Autoscroll ausschalten",
  "toolbar.filtroPlaceholder": "Nach Text filtern…",
  "toolbar.filtroAvanzadoActivoTooltip":
    "Der erweiterte Filter ersetzt dieses Steuerelement, solange er aktiv ist",

  // Panel de propiedades del fichero.
  "props.titulo": "Dateieigenschaften",
  "props.rutas": "Pfade",
  "props.tamano": "Größe",
  "props.lineas": "Zeilen",
  "props.parserDetectado": "Erkannter Parser",
  "props.codificacionDetectada": "Erkannte Kodierung",
  "props.formato": "Format",
  "props.formatoTooltip": "Wie jede Zeile der Datei gelesen wird",
  "props.delimitador": "Trennzeichen",
  "props.delimitadorTooltip": "Trennzeichen",
  "props.patron": "Muster",
  "props.patronTooltip": "Regex mit benannten Gruppen",
  "props.zona": "Zeitzone des Logs",
  "props.zonaTooltip": "Zeitzone, in der die Datei geschrieben wurde; wirkt auf die Reihenfolge der kombinierten Ansicht und die Datumsfilter",
  "props.zonaEquipo": "Die des Rechners",
  "props.codificacion": "Kodierung",
  "props.codificacionTooltip": "Kodierung der Bytes der Datei",
  "props.columnas": "Spalten…",
  "props.columnasTooltip": "Jede Zeile des Eintrags ihrer Spalte zuordnen",
  "props.cerrar": "Schließen",
  "props.aplicar": "Übernehmen und neu laden",

  // Nombres visibles de las codificaciones.
  "props.encoding.auto": "auto",
  "props.encoding.utf8": "UTF-8",
  "props.encoding.utf16le": "UTF-16 LE",
  "props.encoding.utf16be": "UTF-16 BE",
  "props.encoding.utf32le": "UTF-32 LE",
  "props.encoding.utf32be": "UTF-32 BE",
  "props.encoding.windows1252": "Windows-1252",
  "props.encoding.windows1250": "Windows-1250",
  "props.encoding.windows1251": "Windows-1251",
  "props.encoding.cp850": "CP850 (Konsole)",
  "props.encoding.cp437": "CP437 (DOS)",
  "props.encoding.iso8859-15": "ISO-8859-15",
  "props.encoding.koi8-r": "KOI8-R",
  "props.encoding.shift_jis": "Shift-JIS",
  "props.encoding.gbk": "GBK",
  "props.encoding.big5": "Big5",
  "props.encoding.euc-jp": "EUC-JP",

  // Diálogo «Acerca de».
  "about.titulo": "Über LogScope",
  "about.version": "Version {version}",
  "about.sinVersion": "Version nicht verfügbar",
  "about.descripcion": "Logbetrachter für Windows.",
  "about.cerrar": "Schließen",

  // Rejilla de entradas.
  "grid.numeroLineaTooltip": "Zeilennummer in der Datei",
  "grid.anchoTooltip": "Ziehen, um die Breite zu ändern",
  "grid.delta": "Delta",
  "grid.deltaMenu": "Delta-Time-Spalte",
  "grid.deltaTooltip": "Seit der vorherigen Zeile der Datei verstrichene Zeit",
  "grid.deltaCabeceraTooltip": "Rechtsklick, um die Delta-Time-Spalte ein- oder auszublenden",
  "grid.cargando": "wird geladen…",

  // Explorador de ficheros.
  "browser.titulo": "Logdatei öffnen",
  "browser.filtroPlaceholder": "Nach Name filtern…",
  "browser.cerrar": "Schließen",
  "browser.cargandoUnidades": "Laufwerke werden geladen…",
  "browser.leyendo": "Wird gelesen…",
  "browser.seleccionVacia":
    "eine oder mehrere Dateien markieren (Dateien unterschiedlicher Formate werden nach Uhrzeit kombiniert)",
  "browser.seleccionados": "{n} Dateien ausgewählt",
  "browser.abrirTooltipVarios": "Jede markierte Datei in einem eigenen Tab öffnen",
  "browser.abrirTooltipUno": "Die markierte Datei öffnen",
  "browser.abrir": "Öffnen",
  "browser.abrirN": "Öffnen ({n})",
  "browser.combinar": "Kombinieren ",
  "browser.combinarN": "Kombinieren ({n})",
  "browser.combinarTooltip": "Die markierten Dateien nach Zeitpunkt kombinieren",

  // Editor de columnas.
  "cols.titulo": "Spalten des Eintrags",
  "cols.pista": "Jede Zeile des Eintrags geht in eine Spalte. `ignore` verwirft sie.",
  "cols.cerrar": "Schließen",
  "cols.linea": "Zeile {n}",
  "cols.vacia": "(leer)",
  "cols.sinEntradas": "Diese Datei hat keine mehrzeiligen Einträge.",
  "cols.avisoSinTime": "Hinweis: keine Zeile als time markiert",
  "cols.cancelar": "Abbrechen",
  "cols.aplicando": "Wird übernommen…",
  "cols.aplicar": "Übernehmen",

  // Reglas de color.
  "rules.arrastrarTooltip": "Diese Leiste ziehen, um das Fenster zu verschieben",
  "rules.titulo": "Farbregeln",
  "rules.pista":
    "Treffer für Text oder regulären Ausdruck. Die erste passende Regel gewinnt.",
  "rules.cerrar": "Schließen",
  "rules.vacio": "Keine Regeln. Füge eine hinzu, um Zeilen oder Wörter einzufärben.",
  "rules.patronRegexPlaceholder": "regulärer Ausdruck",
  "rules.patronTextoPlaceholder": "zu suchender Text",
  "rules.regexInvalidaTooltip":
    "Ungültiger regulärer Ausdruck: die Regel wird ignoriert",
  "rules.palabra": "Wort",
  "rules.filaEntera": "ganze Zeile",
  "rules.caseSensitiveTooltip":
    "Groß- und Kleinschreibung beachten. Ohne Häkchen wird nicht unterschieden.",
  "rules.eliminarTooltip": "Regel löschen",
  "rules.regexInvalida":
    "Ungültiger regulärer Ausdruck: diese Regel färbt nichts ein, bis du sie korrigierst.",
  "rules.totalUna": "{n} Regel",
  "rules.totalVarias": "{n} Regeln",
  "rules.anadir": "Regel hinzufügen",
  "rules.hecho": "Fertig",

  // Panel de ajustes.
  "settings.titulo": "Einstellungen",
  "settings.pista": "Auf diesem Rechner gespeicherte Einstellungen.",
  "settings.cerrar": "Schließen",
  "settings.idioma": "Sprache",
  "settings.idiomaTooltip": "Sprache der Oberfläche",
  "settings.reabrir": "Die letzten Logs beim Start erneut öffnen",
  "settings.iniciarTail": "Mit aktivem Live-Tail starten",
  "settings.notaTail":
    "Beim Öffnen einer Logdatei wird ihr automatisch gefolgt. Gilt nicht für kombinierte Ansichten, in denen die Reihenfolge bei jeder Zeile neu berechnet würde.",
  "settings.iniciarAutoscroll": "Mit aktivem Autoscroll starten",
  "settings.notaAutoscroll":
    "Gilt beim Start und beim Öffnen jeder Logdatei. Du kannst es jederzeit über den Schalter in der Leiste oder durch Hochdrehen des Mausrads ausschalten.",
  "settings.ultimos": "Zuletzt gemerkte Logs",
  "settings.parser": "Parser {parser}",
  "settings.columnasForzadas": " · {n} erzwungene Spalten",
  "settings.olvidar": "Diese Logs vergessen",
  "settings.sinLogs": "Es wurde noch keine Logdatei geöffnet.",
  "settings.hecho": "Fertig",

  // Menú de pestaña.
  "tab.vistaCombinada": "Kombinierte Ansicht",
  "tab.cerrar": "Schließen",
  "tab.ficheros": "{n} Dateien",
  "tab.combinarN": "{n} Tabs kombinieren",
  "tab.combinarVacio": "Tabs kombinieren…",
  "tab.combinarTooltipDeshabilitado":
    "Markiere zwei oder mehr Tabs mit Strg+Klick und öffne dieses Menü erneut",
  "tab.combinarTooltip":
    "Eine kombinierte Ansicht dieser Tabs öffnen, nach Zeitpunkt geordnet",
  "tab.copiarColorizacion": "Färbung übernehmen von…",
  "tab.sinOrigenesTooltip": "Keine andere Logdatei hat bisher Farbregeln",
  "tab.copiarTooltip": "Die Regeln einer anderen Logdatei hierher übernehmen",
  "tab.recargarTooltip": "Lädt die Oberfläche neu. Geöffnete Tabs werden geschlossen.",
  "tab.recargar": "Oberfläche neu laden",
  "tab.imprimir": "Drucken…",
  "tab.atras": "← Zurück",

  // Menú de selección.
  "sel.copiar": "Kopieren",
  "sel.reglasTooltip": "Die Farbregeln mit diesem Text als Muster öffnen",
  "sel.reglasCon": "Farbregeln mit «{texto}»",
  "sel.filasSeleccionadas": "{n} Zeilen ausgewählt",
  "sel.copiarFilas": "Auswahl kopieren",
  "sel.copiarFilasNumeros": "Mit Zeilennummern kopieren",
  "sel.exportar": "Auswahl exportieren",
  "sel.exportarNumeros": "Mit Zeilennummern exportieren",
  "sel.quitarSeleccion": "Auswahl aufheben",
  "sel.copiando": "Wird kopiert…",
  "sel.exportando": "Wird exportiert…",
  "sel.exportado": "Exportiert nach {ruta}",
  "sel.demasiadasFilas":
    "Die Auswahl ist zu groß für die Zwischenablage: {n} Zeilen",

  // Filtro avanzado. La ventana construye la consulta que el núcleo evalúa;
  // aquí solo va lo que se lee en ella y en el chip de la barra.
  "filtro.titulo": "Erweiterter Filter",
  "filtro.pista":
    "Alle Gruppen müssen zutreffen; innerhalb einer Gruppe gelten ihre Bedingungen.",
  "filtro.cerrar": "Schließen",
  "filtro.aplicar": "Anwenden",
  "filtro.limpiar": "Leeren",
  "filtro.grupo": "Gruppe {n}",
  "filtro.anadirGrupo": "Gruppe hinzufügen",
  "filtro.quitarGrupo": "Gruppe entfernen",
  "filtro.anadirCondicion": "Bedingung hinzufügen",
  "filtro.quitarCondicion": "Bedingung entfernen",
  "filtro.conectorY": "UND",
  "filtro.conectorO": "ODER",
  "filtro.campo": "Feld",
  "filtro.campo.texto": "Text",
  "filtro.campo.nivel": "Ebene",
  "filtro.campo.fuente": "Quelle",
  "filtro.comparacion": "Vergleich",
  "filtro.comparacion.contiene": "enthält",
  "filtro.comparacion.igual": "ist gleich",
  "filtro.comparacion.empiezaPor": "beginnt mit",
  "filtro.comparacion.terminaPor": "endet mit",
  "filtro.comparacion.regex": "regulärer Ausdruck",
  "filtro.valor": "Wert",
  "filtro.negada": "NICHT",
  "filtro.desde": "Von",
  "filtro.hasta": "Bis",
  "filtro.franja": "Zeitfenster",
  "filtro.fuentes": "Dateien",
  "filtro.chip": "Erweiterter Filter",
  "filtro.chipTooltip": "Erweiterten Filter bearbeiten",
  "filtro.chipQuitar": "Erweiterten Filter entfernen",

  // Pie de estado.
  "status.sinSesion": "ohne Sitzung",
  "status.lineas": "{total} Zeilen",
  "status.ficheros": " · {total} Dateien",
  "status.tailActivo": "tail aktiv",
  "status.tailParado": "tail gestoppt",
  "status.pestana": "{n} Tab",
  "status.pestanas": "{n} Tabs",
  "status.regla": "{n} Regel",
  "status.reglas": "{n} Regeln",

  // Errores del núcleo.
  "error.pattern_missing": "der Parser pattern braucht das Feld pattern",
  "error.unknown_parser": "unbekannter Parser: {parser}",
  "error.open_failed": "kann nicht geöffnet werden: {message}",
  "error.io": "{message}",
  "error.read_failed": "Lesefehler: {message}",
  "error.combine_without_timestamps":
    "kann nicht kombiniert werden: {file} hat keine Spalte für Datum und Uhrzeit",
  "error.no_session": "unbekannte Sitzung: {id}",
  "error.no_file_selected": "keine Datei angegeben",
  "error.not_a_file": "keine Datei: {path}",
  "error.tail_merged":
    "Live-Tail gibt es nur mit einer einzelnen Datei: in einer kombinierten Ansicht würde die Reihenfolge bei jeder Zeile neu berechnet",
  "error.invalid_regex": "ungültige regex: {message}",
  "error.pattern_needs_named_group":
    "das Muster braucht mindestens eine benannte Gruppe, z. B. (?P<Message>.*)",
  "error.not_a_directory": "kein Verzeichnis: {path}",
  "error.export_empty": "die Auswahl ist leer",
  "error.export_failed": "Exportieren fehlgeschlagen: {message}",
};
