# Changelog

Todos los cambios relevantes de LogScope se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).
Mientras la versión mayor sea `0`, la parte menor puede romper compatibilidad:
`0.x.0` es una tanda de funcionalidad, `0.x.y` una corrección compatible.

## [Unreleased]

### Corregido

- Las columnas **Date** y **Time** mostraban la hora desplazada el doble del
  desfase horario: un log escrito a las 08:19 se veía a las 12:19 en un equipo en
  horario de verano. Ahora la rejilla pinta **los dígitos del fichero**, sin
  conversión de zona: lo que se lee es lo que hay escrito.

### Añadido

- **Tail en vivo en vistas combinadas**: se vigila cada fichero por separado y las
  líneas nuevas se insertan en su sitio por instante, con coste proporcional a lo
  que entra. Al entrar líneas la selección se descarta, porque los números de
  fila se desplazan, y a igual instante las nuevas quedan detrás de las que ya
  estaban.
- **Filtro avanzado**: ventana con grupos de condiciones combinables con **Y** u
  **O** (sobre el texto de la entrada, el nivel o el fichero de origen; contiene,
  igual, empieza por, termina por o expresión regular, cada una con **NO**), más
  rango de fechas, franja horaria y filtrado por fichero en las vistas
  combinadas. Mientras está activo **sustituye a la barra**, y su chip permite
  volver a editarlo o quitarlo. Falta la biblioteca de filtros con nombre y el
  grid propio.
- **Zona horaria del log** en Propiedades: la del equipo (por defecto) o un
  desfase fijo (UTC, UTC−08:00, UTC+02:00…). No cambia lo que se ve —la rejilla
  sigue mostrando los dígitos del fichero— sino el instante real de cada entrada,
  que es lo que ordena la vista combinada de ficheros de zonas distintas y lo que
  usan los filtros por fecha. Se guarda en la receta y se aplica al momento.
- **Selección múltiple de líneas** en el grid (Mayús+clic para un rango, Ctrl+clic
  para sumar o quitar) y **copia al portapapeles** con o sin número de línea,
  desde el menú contextual de la selección o con Ctrl+C. La copia pide al núcleo
  las filas que no estén cargadas, así que no se limita a lo que hay en pantalla.
- **Exportar la selección** a un fichero de texto, con o sin números de línea: se
  escribe junto al log como `<nombre>-seleccion.txt` (con `-2`, `-3`… si ya
  existe) y la aplicación avisa de la ruta. Sin diálogo de guardado, para no
  añadir dependencias.
- La interfaz está **traducida a seis idiomas** —castellano, inglés, francés,
  italiano, alemán y portugués— con un selector en **Ajustes → Idioma**. El
  idioma se guarda con el resto de preferencias y, la primera vez, se toma del
  sistema si es uno de los disponibles. Los números del pie de estado se
  formatean con el idioma activo; las columnas de fecha y hora siguen en formato
  ISO a propósito, porque tienen que ordenar y mantener el ancho.
- Licencia **MIT** (`LICENSE`) y sección de licencia en el README: hasta ahora el
  código se publicaba sin condiciones de uso.

## [0.2.1] - 2026-10-24

### Cambiado

- El panel **Propiedades del fichero** recarga el log al cambiar la codificación,
  sin esperar al botón de aplicar: corregir una lectura mal decodificada se ve al
  instante. El formato sigue aplicándose con el botón.

- Los textos de la interfaz salen de un catálogo central (`src/textos.ts`) y los
  errores del núcleo viajan por código en lugar de como frases hechas. De cara a
  quien usa la aplicación no cambia nada: es la preparación para poder traducirla
  sin reescribir los componentes.

### Documentación

- README reescrito para quien usa la aplicación, con una captura real: qué hace,
  cómo empezar y qué hay en cada parte de la ventana. La compilación, las pruebas
  y la publicación se mueven a `requirements.md`.
- `SPEC.md` con los hitos al día y el contrato con el núcleo actualizado.

## [0.2.0] - 2026-10-24

### Añadido

- **Detección estadística de codificación** (`chardetng`, el detector de
  Mozilla) como tercera capa, después del BOM y del patrón de ceros: resuelve
  cirílico en CP1251/KOI8-R, Shift-JIS, GBK, Big5, griego o hebreo cuando la
  cabecera no es UTF-8 limpio. No se consulta si el texto ya es UTF-8 válido o
  casi válido, para no reinterpretar ficheros que estaban bien.
