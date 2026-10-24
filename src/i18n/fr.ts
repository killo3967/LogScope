import type { ClaveTexto } from "./es";

/**
 * Catálogo en francés.
 *
 * Misma estructura y mismo orden que `es.ts`; el tipo `Record<ClaveTexto,
 * string>` obliga a que no falte ni sobre ninguna clave. Los marcadores
 * `{nombre}` y los espacios iniciales o finales se conservan tal cual, porque
 * `t` en `textos.ts` los sustituye y los pega en el render.
 *
 * Convenciones: «tail» se traduce como «suivi» en los textos corridos y se
 * deja como `tail` en la etiqueta del interruptor; los nombres de parser,
 * codificación y nivel no se traducen.
 */
export const FR: Record<ClaveTexto, string> = {
  // Zona de aplicación: capa de arrastre y estados vacíos.
  "app.soltar": "Déposez le fichier pour l'ouvrir",
  "app.soltarDetalle": "Il s'ouvre dans un nouvel onglet. Si vous en déposez plusieurs, un onglet par fichier.",
  "app.vacio": "Ouvrez un fichier de log pour commencer.",
  "app.cerrarMensaje": "Fermer le message",
  "app.tailMerged":
    "Le suivi en direct n'est disponible qu'avec un seul fichier : dans une vue combinée, l'ordre serait recalculé à chaque ligne.",

  // Menú de aplicación.
  "menu.archivo": "Fichier",
  "menu.ver": "Affichage",
  "menu.herramientas": "Outils",
  "menu.ayuda": "Aide",
  "menu.abrir": "Ouvrir…",
  "menu.reabrirUltimo": "Rouvrir le dernier log",
  "menu.salir": "Quitter",
  "menu.tailEnVivo": "Suivi en direct",
  "menu.autoscroll": "Défilement auto",
  "menu.propiedades": "Propriétés du fichier…",
  "menu.reglas": "Règles de couleur…",
  "menu.ajustes": "Paramètres…",
  "menu.acercaDe": "À propos de LogScope",

  // Barra de herramientas.
  "toolbar.rutaPlaceholder": "C:\\chemin\\vers\\le\\fichier.log",
  "toolbar.examinarTooltip": "Parcourir l'arborescence des dossiers",
  "toolbar.examinar": "Parcourir…",
  "toolbar.abriendo": "Ouverture…",
  "toolbar.abrir": "Ouvrir",
  "toolbar.propiedades": "Propriétés",
  "toolbar.mas": "⋯",
  "toolbar.masTooltip": "Plus d'actions",
  "toolbar.reglasTooltip": "Colorer des lignes ou des mots selon un motif",
  "toolbar.reglasVacio": "Règles…",
  "toolbar.tailEtiqueta": "tail",
  "toolbar.autoscrollEtiqueta": "auto",
  "toolbar.tailSeguirTooltip": "Suivre le fichier en direct",
  "toolbar.tailDetenerTooltip": "Arrêter le suivi en direct",
  "toolbar.tailNoDisponibleTooltip": "Indisponible lors de la combinaison de plusieurs fichiers",
  "toolbar.autoscrollActivarTooltip": "Activer le défilement auto",
  "toolbar.autoscrollDesactivarTooltip": "Désactiver le défilement auto",
  "toolbar.filtroPlaceholder": "Filtrer par texte…",
  "toolbar.filtroAvanzadoActivoTooltip":
    "Le filtre avancé remplace ce contrôle tant qu'il est actif",

  // Panel de propiedades del fichero.
  "props.titulo": "Propriétés du fichier",
  "props.rutas": "Chemins",
  "props.tamano": "Taille",
  "props.lineas": "Lignes",
  "props.parserDetectado": "Parseur détecté",
  "props.codificacionDetectada": "Encodage détecté",
  "props.formato": "Format",
  "props.formatoTooltip": "Comment interpréter chaque ligne du fichier",
  "props.delimitador": "Délimiteur",
  "props.delimitadorTooltip": "Délimiteur",
  "props.patron": "Motif",
  "props.patronTooltip": "Expression régulière avec des groupes nommés",
  "props.zona": "Fuseau du journal",
  "props.zonaTooltip": "Fuseau horaire dans lequel le fichier a été écrit ; influe sur l'ordre de la vue combinée et les filtres par date",
  "props.zonaEquipo": "Celui de l'ordinateur",
  "props.codificacion": "Encodage",
  "props.codificacionTooltip": "Encodage des octets du fichier",
  "props.columnas": "Colonnes…",
  "props.columnasTooltip": "Assigner chaque ligne de l'enregistrement à sa colonne",
  "props.cerrar": "Fermer",
  "props.aplicar": "Appliquer et recharger",

  // Nombres visibles de las codificaciones: solo se traduce la aclaración
  // entre paréntesis, el nombre del códec se deja como está.
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
  "about.titulo": "À propos de LogScope",
  "about.version": "Version {version}",
  "about.sinVersion": "Version indisponible",
  "about.descripcion": "Visionneuse de logs pour Windows.",
  "about.cerrar": "Fermer",

  // Rejilla de entradas.
  "grid.numeroLineaTooltip": "Numéro de ligne dans le fichier",
  "grid.anchoTooltip": "Faites glisser pour changer la largeur",
  "grid.cargando": "chargement…",

  // Explorador de ficheros.
  "browser.titulo": "Ouvrir un fichier de log",
  "browser.filtroPlaceholder": "Filtrer par nom…",
  "browser.cerrar": "Fermer",
  "browser.cargandoUnidades": "Chargement des lecteurs…",
  "browser.leyendo": "Lecture…",
  "browser.seleccionVacia":
    "cochez un ou plusieurs fichiers (ceux de formats différents sont combinés par heure)",
  "browser.seleccionados": "{n} fichiers sélectionnés",
  "browser.abrirTooltipVarios": "Ouvrir chaque fichier coché dans son propre onglet",
  "browser.abrirTooltipUno": "Ouvrir le fichier coché",
  "browser.abrir": "Ouvrir",
  "browser.abrirN": "Ouvrir ({n})",
  "browser.combinar": "Combiner ",
  "browser.combinarN": "Combiner ({n})",
  "browser.combinarTooltip": "Combiner les fichiers cochés dans l'ordre des horodatages",

  // Editor de columnas.
  "cols.titulo": "Colonnes de l'entrée",
  "cols.pista": "Chaque ligne du journal va dans une colonne. `ignore` la rejette.",
  "cols.cerrar": "Fermer",
  "cols.linea": "Ligne {n}",
  "cols.vacia": "(vide)",
  "cols.sinEntradas": "Ce fichier n'a aucune entrée sur plusieurs lignes.",
  "cols.avisoSinTime": "avertissement : aucune ligne marquée comme time",
  "cols.cancelar": "Annuler",
  "cols.aplicando": "Application…",
  "cols.aplicar": "Appliquer",

  // Reglas de color.
  "rules.arrastrarTooltip": "Faites glisser cette barre pour déplacer la fenêtre",
  "rules.titulo": "Règles de couleur",
  "rules.pista":
    "Correspondances de texte ou d'expression régulière. La première règle qui correspond gagne.",
  "rules.cerrar": "Fermer",
  "rules.vacio": "Aucune règle. Ajoutez-en une pour colorer des lignes ou des mots.",
  "rules.patronRegexPlaceholder": "expression régulière",
  "rules.patronTextoPlaceholder": "texte à rechercher",
  "rules.regexInvalidaTooltip": "Expression régulière invalide : la règle est ignorée",
  "rules.palabra": "mot",
  "rules.filaEntera": "ligne entière",
  "rules.caseSensitiveTooltip":
    "Distinguer les majuscules et les minuscules. Décoché, la correspondance ne distingue pas.",
  "rules.eliminarTooltip": "Supprimer la règle",
  "rules.regexInvalida":
    "Expression régulière invalide : cette règle ne colore rien tant que vous ne la corrigez pas.",
  "rules.totalUna": "{n} règle",
  "rules.totalVarias": "{n} règles",
  "rules.anadir": "Ajouter une règle",
  "rules.hecho": "Terminé",

  // Panel de ajustes.
  "settings.titulo": "Paramètres",
  "settings.pista": "Préférences enregistrées sur cet ordinateur.",
  "settings.cerrar": "Fermer",
  "settings.idioma": "Langue",
  "settings.idiomaTooltip": "Langue de l'interface",
  "settings.reabrir": "Rouvrir les derniers logs au démarrage",
  "settings.iniciarTail": "Démarrer avec le suivi en direct actif",
  "settings.notaTail":
    "À l'ouverture d'un log, le suivi démarre tout seul. Ne s'applique pas aux vues combinées, où l'ordre serait recalculé à chaque ligne.",
  "settings.iniciarAutoscroll": "Démarrer avec le défilement auto actif",
  "settings.notaAutoscroll":
    "S'applique au démarrage et à l'ouverture de chaque log. Vous pouvez le désactiver à tout moment avec l'interrupteur de la barre ou en faisant défiler la molette vers le haut.",
  "settings.ultimos": "Derniers logs mémorisés",
  "settings.parser": "Parseur {parser}",
  "settings.columnasForzadas": " · {n} colonnes forcées",
  "settings.olvidar": "Oublier ces logs",
  "settings.sinLogs": "Aucun log n'a encore été ouvert.",
  "settings.hecho": "Terminé",

  // Menú de pestaña.
  "tab.vistaCombinada": "Vue combinée",
  "tab.cerrar": "Fermer",
  "tab.ficheros": "{n} fichiers",
  "tab.combinarN": "Combiner {n} onglets",
  "tab.combinarVacio": "Combiner des onglets…",
  "tab.combinarTooltipDeshabilitado":
    "Cochez deux onglets ou plus avec Ctrl+clic et rouvrez ce menu",
  "tab.combinarTooltip":
    "Ouvrir une vue combinée avec ces onglets, triée par horodatage",
  "tab.copiarColorizacion": "Copier la colorisation de…",
  "tab.sinOrigenesTooltip": "Aucun autre log n'a encore de règles de couleur",
  "tab.copiarTooltip": "Copier les règles d'un autre log vers celui-ci",
  "tab.recargarTooltip": "Recharge l'interface. Les onglets ouverts sont fermés.",
  "tab.recargar": "Recharger l'interface",
  "tab.imprimir": "Imprimer…",
  "tab.atras": "← Retour",

  // Menú de selección.
  "sel.copiar": "Copier",
  "sel.reglasTooltip": "Ouvrir les règles de couleur avec ce texte comme motif",
  "sel.reglasCon": "Règles de couleur avec « {texto} »",
  "sel.filasSeleccionadas": "{n} lignes sélectionnées",
  "sel.copiarFilas": "Copier la sélection",
  "sel.copiarFilasNumeros": "Copier avec les numéros de ligne",
  "sel.exportar": "Exporter la sélection",
  "sel.exportarNumeros": "Exporter avec les numéros de ligne",
  "sel.quitarSeleccion": "Effacer la sélection",
  "sel.copiando": "Copie…",
  "sel.exportando": "Exportation…",
  "sel.exportado": "Exporté vers {ruta}",
  "sel.demasiadasFilas":
    "La sélection est trop grande pour le presse-papiers : {n} lignes",

  // Filtro avanzado. La ventana construye la consulta que el núcleo evalúa;
  // aquí solo va lo que se lee en ella y en el chip de la barra.
  "filtro.titulo": "Filtre avancé",
  "filtro.pista":
    "Tous les groupes doivent être satisfaits ; au sein de chaque groupe, ses conditions.",
  "filtro.cerrar": "Fermer",
  "filtro.aplicar": "Appliquer",
  "filtro.limpiar": "Effacer",
  "filtro.grupo": "Groupe {n}",
  "filtro.anadirGrupo": "Ajouter un groupe",
  "filtro.quitarGrupo": "Retirer le groupe",
  "filtro.anadirCondicion": "Ajouter une condition",
  "filtro.quitarCondicion": "Retirer la condition",
  "filtro.conectorY": "ET",
  "filtro.conectorO": "OU",
  "filtro.campo": "Champ",
  "filtro.campo.texto": "Texte",
  "filtro.campo.nivel": "Niveau",
  "filtro.campo.fuente": "Source",
  "filtro.comparacion": "Comparaison",
  "filtro.comparacion.contiene": "contient",
  "filtro.comparacion.igual": "est égal à",
  "filtro.comparacion.empiezaPor": "commence par",
  "filtro.comparacion.terminaPor": "se termine par",
  "filtro.comparacion.regex": "expression régulière",
  "filtro.valor": "Valeur",
  "filtro.negada": "NON",
  "filtro.desde": "Depuis",
  "filtro.hasta": "Jusqu'à",
  "filtro.franja": "Plage horaire",
  "filtro.fuentes": "Fichiers",
  "filtro.chip": "Filtre avancé",
  "filtro.chipTooltip": "Modifier le filtre avancé",
  "filtro.chipQuitar": "Retirer le filtre avancé",

  // Pie de estado.
  "status.sinSesion": "sans session",
  "status.lineas": "{total} lignes",
  "status.ficheros": " · {total} fichiers",
  "status.tailActivo": "suivi actif",
  "status.tailParado": "suivi arrêté",
  "status.pestana": "{n} onglet",
  "status.pestanas": "{n} onglets",
  "status.regla": "{n} règle",
  "status.reglas": "{n} règles",

  // Errores del núcleo: mismo código, mensaje en francés.
  "error.pattern_missing": "le parseur pattern nécessite le champ pattern",
  "error.unknown_parser": "parseur inconnu : {parser}",
  "error.open_failed": "impossible d'ouvrir : {message}",
  "error.io": "{message}",
  "error.read_failed": "erreur de lecture : {message}",
  "error.combine_without_timestamps":
    "impossible de combiner : {file} n'a pas de colonne de date et d'heure",
  "error.no_session": "session inconnue : {id}",
  "error.no_file_selected": "aucun fichier indiqué",
  "error.not_a_file": "ce n'est pas un fichier : {path}",
  "error.tail_merged":
    "le suivi en direct n'est disponible qu'avec un seul fichier : dans une vue combinée, l'ordre serait recalculé à chaque ligne",
  "error.invalid_regex": "regex invalide : {message}",
  "error.pattern_needs_named_group":
    "le motif doit contenir au moins un groupe nommé, p. ex. (?P<Message>.*)",
  "error.not_a_directory": "ce n'est pas un dossier : {path}",
  "error.export_empty": "la sélection est vide",
  "error.export_failed": "impossible d'exporter : {message}",
};
