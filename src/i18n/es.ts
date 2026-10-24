/**
 * Catálogo en castellano: es el original del que salen los tipos.
 *
 * Las claves llevan el espacio de nombres de la zona de la interfaz (`app.`,
 * `toolbar.`, `grid.`, `browser.`, `cols.`, `rules.`, `settings.`, `tab.`,
 * `sel.`, `status.`, `menu.`, `props.`, `about.`, `error.`). Los marcadores
 * `{nombre}` los sustituye `t` en `textos.ts`.
 */
export const ES = {
  // Zona de aplicación: capa de arrastre y estados vacíos.
  "app.soltar": "Suelta el fichero para abrirlo",
  "app.soltarDetalle": "Se abre en una pestaña nueva. Si sueltas varios, una por fichero.",
  "app.vacio": "Abre un fichero de log para empezar.",
  "app.cerrarMensaje": "Cerrar el mensaje",
  "app.tailMerged":
    "El tail en vivo solo está disponible con un único fichero: en una vista combinada el orden se recalcularía en cada línea.",

  // Menú de aplicación. Se construye desde la interfaz para que los rótulos
  // salgan de este catálogo; los ítems nativos no traducen nada por su cuenta.
  "menu.archivo": "Archivo",
  "menu.ver": "Ver",
  "menu.herramientas": "Herramientas",
  "menu.ayuda": "Ayuda",
  "menu.abrir": "Abrir…",
  "menu.reabrirUltimo": "Reabrir último log",
  "menu.salir": "Salir",
  "menu.tailEnVivo": "Tail en vivo",
  "menu.autoscroll": "Autoscroll",
  "menu.propiedades": "Propiedades del fichero…",
  "menu.reglas": "Reglas de color…",
  "menu.ajustes": "Ajustes…",
  "menu.acercaDe": "Acerca de LogScope",

  // Barra de herramientas.
  "toolbar.rutaPlaceholder": "C:\\ruta\\al\\fichero.log",
  "toolbar.examinarTooltip": "Navegar por el árbol de directorios",
  "toolbar.examinar": "Examinar…",
  "toolbar.abriendo": "Abriendo…",
  "toolbar.abrir": "Abrir",
  "toolbar.propiedades": "Propiedades",
  "toolbar.mas": "⋯",
  "toolbar.masTooltip": "Más acciones",
  "toolbar.reglasTooltip": "Colorear filas o palabras según un patrón",
  "toolbar.reglasVacio": "Reglas…",
  "toolbar.tailEtiqueta": "tail",
  "toolbar.autoscrollEtiqueta": "auto",
  "toolbar.tailSeguirTooltip": "Seguir el fichero en vivo",
  "toolbar.tailDetenerTooltip": "Detener el tail en vivo",
  "toolbar.tailNoDisponibleTooltip": "No disponible al combinar varios ficheros",
  "toolbar.autoscrollActivarTooltip": "Activar el autoscroll",
  "toolbar.autoscrollDesactivarTooltip": "Desactivar el autoscroll",
  "toolbar.filtroPlaceholder": "Filtrar por texto…",
  "toolbar.filtroAvanzadoActivoTooltip":
    "El filtro avanzado sustituye este control mientras esté activo",

  // Panel de propiedades del fichero: lo detectado (solo lectura) y los
  // controles con los que se vuelve a abrir.
  "props.titulo": "Propiedades del fichero",
  "props.rutas": "Rutas",
  "props.tamano": "Tamaño",
  "props.lineas": "Líneas",
  "props.parserDetectado": "Parser detectado",
  "props.codificacionDetectada": "Codificación detectada",
  "props.formato": "Formato",
  "props.formatoTooltip": "Cómo interpretar cada línea del fichero",
  "props.delimitador": "Delimitador",
  "props.delimitadorTooltip": "Delimitador",
  "props.patron": "Patrón",
  "props.patronTooltip": "Regex con grupos con nombre",
  "props.zona": "Zona del log",
  "props.zonaTooltip": "Zona horaria en la que está escrito el fichero; afecta al orden de la vista combinada y a los filtros por fecha",
  "props.zonaEquipo": "La del equipo",
  "props.codificacion": "Codificación",
  "props.codificacionTooltip": "Codificación de los bytes del fichero",
  "props.columnas": "Columnas…",
  "props.columnasTooltip": "Asignar cada línea del registro a su columna",
  "props.cerrar": "Cerrar",
  "props.aplicar": "Aplicar y recargar",

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
  "props.encoding.cp850": "CP850 (consola)",
  "props.encoding.cp437": "CP437 (DOS)",
  "props.encoding.iso8859-15": "ISO-8859-15",
  "props.encoding.koi8-r": "KOI8-R",
  "props.encoding.shift_jis": "Shift-JIS",
  "props.encoding.gbk": "GBK",
  "props.encoding.big5": "Big5",
  "props.encoding.euc-jp": "EUC-JP",

  // Diálogo «Acerca de».
  "about.titulo": "Acerca de LogScope",
  "about.version": "Versión {version}",
  "about.sinVersion": "Versión no disponible",
  "about.descripcion": "Visor de registros de log para Windows.",
  "about.cerrar": "Cerrar",

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
  "settings.idioma": "Idioma",
  "settings.idiomaTooltip": "Idioma de la interfaz",
  "settings.reabrir": "Reabrir los últimos logs al arrancar",
  "settings.iniciarTail": "Iniciar con el tail en vivo activo",
  "settings.notaTail":
    "Al abrir un log, empieza a seguirlo solo. No se aplica a las vistas combinadas, donde el orden se recalcularía en cada línea.",
  "settings.iniciarAutoscroll": "Iniciar con el autoscroll activo",
  "settings.notaAutoscroll":
    "Se aplica al arrancar y al abrir cada log. Puedes desactivarlo en cualquier momento con el interruptor de la barra o moviendo la rueda hacia arriba.",
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
  "sel.filasSeleccionadas": "{n} líneas seleccionadas",
  "sel.copiarFilas": "Copiar selección",
  "sel.copiarFilasNumeros": "Copiar con números de línea",
  "sel.exportar": "Exportar selección",
  "sel.exportarNumeros": "Exportar con números de línea",
  "sel.quitarSeleccion": "Quitar selección",
  "sel.copiando": "Copiando…",
  "sel.exportando": "Exportando…",
  "sel.exportado": "Exportado a {ruta}",
  "sel.demasiadasFilas":
    "La selección es demasiado grande para el portapapeles: {n} líneas",

  // Filtro avanzado. La ventana construye la consulta que el núcleo evalúa;
  // aquí solo va lo que se lee en ella y en el chip de la barra.
  "filtro.titulo": "Filtro avanzado",
  "filtro.pista":
    "Se cumplen todos los grupos; dentro de cada grupo, sus condiciones.",
  "filtro.cerrar": "Cerrar",
  "filtro.aplicar": "Aplicar",
  "filtro.limpiar": "Limpiar",
  "filtro.grupo": "Grupo {n}",
  "filtro.anadirGrupo": "Añadir grupo",
  "filtro.quitarGrupo": "Quitar grupo",
  "filtro.anadirCondicion": "Añadir condición",
  "filtro.quitarCondicion": "Quitar condición",
  "filtro.conectorY": "Y",
  "filtro.conectorO": "O",
  "filtro.campo": "Campo",
  "filtro.campo.texto": "Texto",
  "filtro.campo.nivel": "Nivel",
  "filtro.campo.fuente": "Fuente",
  "filtro.comparacion": "Comparación",
  "filtro.comparacion.contiene": "contiene",
  "filtro.comparacion.igual": "es igual a",
  "filtro.comparacion.empiezaPor": "empieza por",
  "filtro.comparacion.terminaPor": "termina por",
  "filtro.comparacion.regex": "expresión regular",
  "filtro.valor": "Valor",
  "filtro.negada": "NO",
  "filtro.desde": "Desde",
  "filtro.hasta": "Hasta",
  "filtro.franja": "Franja horaria",
  "filtro.fuentes": "Ficheros",
  "filtro.chip": "Filtro avanzado",
  "filtro.chipTooltip": "Editar el filtro avanzado",
  "filtro.chipQuitar": "Quitar el filtro avanzado",

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
  "error.export_empty": "la selección está vacía",
  "error.export_failed": "no se pudo exportar: {message}",
} as const;

export type ClaveTexto = keyof typeof ES;
