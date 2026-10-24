import type { ClaveTexto } from "./es";

/**
 * Catálogo en italiano.
 *
 * Traducción del original castellano de `es.ts`, con las mismas claves, en el
 * mismo orden y con los mismos marcadores `{nombre}`. Los nombres de parser,
 * las codificaciones, los niveles y la clave `tail` se dejan tal cual.
 */
export const IT: Record<ClaveTexto, string> = {
  // Zona de aplicación: capa de arrastre y estados vacíos.
  "app.soltar": "Rilascia il file per aprirlo",
  "app.soltarDetalle": "Si apre in una scheda nuova. Se ne rilasci più di uno, una per file.",
  "app.vacio": "Apri un file di log per iniziare.",
  "app.cerrarMensaje": "Chiudi il messaggio",
  "app.tailMerged":
    "Il tail dal vivo è disponibile solo con un unico file: in una vista combinata l'ordine verrebbe ricalcolato a ogni riga.",

  // Menú de aplicación.
  "menu.archivo": "File",
  "menu.ver": "Visualizza",
  "menu.herramientas": "Strumenti",
  "menu.ayuda": "Aiuto",
  "menu.abrir": "Apri…",
  "menu.reabrirUltimo": "Riapri l'ultimo log",
  "menu.salir": "Esci",
  "menu.tailEnVivo": "Tail dal vivo",
  "menu.autoscroll": "Autoscroll",
  "menu.propiedades": "Proprietà del file…",
  "menu.reglas": "Regole di colore…",
  "menu.ajustes": "Impostazioni…",
  "menu.acercaDe": "Informazioni su LogScope",

  // Barra de herramientas.
  "toolbar.rutaPlaceholder": "C:\\percorso\\del\\file.log",
  "toolbar.examinarTooltip": "Sfoglia l'albero delle cartelle",
  "toolbar.examinar": "Sfoglia…",
  "toolbar.abriendo": "Apertura…",
  "toolbar.abrir": "Apri",
  "toolbar.propiedades": "Proprietà",
  "toolbar.mas": "⋯",
  "toolbar.masTooltip": "Altre azioni",
  "toolbar.reglasTooltip": "Colora righe o parole in base a un pattern",
  "toolbar.reglasVacio": "Regole…",
  "toolbar.tailEtiqueta": "tail",
  "toolbar.autoscrollEtiqueta": "auto",
  "toolbar.tailSeguirTooltip": "Segui il file dal vivo",
  "toolbar.tailDetenerTooltip": "Ferma il tail dal vivo",
  "toolbar.tailNoDisponibleTooltip": "Non disponibile quando si combinano più file",
  "toolbar.autoscrollActivarTooltip": "Attiva l'autoscroll",
  "toolbar.autoscrollDesactivarTooltip": "Disattiva l'autoscroll",
  "toolbar.filtroPlaceholder": "Filtra per testo…",

  // Panel de propiedades del fichero.
  "props.titulo": "Proprietà del file",
  "props.rutas": "Percorsi",
  "props.tamano": "Dimensione",
  "props.lineas": "Righe",
  "props.parserDetectado": "Parser rilevato",
  "props.codificacionDetectada": "Codifica rilevata",
  "props.formato": "Formato",
  "props.formatoTooltip": "Come interpretare ogni riga del file",
  "props.delimitador": "Delimitatore",
  "props.delimitadorTooltip": "Delimitatore",
  "props.patron": "Pattern",
  "props.patronTooltip": "Regex con gruppi denominati",
  "props.zona": "Fuso del log",
  "props.zonaTooltip": "Fuso orario in cui è stato scritto il file; influisce sull'ordine della vista combinata e sui filtri per data",
  "props.zonaEquipo": "Quello del computer",
  "props.codificacion": "Codifica",
  "props.codificacionTooltip": "Codifica dei byte del file",
  "props.columnas": "Colonne…",
  "props.columnasTooltip": "Assegna ogni riga della voce alla sua colonna",
  "props.cerrar": "Chiudi",
  "props.aplicar": "Applica e ricarica",

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
  "props.encoding.cp850": "CP850 (console)",
  "props.encoding.cp437": "CP437 (DOS)",
  "props.encoding.iso8859-15": "ISO-8859-15",
  "props.encoding.koi8-r": "KOI8-R",
  "props.encoding.shift_jis": "Shift-JIS",
  "props.encoding.gbk": "GBK",
  "props.encoding.big5": "Big5",
  "props.encoding.euc-jp": "EUC-JP",

  // Diálogo «Acerca de».
  "about.titulo": "Informazioni su LogScope",
  "about.version": "Versione {version}",
  "about.sinVersion": "Versione non disponibile",
  "about.descripcion": "Visualizzatore di log per Windows.",
  "about.cerrar": "Chiudi",

  // Rejilla de entradas.
  "grid.numeroLineaTooltip": "Numero di riga nel file",
  "grid.anchoTooltip": "Trascina per cambiare la larghezza",
  "grid.cargando": "caricamento…",

  // Explorador de ficheros.
  "browser.titulo": "Apri file di log",
  "browser.filtroPlaceholder": "Filtra per nome…",
  "browser.cerrar": "Chiudi",
  "browser.cargandoUnidades": "Caricamento unità…",
  "browser.leyendo": "Lettura…",
  "browser.seleccionVacia":
    "seleziona uno o più file (quelli di formati diversi si combinano per ora)",
  "browser.seleccionados": "{n} file selezionati",
  "browser.abrirTooltipVarios": "Apri ogni file selezionato in una scheda separata",
  "browser.abrirTooltipUno": "Apri il file selezionato",
  "browser.abrir": "Apri",
  "browser.abrirN": "Apri ({n})",
  "browser.combinar": "Combina ",
  "browser.combinarN": "Combina ({n})",
  "browser.combinarTooltip": "Combina i file selezionati in ordine di istante",

  // Editor de columnas.
  "cols.titulo": "Colonne della voce",
  "cols.pista": "Ogni riga della voce va in una colonna. `ignore` la scarta.",
  "cols.cerrar": "Chiudi",
  "cols.linea": "Riga {n}",
  "cols.vacia": "(vuota)",
  "cols.sinEntradas": "Questo file non ha voci su più righe.",
  "cols.avisoSinTime": "avviso: nessuna riga contrassegnata come time",
  "cols.cancelar": "Annulla",
  "cols.aplicando": "Applicazione…",
  "cols.aplicar": "Applica",

  // Reglas de color.
  "rules.arrastrarTooltip": "Trascina questa barra per spostare la finestra",
  "rules.titulo": "Regole di colore",
  "rules.pista":
    "Corrispondenze di testo o espressioni regolari. Vince la prima regola che corrisponde.",
  "rules.cerrar": "Chiudi",
  "rules.vacio": "Nessuna regola. Aggiungine una per colorare righe o parole.",
  "rules.patronRegexPlaceholder": "espressione regolare",
  "rules.patronTextoPlaceholder": "testo da cercare",
  "rules.regexInvalidaTooltip": "Espressione regolare non valida: la regola viene ignorata",
  "rules.palabra": "parola",
  "rules.filaEntera": "riga intera",
  "rules.caseSensitiveTooltip":
    "Distingui maiuscole e minuscole. Se non è selezionato, la corrispondenza non distingue.",
  "rules.eliminarTooltip": "Elimina regola",
  "rules.regexInvalida":
    "Espressione regolare non valida: questa regola non colora nulla finché non la correggi.",
  "rules.totalUna": "{n} regola",
  "rules.totalVarias": "{n} regole",
  "rules.anadir": "Aggiungi regola",
  "rules.hecho": "Fatto",

  // Panel de ajustes.
  "settings.titulo": "Impostazioni",
  "settings.pista": "Preferenze salvate su questo computer.",
  "settings.cerrar": "Chiudi",
  "settings.idioma": "Lingua",
  "settings.idiomaTooltip": "Lingua dell'interfaccia",
  "settings.reabrir": "Riapri gli ultimi log all'avvio",
  "settings.iniciarTail": "Avvia con il tail dal vivo attivo",
  "settings.notaTail":
    "All'apertura di un log, inizia a seguirlo da solo. Non si applica alle viste combinate, dove l'ordine verrebbe ricalcolato a ogni riga.",
  "settings.iniciarAutoscroll": "Avvia con l'autoscroll attivo",
  "settings.notaAutoscroll":
    "Si applica all'avvio e all'apertura di ogni log. Puoi disattivarlo in qualsiasi momento con l'interruttore della barra o spostando la rotella verso l'alto.",
  "settings.ultimos": "Ultimi log ricordati",
  "settings.parser": "Parser {parser}",
  "settings.columnasForzadas": " · {n} colonne forzate",
  "settings.olvidar": "Dimentica questi log",
  "settings.sinLogs": "Non è ancora stato aperto nessun log.",
  "settings.hecho": "Fatto",

  // Menú de pestaña.
  "tab.vistaCombinada": "Vista combinata",
  "tab.cerrar": "Chiudi",
  "tab.ficheros": "{n} file",
  "tab.combinarN": "Combina {n} schede",
  "tab.combinarVacio": "Combina schede…",
  "tab.combinarTooltipDeshabilitado":
    "Seleziona due o più schede con Ctrl+clic e riapri questo menu",
  "tab.combinarTooltip":
    "Apri una vista combinata con queste schede, ordinata per istante",
  "tab.copiarColorizacion": "Copia la colorazione da…",
  "tab.sinOrigenesTooltip": "Nessun altro log ha ancora regole di colore",
  "tab.copiarTooltip": "Copia le regole di un altro log in questo",
  "tab.recargarTooltip": "Ricarica l'interfaccia. Le schede aperte vengono chiuse.",
  "tab.recargar": "Ricarica interfaccia",
  "tab.imprimir": "Stampa…",
  "tab.atras": "← Indietro",

  // Menú de selección.
  "sel.copiar": "Copia",
  "sel.reglasTooltip": "Apri le regole di colore con questo testo come pattern",
  "sel.reglasCon": "Regole di colore con «{texto}»",
  "sel.filasSeleccionadas": "{n} righe selezionate",
  "sel.copiarFilas": "Copia selezione",
  "sel.copiarFilasNumeros": "Copia con numeri di riga",
  "sel.exportar": "Esporta selezione",
  "sel.exportarNumeros": "Esporta con numeri di riga",
  "sel.quitarSeleccion": "Deseleziona",
  "sel.copiando": "Copia in corso…",
  "sel.exportando": "Esportazione in corso…",
  "sel.exportado": "Esportato in {ruta}",
  "sel.demasiadasFilas":
    "La selezione è troppo grande per gli appunti: {n} righe",

  // Pie de estado.
  "status.sinSesion": "senza sessione",
  "status.lineas": "{total} righe",
  "status.ficheros": " · {total} file",
  "status.tailActivo": "tail attivo",
  "status.tailParado": "tail fermo",
  "status.pestana": "{n} scheda",
  "status.pestanas": "{n} schede",
  "status.regla": "{n} regola",
  "status.reglas": "{n} regole",

  // Errores del núcleo.
  "error.pattern_missing": "il parser pattern richiede il campo pattern",
  "error.unknown_parser": "parser sconosciuto: {parser}",
  "error.open_failed": "impossibile aprire: {message}",
  "error.io": "{message}",
  "error.read_failed": "errore di lettura: {message}",
  "error.combine_without_timestamps":
    "impossibile combinare: {file} non ha una colonna di data e ora",
  "error.no_session": "sessione sconosciuta: {id}",
  "error.no_file_selected": "non è stato indicato nessun file",
  "error.not_a_file": "non è un file: {path}",
  "error.tail_merged":
    "il tail dal vivo è disponibile solo con un unico file: in una vista combinata l'ordine verrebbe ricalcolato a ogni riga",
  "error.invalid_regex": "regex non valida: {message}",
  "error.pattern_needs_named_group":
    "il pattern richiede almeno un gruppo denominato, ad es. (?P<Message>.*)",
  "error.not_a_directory": "non è una cartella: {path}",
  "error.export_empty": "la selezione è vuota",
  "error.export_failed": "impossibile esportare: {message}",
};
