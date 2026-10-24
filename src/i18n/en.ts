import type { ClaveTexto } from "./es";

/**
 * Catálogo en inglés. Mismas claves y en el mismo orden que `es.ts`: el tipo
 * `Record<ClaveTexto, string>` es el que impide que falte ninguna.
 *
 * Los espacios al principio o al final y los marcadores `{nombre}` son parte
 * del render: no se tocan al traducir.
 */
export const EN: Record<ClaveTexto, string> = {
  // Zona de aplicación: capa de arrastre y estados vacíos.
  "app.soltar": "Drop the file to open it",
  "app.soltarDetalle": "It opens in a new tab. If you drop several, one per file.",
  "app.vacio": "Open a log file to start.",
  "app.cerrarMensaje": "Close the message",
  "app.tailMerged":
    "Live tail is only available with a single file: in a combined view the order would be recalculated on every line.",

  // Menú de aplicación. Se construye desde la interfaz para que los rótulos
  // salgan de este catálogo; los ítems nativos no traducen nada por su cuenta.
  "menu.archivo": "File",
  "menu.ver": "View",
  "menu.herramientas": "Tools",
  "menu.ayuda": "Help",
  "menu.abrir": "Open…",
  "menu.reabrirUltimo": "Reopen last log",
  "menu.salir": "Exit",
  "menu.tailEnVivo": "Live tail",
  "menu.autoscroll": "Autoscroll",
  "menu.propiedades": "File properties…",
  "menu.reglas": "Color rules…",
  "menu.ajustes": "Settings…",
  "menu.acercaDe": "About LogScope",

  // Barra de herramientas.
  "toolbar.rutaPlaceholder": "C:\\path\\to\\file.log",
  "toolbar.examinarTooltip": "Browse the directory tree",
  "toolbar.examinar": "Browse…",
  "toolbar.abriendo": "Opening…",
  "toolbar.abrir": "Open",
  "toolbar.propiedades": "Properties",
  "toolbar.mas": "⋯",
  "toolbar.masTooltip": "More actions",
  "toolbar.reglasTooltip": "Color rows or words based on a pattern",
  "toolbar.reglasVacio": "Rules…",
  "toolbar.tailEtiqueta": "tail",
  "toolbar.autoscrollEtiqueta": "auto",
  "toolbar.tailSeguirTooltip": "Follow the file live",
  "toolbar.tailDetenerTooltip": "Stop live tail",
  "toolbar.tailNoDisponibleTooltip": "Not available when combining several files",
  "toolbar.autoscrollActivarTooltip": "Enable autoscroll",
  "toolbar.autoscrollDesactivarTooltip": "Disable autoscroll",
  "toolbar.filtroPlaceholder": "Filter by text…",

  // Panel de propiedades del fichero: lo detectado (solo lectura) y los
  // controles con los que se vuelve a abrir.
  "props.titulo": "File properties",
  "props.rutas": "Paths",
  "props.tamano": "Size",
  "props.lineas": "Lines",
  "props.parserDetectado": "Detected parser",
  "props.codificacionDetectada": "Detected encoding",
  "props.formato": "Format",
  "props.formatoTooltip": "How to interpret each line of the file",
  "props.delimitador": "Delimiter",
  "props.delimitadorTooltip": "Delimiter",
  "props.patron": "Pattern",
  "props.patronTooltip": "Regex with named groups",
  "props.codificacion": "Encoding",
  "props.codificacionTooltip": "Encoding of the file bytes",
  "props.columnas": "Columns…",
  "props.columnasTooltip": "Assign each line of the record to its column",
  "props.cerrar": "Close",
  "props.aplicar": "Apply and reload",

  // Nombres visibles de las codificaciones. El valor de la opción sigue en
  // `types.ts`: aquí solo va lo que se lee en el desplegable.
  "props.encoding.auto": "auto",
  "props.encoding.utf8": "UTF-8",
  "props.encoding.utf16le": "UTF-16 LE",
  "props.encoding.utf16be": "UTF-16 BE",
  "props.encoding.utf32le": "UTF-32 LE",
  "props.encoding.utf32be": "UTF-32 BE",
  "props.encoding.windows1252": "Windows-1252",
  "props.encoding.windows1250": "Windows-1250",
  "props.encoding.windows1251": "Windows-1251",
  "props.encoding.cp850": "CP850 (console)",
  "props.encoding.cp437": "CP437 (DOS)",
  "props.encoding.iso8859-15": "ISO-8859-15",
  "props.encoding.koi8-r": "KOI8-R",
  "props.encoding.shift_jis": "Shift-JIS",
  "props.encoding.gbk": "GBK",
  "props.encoding.big5": "Big5",
  "props.encoding.euc-jp": "EUC-JP",

  // Diálogo «Acerca de».
  "about.titulo": "About LogScope",
  "about.version": "Version {version}",
  "about.sinVersion": "Version not available",
  "about.descripcion": "Log viewer for Windows.",
  "about.cerrar": "Close",

  // Rejilla de entradas.
  "grid.numeroLineaTooltip": "Line number in the file",
  "grid.anchoTooltip": "Drag to change the width",
  "grid.cargando": "loading…",

  // Explorador de ficheros.
  "browser.titulo": "Open log file",
  "browser.filtroPlaceholder": "Filter by name…",
  "browser.cerrar": "Close",
  "browser.cargandoUnidades": "Loading drives…",
  "browser.leyendo": "Reading…",
  "browser.seleccionVacia":
    "mark one or more files (files of different formats are combined by time)",
  "browser.seleccionados": "{n} files selected",
  "browser.abrirTooltipVarios": "Open each marked file in its own tab",
  "browser.abrirTooltipUno": "Open the marked file",
  "browser.abrir": "Open",
  "browser.abrirN": "Open ({n})",
  "browser.combinar": "Combine ",
  "browser.combinarN": "Combine ({n})",
  "browser.combinarTooltip": "Combine the marked files in timestamp order",

  // Editor de columnas.
  "cols.titulo": "Entry columns",
  "cols.pista": "Each line of the record goes into one column. `ignore` drops it.",
  "cols.cerrar": "Close",
  "cols.linea": "Line {n}",
  "cols.vacia": "(empty)",
  "cols.sinEntradas": "This file has no multi-line entries.",
  "cols.avisoSinTime": "warning: no line marked as time",
  "cols.cancelar": "Cancel",
  "cols.aplicando": "Applying…",
  "cols.aplicar": "Apply",

  // Reglas de color.
  "rules.arrastrarTooltip": "Drag this bar to move the window",
  "rules.titulo": "Color rules",
  "rules.pista": "Text or regular expression matches. The first matching rule wins.",
  "rules.cerrar": "Close",
  "rules.vacio": "No rules. Add one to color rows or words.",
  "rules.patronRegexPlaceholder": "regular expression",
  "rules.patronTextoPlaceholder": "text to search for",
  "rules.regexInvalidaTooltip": "Invalid regular expression: the rule is ignored",
  "rules.palabra": "word",
  "rules.filaEntera": "whole row",
  "rules.caseSensitiveTooltip":
    "Distinguish upper and lower case. Unchecked, matching ignores case.",
  "rules.eliminarTooltip": "Delete rule",
  "rules.regexInvalida":
    "Invalid regular expression: this rule colors nothing until you fix it.",
  "rules.totalUna": "{n} rule",
  "rules.totalVarias": "{n} rules",
  "rules.anadir": "Add rule",
  "rules.hecho": "Done",

  // Panel de ajustes.
  "settings.titulo": "Settings",
  "settings.pista": "Preferences saved on this computer.",
  "settings.cerrar": "Close",
  "settings.idioma": "Language",
  "settings.idiomaTooltip": "Interface language",
  "settings.reabrir": "Reopen the last logs on startup",
  "settings.iniciarTail": "Start with live tail on",
  "settings.notaTail":
    "When you open a log, it starts following it on its own. Not applied to combined views, where the order would be recalculated on every line.",
  "settings.iniciarAutoscroll": "Start with autoscroll on",
  "settings.notaAutoscroll":
    "Applied on startup and when each log is opened. You can turn it off at any time with the toolbar switch or by scrolling the wheel up.",
  "settings.ultimos": "Recently remembered logs",
  "settings.parser": "Parser {parser}",
  "settings.columnasForzadas": " · {n} forced columns",
  "settings.olvidar": "Forget these logs",
  "settings.sinLogs": "No log has been opened yet.",
  "settings.hecho": "Done",

  // Menú de pestaña.
  "tab.vistaCombinada": "Combined view",
  "tab.cerrar": "Close",
  "tab.ficheros": "{n} files",
  "tab.combinarN": "Combine {n} tabs",
  "tab.combinarVacio": "Combine tabs…",
  "tab.combinarTooltipDeshabilitado":
    "Mark two or more tabs with Ctrl+click and reopen this menu",
  "tab.combinarTooltip": "Open a combined view with these tabs, ordered by timestamp",
  "tab.copiarColorizacion": "Copy coloring from…",
  "tab.sinOrigenesTooltip": "No other log has color rules yet",
  "tab.copiarTooltip": "Copy another log's rules to this one",
  "tab.recargarTooltip": "Reloads the interface. Open tabs will be closed.",
  "tab.recargar": "Reload interface",
  "tab.imprimir": "Print…",
  "tab.atras": "← Back",

  // Menú de selección.
  "sel.copiar": "Copy",
  "sel.reglasTooltip": "Open the color rules with this text as the pattern",
  "sel.reglasCon": "Color rules with «{texto}»",
  "sel.filasSeleccionadas": "{n} lines selected",
  "sel.copiarFilas": "Copy selection",
  "sel.copiarFilasNumeros": "Copy with line numbers",
  "sel.quitarSeleccion": "Clear selection",
  "sel.copiando": "Copying…",
  "sel.demasiadasFilas":
    "The selection is too large for the clipboard: {n} lines",

  // Pie de estado.
  "status.sinSesion": "no session",
  "status.lineas": "{total} lines",
  "status.ficheros": " · {total} files",
  "status.tailActivo": "tail active",
  "status.tailParado": "tail stopped",
  "status.pestana": "{n} tab",
  "status.pestanas": "{n} tabs",
  "status.regla": "{n} rule",
  "status.reglas": "{n} rules",

  // Errores del núcleo. El código del JSON (`{"code":…}`) elige la clave
  // `error.<código>`; `io` reenvía el texto original del sistema sin adornos.
  "error.pattern_missing": "pattern parser needs the pattern field",
  "error.unknown_parser": "unknown parser: {parser}",
  "error.open_failed": "cannot open: {message}",
  "error.io": "{message}",
  "error.read_failed": "read error: {message}",
  "error.combine_without_timestamps":
    "cannot combine: {file} has no date and time column",
  "error.no_session": "unknown session: {id}",
  "error.no_file_selected": "no file was given",
  "error.not_a_file": "not a file: {path}",
  "error.tail_merged":
    "live tail is only available with a single file: in a combined view the order would be recalculated on every line",
  "error.invalid_regex": "invalid regex: {message}",
  "error.pattern_needs_named_group":
    "the pattern needs at least one named group, e.g. (?P<Message>.*)",
  "error.not_a_directory": "not a directory: {path}",
};