- **Selector de codificación** en la barra (segunda fila, junto a **Formato**):
  `auto` más UTF-8, UTF-16 y UTF-32 en ambos órdenes de bytes, Windows-1252/
  1250/1251, CP850 y CP437 (páginas OEM de consola), ISO-8859-15, KOI8-R,
  Shift-JIS, GBK, Big5 y EUC-JP. Se guarda en la receta, así que al reabrir se
  usa la misma, y cambiarla con un log abierto lo **recarga** con la nueva
  codificación. La detectada se muestra en el título del selector.
- Soporte de **UTF-32** (LE y BE): el BOM de UTF-32LE empieza igual que el de
  UTF-16LE, así que ahora UTF-32 se comprueba primero y se decodifica.
- Se detecta la codificación del fichero: los logs **UTF-16LE/BE** (eMule,
  aplicaciones .NET, exportaciones de eventos) se leen bien. Antes se veían
  con un espacio entre cada letra (`2 4 / 1 0 / 2 0 2 6`) y no se reconocía ni
  la fecha. También vale para el tail y la vista previa al combinar.
- Arrastrar uno o varios ficheros de log desde el explorador de Windows sobre
  la ventana los abre, uno por pestaña, con un aviso mientras se arrastran.
- Reglas de color: casilla **Aa** por regla para exigir que coincidan las
  mayúsculas y minúsculas. Desmarcada, el comportamiento es el de siempre.
- Parser `auto`: separa la columna **Logger** en los formatos de una línea con
  `… NIVEL Logger - mensaje` (log4net y NLog), que hasta ahora dejaban el
  logger al principio del mensaje.

### Cambiado

- Una línea UTF-8 con un byte corrupto ya no se reinterpreta entera como
  Windows-1252 (aparecía «sesiÃ³n»): si hay texto multibyte válido se sustituye
  solo el byte malo.
- La barra de herramientas se reparte en dos filas: **Formato** y
  **Codificación** pasan a la derecha de la segunda, junto al filtro y los
  niveles, para despejar la primera (ruta, Examinar, Abrir, Columnas, Reglas).
- Una expresión regular que no compila se marca en rojo en el panel de reglas,
  con el motivo debajo, en lugar de descartarse en silencio.
- El panel de reglas de color es una ventana flotante con barra de título: se
  arrastra para apartarla de las filas que estás coloreando y ya no oscurece el
  log con un fondo, así que se ve el efecto mientras se ajustan los patrones.

## [0.1.0] - 2026-10-23

Primera versión. Cubre el núcleo del visor: abrir ficheros, parsearlos,
navegar por ellos y combinarlos.

### Añadido

- Visor de logs de escritorio: núcleo en Rust, UI en Tauri 2 + React +
  TypeScript.
- Parser `auto`, que agrupa entradas multilínea y deduce instante, nivel,
  hilo, etiqueta, logger y mensaje.
- Parsers forzables al equivalente de LogExpert: `basic`, `logfmt`, `json`,
  `clf`, `squarebracket`, `log4jxml`, `glassfish`, `websphere`, `dsv` y
  `pattern` con grupos con nombre.
- Detección verificada contra logs reales de log4net/NLog, CBS de Windows,
  LM Studio, opencode, vcpkg, calibre-mcp y trazas multilínea de Python.
- Editor **Columnas…** para reasignar a mano el campo de cada línea cuando la
  detección no acierta.
- Vista combinada de varios ficheros, cada uno con su propio parser, ordenada
  por instante y con ronda entre fuentes cuando los instantes coinciden. Las
  entradas sin instante van al final.
- Grid virtualizado: el núcleo solo entrega las filas visibles (200 por
  página) en lugar del conjunto completo.
- Árbol de directorios sin dependencias nuevas, mediante FFI a
  `GetLogicalDrives`, para no perder unidades no listas.
- Reglas de resaltado por patrón, sobre filas o sobre palabras.
- Tail en vivo con rotación y autoscroll, desactivado en vistas combinadas
  para no romper el orden.

### Notas

- Tail en vivo implementado pero sin validar manualmente. Tampoco están
  validados el arrastre de columnas, las reglas de color ni el botón
  **Combinar** con clics reales.
- El empaquetado NSIS está pendiente: `bundle.active` sigue en `false` y el
  binario se distribuye como ejecutable suelto.

[Unreleased]: https://github.com/killo3967/LogScope/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/killo3967/LogScope/releases/tag/v0.2.1
[0.2.0]: https://github.com/killo3967/LogScope/releases/tag/v0.2.0
[0.1.0]: https://github.com/killo3967/LogScope/releases/tag/v0.1.0
