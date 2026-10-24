/**
 * Catálogo en portugués de Portugal. Traducido desde `es.ts`, que manda en las
 * claves y en el orden: el tipo `Record<ClaveTexto, string>` obliga a que
 * estén todas.
 *
 * Las claves llevan el espacio de nombres de la zona de la interfaz (`app.`,
 * `toolbar.`, `grid.`, `browser.`, `cols.`, `rules.`, `settings.`, `tab.`,
 * `sel.`, `status.`, `menu.`, `props.`, `about.`, `error.`). Los marcadores
 * `{nombre}` los sustituye `t` en `textos.ts`.
 */
import type { ClaveTexto } from "./es";

export const PT: Record<ClaveTexto, string> = {
  // Zona de aplicación: capa de arrastre y estados vacíos.
  "app.soltar": "Larga o ficheiro para o abrir",
  "app.soltarDetalle": "Abre-se num separador novo. Se largares vários, um por ficheiro.",
  "app.vacio": "Abre um ficheiro de log para começar.",
  "app.cerrarMensaje": "Fechar a mensagem",
  "app.tailMerged":
    "O tail em direto só está disponível com um único ficheiro: numa vista combinada a ordem seria recalculada a cada linha.",

  // Menú de aplicación. Se construye desde la interfaz para que los rótulos
  // salgan de este catálogo; los ítems nativos no traducen nada por su cuenta.
  "menu.archivo": "Ficheiro",
  "menu.ver": "Ver",
  "menu.herramientas": "Ferramentas",
  "menu.ayuda": "Ajuda",
  "menu.abrir": "Abrir…",
  "menu.reabrirUltimo": "Reabrir último log",
  "menu.salir": "Sair",
  "menu.tailEnVivo": "Tail em direto",
  "menu.autoscroll": "Autoscroll",
  "menu.propiedades": "Propriedades do ficheiro…",
  "menu.reglas": "Regras de cor…",
  "menu.ajustes": "Definições…",
  "menu.acercaDe": "Acerca do LogScope",

  // Barra de herramientas.
  "toolbar.rutaPlaceholder": "C:\\caminho\\para\\o\\ficheiro.log",
  "toolbar.examinarTooltip": "Navegar pela árvore de pastas",
  "toolbar.examinar": "Procurar…",
  "toolbar.abriendo": "A abrir…",
  "toolbar.abrir": "Abrir",
  "toolbar.propiedades": "Propriedades",
  "toolbar.mas": "⋯",
  "toolbar.masTooltip": "Mais ações",
  "toolbar.reglasTooltip": "Colorir linhas ou palavras segundo um padrão",
  "toolbar.reglasVacio": "Regras…",
  "toolbar.tailEtiqueta": "tail",
  "toolbar.autoscrollEtiqueta": "auto",
  "toolbar.tailSeguirTooltip": "Seguir o ficheiro em direto",
  "toolbar.tailDetenerTooltip": "Parar o tail em direto",
  "toolbar.tailNoDisponibleTooltip": "Indisponível ao combinar vários ficheiros",
  "toolbar.autoscrollActivarTooltip": "Ativar o autoscroll",
  "toolbar.autoscrollDesactivarTooltip": "Desativar o autoscroll",
  "toolbar.filtroPlaceholder": "Filtrar por texto…",

  // Panel de propiedades del fichero: lo detectado (solo lectura) y los
  // controles con los que se vuelve a abrir.
  "props.titulo": "Propriedades do ficheiro",
  "props.rutas": "Caminhos",
  "props.tamano": "Tamanho",
  "props.lineas": "Linhas",
  "props.parserDetectado": "Parser detetado",
  "props.codificacionDetectada": "Codificação detetada",
  "props.formato": "Formato",
  "props.formatoTooltip": "Como interpretar cada linha do ficheiro",
  "props.delimitador": "Delimitador",
  "props.delimitadorTooltip": "Delimitador",
  "props.patron": "Padrão",
  "props.patronTooltip": "Regex com grupos com nome",
  "props.zona": "Fuso do log",
  "props.zonaTooltip": "Fuso horário em que o ficheiro foi escrito; afeta a ordem da vista combinada e os filtros por data",
  "props.zonaEquipo": "O do computador",
  "props.codificacion": "Codificação",
  "props.codificacionTooltip": "Codificação dos bytes do ficheiro",
  "props.columnas": "Colunas…",
  "props.columnasTooltip": "Atribuir cada linha do registo à sua coluna",
  "props.cerrar": "Fechar",
  "props.aplicar": "Aplicar e recarregar",

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
  "about.titulo": "Acerca do LogScope",
  "about.version": "Versão {version}",
  "about.sinVersion": "Versão indisponível",
  "about.descripcion": "Visualizador de registos de log para Windows.",
  "about.cerrar": "Fechar",

  // Rejilla de entradas.
  "grid.numeroLineaTooltip": "Número da linha no ficheiro",
  "grid.anchoTooltip": "Arrasta para alterar a largura",
  "grid.cargando": "a carregar…",

  // Explorador de ficheros.
  "browser.titulo": "Abrir ficheiro de log",
  "browser.filtroPlaceholder": "Filtrar por nome…",
  "browser.cerrar": "Fechar",
  "browser.cargandoUnidades": "A carregar unidades…",
  "browser.leyendo": "A ler…",
  "browser.seleccionVacia":
    "marca um ou vários ficheiros (os de formatos diferentes combinam-se por hora)",
  "browser.seleccionados": "{n} ficheiros selecionados",
  "browser.abrirTooltipVarios": "Abrir cada ficheiro marcado no seu próprio separador",
  "browser.abrirTooltipUno": "Abrir o ficheiro marcado",
  "browser.abrir": "Abrir",
  "browser.abrirN": "Abrir ({n})",
  "browser.combinar": "Combinar ",
  "browser.combinarN": "Combinar ({n})",
  "browser.combinarTooltip": "Combinar os ficheiros marcados por ordem de instante",

  // Editor de columnas.
  "cols.titulo": "Colunas da entrada",
  "cols.pista": "Cada linha do registo vai para uma coluna. `ignore` descarta-a.",
  "cols.cerrar": "Fechar",
  "cols.linea": "Linha {n}",
  "cols.vacia": "(vazia)",
  "cols.sinEntradas": "Este ficheiro não tem entradas de várias linhas.",
  "cols.avisoSinTime": "aviso: nenhuma linha marcada como time",
  "cols.cancelar": "Cancelar",
  "cols.aplicando": "A aplicar…",
  "cols.aplicar": "Aplicar",

  // Reglas de color.
  "rules.arrastrarTooltip": "Arrasta esta barra para mover a janela",
  "rules.titulo": "Regras de cor",
  "rules.pista":
    "Correspondências de texto ou expressão regular. Ganha a primeira regra que corresponde.",
  "rules.cerrar": "Fechar",
  "rules.vacio": "Sem regras. Adiciona uma para colorir linhas ou palavras.",
  "rules.patronRegexPlaceholder": "expressão regular",
  "rules.patronTextoPlaceholder": "texto a procurar",
  "rules.regexInvalidaTooltip": "Expressão regular inválida: a regra é ignorada",
  "rules.palabra": "palavra",
  "rules.filaEntera": "linha inteira",
  "rules.caseSensitiveTooltip":
    "Distinguir maiúsculas de minúsculas. Se estiver desmarcado, a correspondência não distingue.",
  "rules.eliminarTooltip": "Eliminar regra",
  "rules.regexInvalida":
    "Expressão regular inválida: esta regra não colore nada até a corrigires.",
  "rules.totalUna": "{n} regra",
  "rules.totalVarias": "{n} regras",
  "rules.anadir": "Adicionar regra",
  "rules.hecho": "Concluído",

  // Panel de ajustes.
  "settings.titulo": "Definições",
  "settings.pista": "Preferências guardadas neste equipamento.",
  "settings.cerrar": "Fechar",
  "settings.idioma": "Idioma",
  "settings.idiomaTooltip": "Idioma da interface",
  "settings.reabrir": "Reabrir os últimos logs ao arrancar",
  "settings.iniciarTail": "Iniciar com o tail em direto ativo",
  "settings.notaTail":
    "Ao abrir um log, começa a segui-lo sozinho. Não se aplica às vistas combinadas, onde a ordem seria recalculada a cada linha.",
  "settings.iniciarAutoscroll": "Iniciar com o autoscroll ativo",
  "settings.notaAutoscroll":
    "Aplica-se ao arrancar e ao abrir cada log. Podes desativá-lo a qualquer momento com o interruptor da barra ou movendo a roda para cima.",
  "settings.ultimos": "Últimos logs memorizados",
  "settings.parser": "Parser {parser}",
  "settings.columnasForzadas": " · {n} colunas forçadas",
  "settings.olvidar": "Esquecer estes logs",
  "settings.sinLogs": "Ainda não foi aberto nenhum log.",
  "settings.hecho": "Concluído",

  // Menú de pestaña.
  "tab.vistaCombinada": "Vista combinada",
  "tab.cerrar": "Fechar",
  "tab.ficheros": "{n} ficheiros",
  "tab.combinarN": "Combinar {n} separadores",
  "tab.combinarVacio": "Combinar separadores…",
  "tab.combinarTooltipDeshabilitado":
    "Marca dois ou mais separadores com Ctrl+clique e volta a abrir este menu",
  "tab.combinarTooltip":
    "Abrir uma vista combinada com estes separadores, ordenada por instante",
  "tab.copiarColorizacion": "Copiar coloração de…",
  "tab.sinOrigenesTooltip": "Nenhum outro log tem regras de cor ainda",
  "tab.copiarTooltip": "Copiar as regras de outro log para este",
  "tab.recargarTooltip": "Recarrega a interface. Os separadores abertos são fechados.",
  "tab.recargar": "Recarregar interface",
  "tab.imprimir": "Imprimir…",
  "tab.atras": "← Anterior",

  // Menú de selección.
  "sel.copiar": "Copiar",
  "sel.reglasTooltip": "Abrir as regras de cor com este texto como padrão",
  "sel.reglasCon": "Regras de cor com «{texto}»",
  "sel.filasSeleccionadas": "{n} linhas selecionadas",
  "sel.copiarFilas": "Copiar seleção",
  "sel.copiarFilasNumeros": "Copiar com números de linha",
  "sel.exportar": "Exportar seleção",
  "sel.exportarNumeros": "Exportar com números de linha",
  "sel.quitarSeleccion": "Limpar seleção",
  "sel.copiando": "A copiar…",
  "sel.exportando": "A exportar…",
  "sel.exportado": "Exportado para {ruta}",
  "sel.demasiadasFilas":
    "A seleção é demasiado grande para a área de transferência: {n} linhas",

  // Pie de estado.
  "status.sinSesion": "sem sessão",
  "status.lineas": "{total} linhas",
  "status.ficheros": " · {total} ficheiros",
  "status.tailActivo": "tail ativo",
  "status.tailParado": "tail parado",
  "status.pestana": "{n} separador",
  "status.pestanas": "{n} separadores",
  "status.regla": "{n} regra",
  "status.reglas": "{n} regras",

  // Errores del núcleo. El código del JSON (`{"code":…}`) elige la clave
  // `error.<código>`; `io` reenvía el texto original del sistema sin adornos.
  "error.pattern_missing": "o parser pattern precisa do campo pattern",
  "error.unknown_parser": "parser desconhecido: {parser}",
  "error.open_failed": "não é possível abrir: {message}",
  "error.io": "{message}",
  "error.read_failed": "erro de leitura: {message}",
  "error.combine_without_timestamps":
    "não é possível combinar: {file} não tem coluna de data e hora",
  "error.no_session": "sessão desconhecida: {id}",
  "error.no_file_selected": "não foi indicado nenhum ficheiro",
  "error.not_a_file": "não é um ficheiro: {path}",
  "error.tail_merged":
    "o tail em direto só está disponível com um único ficheiro: numa vista combinada a ordem seria recalculada a cada linha",
  "error.invalid_regex": "regex inválida: {message}",
  "error.pattern_needs_named_group":
    "o padrão precisa de pelo menos um grupo com nome, p. ex. (?P<Message>.*)",
  "error.not_a_directory": "não é uma pasta: {path}",
  "error.export_empty": "a seleção está vazia",
  "error.export_failed": "não foi possível exportar: {message}",
};
