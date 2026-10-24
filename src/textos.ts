/**
 * Catálogo central de textos visibles.
 *
 * Es plano y serializable a propósito: solo cadenas, sin funciones ni JSX, para
 * que se pueda volcar a JSON o cargar desde otro idioma sin tocar los
 * componentes. Las claves llevan el espacio de nombres de la zona de la interfaz
 * (`app.`, `toolbar.`, `grid.`, `browser.`, `cols.`, `rules.`, `settings.`,
 * `tab.`, `sel.`, `status.`, `error.`).
 *
 * Los marcadores `{nombre}` se sustituyen con los parámetros de `t`. Si falta un
 * parámetro, el marcador se deja tal cual; los parámetros de más se ignoran.
 */
export type Idioma = "es";

const ES = {
  // Zona de aplicación: capa de arrastre y estados vacíos.
  "app.soltar": "Suelta el fichero para abrirlo",
  "app.soltarDetalle": "Se abre en una pestaña nueva. Si sueltas varios, una por fichero.",
  "app.vacio": "Abre un fichero de log para empezar.",
  "app.cerrarMensaje": "Cerrar el mensaje",
  "app.tailMerged":
    "El tail en vivo solo está disponible con un único fichero: en una vista combinada el orden se recalcularía en cada línea.",

  // Barra de herramientas.
  "toolbar.rutaPlaceholder": "C:\\ruta\\al\\fichero.log",
  "toolbar.examinarTooltip": "Navegar por el árbol de directorios",
  "toolbar.examinar": "Examinar…",
  "toolbar.abriendo": "Abriendo…",
  "toolbar.abrir": "Abrir",
  "toolbar.columnasTooltip": "Asignar cada línea del registro a su columna",
  "toolbar.columnas": "Columnas…",
  "toolbar.reglasTooltip": "Colorear filas o palabras según un patrón",
  "toolbar.reglas": "Reglas",
  "toolbar.reglasN": "Reglas ({n})",
  "toolbar.reglasVacio": "Reglas…",
  "toolbar.tailSeguirTooltip": "Seguir el fichero en vivo",
  "toolbar.tailNoDisponibleTooltip": "No disponible al combinar varios ficheros",
  "toolbar.detenerTail": "Detener tail",
  "toolbar.tailEnVivo": "Tail en vivo",
  "toolbar.autoscroll": "Autoscroll",
  "toolbar.ajustesTooltip": "Ajustes",
  "toolbar.filtroPlaceholder": "Filtrar por texto…",
  "toolbar.delimitadorTooltip": "Delimitador",
  "toolbar.patronTooltip": "Regex con grupos con nombre",
  "toolbar.formato": "Formato",
  "toolbar.formatoTooltip": "Cómo interpretar cada línea del fichero",
  "toolbar.codificacion": "Codificación",
  "toolbar.codificacionDetectadaTooltip": "Detectada en el log abierto: {encoding}",
  "toolbar.codificacionTooltip": "Codificación de los bytes del fichero",

  // Nombres visibles de las codificaciones. El valor de la opción sigue en
  // `types.ts`: aquí solo va lo que se lee en el desplegable.
  "toolbar.encoding.auto": "auto",
  "toolbar.encoding.utf8": "UTF-8",
  "toolbar.encoding.utf16le": "UTF-16 LE",
  "toolbar.encoding.utf16be": "UTF-16 BE",
  "toolbar.encoding.utf32le": "UTF-32 LE",
  "toolbar.encoding.utf32be": "UTF-32 BE",
  "toolbar.encoding.windows1252": "Windows-1252",
  "toolbar.encoding.windows1250": "Windows-1250",
  "toolbar.encoding.windows1251": "Windows-1251",
  "toolbar.encoding.cp850": "CP850 (consola)",
  "toolbar.encoding.cp437": "CP437 (DOS)",
  "toolbar.encoding.iso8859-15": "ISO-8859-15",
  "toolbar.encoding.koi8-r": "KOI8-R",
  "toolbar.encoding.shift_jis": "Shift-JIS",
  "toolbar.encoding.gbk": "GBK",
  "toolbar.encoding.big5": "Big5",
  "toolbar.encoding.euc-jp": "EUC-JP",

  // Rejilla de entradas.
  "grid.numeroLineaTooltip": "Número de línea en el fichero",
  "grid.anchoTooltip": "Arrastra para cambiar el ancho",
  "grid.cargando": "cargando…",

  // Explorador de ficheros.
  "browser.titulo": "Abrir fichero de log",
  "browser.filtroPlaceholder": "Filtrar por nombre…",
  "browser.cerrar": "Cerrar",
  "browser.cargandoUnidades": "Cargando unidades…",
  "browser.leyendo": "Leyendo…",
  "browser.seleccionVacia":
    "marca uno o varios ficheros (los de distintos formatos se combinan por hora)",
  "browser.seleccionados": "{n} ficheros seleccionados",
  "browser.abrirTooltipVarios": "Abrir cada fichero marcado en su propia pestaña",
  "browser.abrirTooltipUno": "Abrir el fichero marcado",
  "browser.abrir": "Abrir",
  "browser.abrirN": "Abrir ({n})",
  "browser.combinar": "Combinar ",
  "browser.combinarN": "Combinar ({n})",
  "browser.combinarTooltip": "Combinar los ficheros marcados en orden de instante",

  // Editor de columnas.
  "cols.titulo": "Columnas de la entrada",
  "cols.pista": "Cada línea del registro va a una columna. `ignore` la descarta.",
  "cols.cerrar": "Cerrar",
  "cols.linea": "Línea {n}",
  "cols.vacia": "(vacía)",
  "cols.sinEntradas": "Este fichero no tiene entradas de varias líneas.",
  "cols.avisoSinTime": "aviso: ninguna línea marcada como time",
  "cols.cancelar": "Cancelar",
  "cols.aplicando": "Aplicando…",
  "cols.aplicar": "Aplicar",

  // Reglas de color.
  "rules.arrastrarTooltip": "Arrastra esta barra para mover la ventana",
  "rules.titulo": "Reglas de color",
  "rules.pista":
    "Coincidencias de texto o expresión regular. La primera regla que coincide gana.",
  "rules.cerrar": "Cerrar",
  "rules.vacio": "Sin reglas. Añade una para colorear filas o palabras.",
  "rules.patronRegexPlaceholder": "expresión regular",
  "rules.patronTextoPlaceholder": "texto a buscar",
  "rules.regexInvalidaTooltip": "Expresión regular no válida: la regla se ignora",
  "rules.palabra": "palabra",
  "rules.filaEntera": "fila entera",
  "rules.caseSensitiveTooltip":
    "Distinguir mayúsculas y minúsculas. Desmarcado, la coincidencia no distingue.",
  "rules.eliminarTooltip": "Eliminar regla",
  "rules.regexInvalida":
    "Expresión regular no válida: esta regla no colorea nada hasta que la corrijas.",
  "rules.totalUna": "{n} regla",
  "rules.totalVarias": "{n} reglas",
  "rules.anadir": "Añadir regla",
  "rules.hecho": "Hecho",

  // Panel de ajustes.
  "settings.titulo": "Ajustes",
  "settings.pista": "Preferencias guardadas en este equipo.",
  "settings.cerrar": "Cerrar",
  "settings.reabrir": "Reabrir los últimos logs al arrancar",
  "settings.iniciarTail": "Iniciar con el tail en vivo activo",
  "settings.notaTail":
    "Al abrir un log, empieza a seguirlo solo. No se aplica a las vistas combinadas, donde el orden se recalcularía en cada línea.",
  "settings.iniciarAutoscroll": "Iniciar con el autoscroll activo",
  "settings.notaAutoscroll":
    "Se aplica al arrancar y al abrir cada log. Puedes desmarcarlo en cualquier momento con la casilla de la barra o moviendo la rueda hacia arriba.",
  "settings.ultimos": "Últimos logs recordados",
  "settings.parser": "Parser {parser}",
  "settings.columnasForzadas": " · {n} columnas forzadas",
  "settings.olvidar": "Olvidar estos logs",
  "settings.sinLogs": "Todavía no se ha abierto ningún log.",
  "settings.hecho": "Hecho",

  // Menú de pestaña.
  "tab.vistaCombinada": "Vista combinada",
  "tab.cerrar": "Cerrar",
  "tab.ficheros": "{n} ficheros",
  "tab.combinarN": "Combinar {n} pestañas",
  "tab.combinarVacio": "Combinar pestañas…",
  "tab.combinarTooltipDeshabilitado":
    "Marca dos o más pestañas con Ctrl+clic y vuelve a abrir este menú",
  "tab.combinarTooltip":
    "Abrir una vista combinada con estas pestañas, ordenada por instante",
  "tab.copiarColorizacion": "Copiar colorización de…",
  "tab.sinOrigenesTooltip": "Ningún otro log tiene reglas de color todavía",
  "tab.copiarTooltip": "Copiar las reglas de otro log a este",
  "tab.recargarTooltip": "Recarga la interfaz. Se cierran las pestañas abiertas.",
  "tab.recargar": "Recargar interfaz",
  "tab.imprimir": "Imprimir…",
  "tab.atras": "← Atrás",

  // Menú de selección.
  "sel.copiar": "Copiar",
  "sel.reglasTooltip": "Abrir las reglas de color con este texto como patrón",
  "sel.reglasCon": "Reglas de color con «{texto}»",

  // Pie de estado.
  "status.sinSesion": "sin sesión",
  "status.lineas": "{total} líneas",
  "status.ficheros": " · {total} ficheros",
  "status.tailActivo": "tail activo",
  "status.tailParado": "tail parado",
  "status.pestana": "{n} pestaña",
  "status.pestanas": "{n} pestañas",
  "status.regla": "{n} regla",
  "status.reglas": "{n} reglas",

  // Errores del núcleo. El código del JSON (`{"code":…}`) elige la clave
  // `error.<código>`; `io` reenvía el texto original del sistema sin adornos.
  "error.pattern_missing": "el parser pattern necesita el campo pattern",
  "error.unknown_parser": "parser desconocido: {parser}",
  "error.open_failed": "no se puede abrir: {message}",
  "error.io": "{message}",
  "error.read_failed": "error de lectura: {message}",
  "error.combine_without_timestamps":
    "no se puede combinar: {file} no tiene columna de fecha y hora",
  "error.no_session": "sesión desconocida: {id}",
  "error.no_file_selected": "no se indicó ningún fichero",
  "error.not_a_file": "no es un fichero: {path}",
  "error.tail_merged":
    "el tail en vivo solo está disponible con un único fichero: en una vista combinada el orden se recalcularía en cada línea",
  "error.invalid_regex": "regex inválida: {message}",
  "error.pattern_needs_named_group":
    "el patrón necesita al menos un grupo con nombre, p.ej. (?P<Message>.*)",
  "error.not_a_directory": "no es un directorio: {path}",
} as const;

export type ClaveTexto = keyof typeof ES;

export const IDIOMAS: Idioma[] = ["es"];

const DICCIONARIOS: Record<Idioma, Record<ClaveTexto, string>> = {
  es: ES,
};

/** Diccionario completo de un idioma, para poder añadir otros más adelante. */
export function textosDe(idioma: Idioma): Record<ClaveTexto, string> {
  return DICCIONARIOS[idioma];
}

/** ¿Existe la clave? Sirve para resolver códigos que llegan en tiempo de ejecución. */
export function esClave(clave: string): clave is ClaveTexto {
  return Object.prototype.hasOwnProperty.call(ES, clave);
}

function sustituir(plantilla: string, params?: Record<string, string | number>): string {
  if (!params) return plantilla;
  return plantilla.replace(/\{([A-Za-z0-9_]+)\}/g, (marcador, nombre: string) =>
    Object.prototype.hasOwnProperty.call(params, nombre)
      ? String(params[nombre])
      : marcador,
  );
}

/** Texto del catálogo con los marcadores `{param}` ya sustituidos. */
export function t(
  clave: ClaveTexto,
  params?: Record<string, string | number>,
): string {
  return sustituir(ES[clave], params);
}
