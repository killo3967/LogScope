# TODO — pendientes

Cola de trabajo acordada. Lo terminado vive en [CHANGELOG.md](CHANGELOG.md) y
los hitos del plan en [SPEC.md](SPEC.md); aquí solo lo que falta.

## Producto

- [ ] **Instalador NSIS**. `bundle.active` sigue en `false`, así que se
      distribuye un `.exe` suelto: sin instalador, sin acceso directo y con el
      aviso de SmartScreen por delante. Activarlo con `targets: ["nsis"]` y
      adjuntar el instalador a la release.

## Pruebas manuales pendientes

Requieren la aplicación abierta y abrir a mano; no las puede hacer un script.

- [ ] **Rotación del tail** (M5 de `SPEC.md`). Con un log abierto y el tail
      activo, renombrar el fichero y crear otro con el mismo nombre: la vista debe
      reiniciarse sin duplicar ni perder líneas. Repetir truncándolo a cero
      (`type nul > fichero`) y comprobando que la columna `#` vuelve a empezar en
      1. Truncado y rotación tienen pruebas unitarias, pero nunca se han visto con
      un fichero real cambiando por debajo.
- [ ] **Carga con 1 M de líneas** (M3 de `SPEC.md`). Generar un log de un millón de
      líneas en formato log4net y abrirlo: medir RAM y comprobar que el scroll se
      mantiene fluido (objetivo: menos de 16 ms por frame). Lo medido hasta ahora
      es con 200 000 líneas: ingesta a 79,9 MB/s y página de 200 filas en 0,35 ms.
- [ ] **Repaso de las traducciones en la app**. Cambiar de idioma en Ajustes y dar
      una vuelta a cada uno (menú, barra, panel de propiedades, ajustes, pie de
      estado, mensajes de error): longitudes que rompan la barra, términos
      incoherentes o textos que suenen a traducción literal. Son 175 claves por
      idioma y están escritas a mano, así que el repaso del nativo es la única
      prueba que vale.

## Funciones pedidas

Peticiones del dueño del proyecto. Orden recomendado: **selección múltiple →
filtro avanzado → tail en combinadas → Delta Time → exportar y copiar → atajos →
persistencia**. La interfaz ya está decidida e implementada (menú de aplicación,
barra corta y panel de propiedades).

Por qué ese orden: la selección múltiple es requisito de exportar y copiar; el
filtro y el tail en combinadas comparten el trabajo del orden por instante; y la
persistencia va al final, cuando ya exista todo lo que hay que recordar.

- [ ] **Filtro avanzado con grid propio**. Consulta estructurada sobre la sesión,
      del estilo «eventos WARN que contengan "tal", entre dos fechas y dentro de
      la franja de 12:07 a 15:29». El resultado se ve en un **segundo grid en la
      parte inferior**, con su propia zona de filtros, que se puede ocultar y
      volver a mostrar.
      - **Independiente del grid principal**: cada uno mantiene su scroll, su tail
        y su autoscroll; el de abajo puede seguir el fichero mientras el de arriba
        está parado, y al revés. No hace falta otro hilo de tail: la sesión se
        sigue una vez en Rust y cada grid decide si se pega al final de *su*
        resultado filtrado.
      - Su **Delta Time** se calcula sobre las filas que pasan el filtro, no sobre
        todas: es lo útil cuando estás filtrando.
      - El panel es **por pestaña**: aparece solo donde se pidió y desaparece al
        cambiar a otra que no lo tenga.
      - **Vale también para pestañas con ficheros combinados**: el filtro se
        aplica al orden entremezclado por instante, no a cada fuente. Y hay que
        poder **filtrar por fuente** como una condición más (la columna `Source`
        ya existe): es lo que permite quedarse con uno solo de los ficheros de la
        vista combinada. **Decidido: se hace.**
      - **Decisiones cerradas**:
        - La consulta se edita en una **ventana con formulario**, con **grupos**:
          dentro de cada grupo las condiciones se unen con **Y** o con **O**, los
          grupos se unen entre sí con **Y**, y cada condición admite **NO**.
        - Rango **entre dos fechas cualesquiera** (día, sin hora) y franja horaria
          repetida **todos los días** de ese rango; la franja puede **cruzar
          medianoche** (22:00–02:00 = 22:00–23:59 y 00:00–02:00 del día siguiente).
        - El filtro **sustituye** a los niveles y el texto de la barra: la barra
          sigue mandando en el grid principal y deja de aplicar al de abajo.
        - Panel **redimensionable** (un tercio de la pantalla como alto inicial) y
          recuerda su alto.
        - El grid de abajo tiene **columnas visibles y anchos propios**,
          independientes del principal: arrastrar `Message` arriba no toca el de
          abajo. Solo se comparte la lista de columnas disponibles del fichero.
        - Los filtros llevan **nombre**, se guardan **por fichero y además en una
          biblioteca común** reutilizable entre logs, con **Guardar** y **Guardar
          como…**.
        - Al abrir un fichero con filtro guardado se **pregunta** si aplicarlo, y
          en Ajustes se elige entre preguntar siempre o aplicar sin preguntar.
        - Almacenamiento en `localStorage` (como las reglas de color), en una
          clave nueva por ámbito; exportar e importar filtros a fichero queda como
          paso siguiente.
      - **Notas técnicas**:
        - El filtrado va en el **núcleo**: `Filters` (`index.rs`) hoy solo tiene
          `levels` y `text`; hay que ampliarlo con el árbol de condiciones, el
          rango de fechas y la franja. El grid de abajo pedirá páginas igual que
          el principal, no el conjunto completo.
        - Las fechas de la consulta se guardan en ISO (`YYYY-MM-DD`) para no
          depender del formato que se muestre en pantalla.
        - Las líneas **sin instante** quedan fuera cuando hay rango de fechas o
          franja horaria.
- [ ] **Filtro avanzado en ventanas independientes** (pedido por el usuario). Hoy
      el resultado se vería en el panel inferior; además tiene que poder **sacarse
      a una ventana propia**, y poder tener **varias a la vez** (por ejemplo la
      ventana principal con tres filtros). Con monitores grandes o varios
      monitores, cada filtro en su ventana se lee mucho mejor que apilado abajo.
      - **Notas técnicas**:
        - Tauri 2 permite abrir ventanas con `WebviewWindow`. Las sesiones ya viven
          en el estado de Rust (`AppState`), así que una ventana nueva puede pedir
          `read_page` de la misma sesión sin duplicar nada.
        - Cada ventana necesita su permiso: `capabilities/default.json` hoy cubre
          solo la ventana `main`; habrá que añadir una capacidad para las ventanas
          de filtro (patrón de etiqueta, p. ej. `filter-*`).
        - El evento `log://appended` se emite con `app.emit`, que llega a **todas**
          las ventanas, así que el tail funcionará en ellas sin cambios en Rust.
        - La configuración (reglas de color, filtros guardados, anchos) vive en
          `localStorage`, compartido porque todas las ventanas usan el mismo perfil
          de WebView2; pero el navegador no avisa de los cambios entre ventanas de
          forma fiable, así que hay que sincronizar con un evento de Tauri.
        - El bundle es una sola entrada de Vite: hay que decidir cómo se abre la
          vista de filtro (parámetro en la URL frente a una segunda entrada).
        - Cerrar la ventana principal no debe dejar ventanas huérfanas apuntando a
          sesiones cerradas.
      - **Decidido con el usuario**:
        - Al sacar un filtro a su ventana, **desaparece del panel inferior**: se
          mueve, no se duplica.
        - Dentro de esa ventana se **puede cambiar de filtro** con la biblioteca.
        - Al arrancar, las ventanas de filtro se reabren **o no, según un ajuste**.
        - Si se cierra la pestaña dueña, la ventana **avisa antes de cerrarse**.

- [ ] **Tail en vivo en vistas combinadas**. Hoy `start_tail` se rechaza con
      `tail_merged` (`lib.rs`) y la interfaz ni lo pide cuando la vista está
      combinada (`App.tsx`: `settings.startWithTail && !result.merged`). El orden
      de una vista combinada es `Vec<(ts, source_idx, entry_idx)>` ordenado por
      instante, así que cada línea nueva hay que insertarla en su sitio. Hace
      falta:
      - insertar por instante con búsqueda binaria sobre `order`, manteniendo la
        ronda entre fuentes cuando varias traen el mismo instante;
      - avisar a la interfaz sin romper el grid virtualizado: hoy
        `sync_single_source` solo empuja índices al final, y con inserciones en
        medio hay que invalidar la caché de páginas y recolocar el scroll y la
        fila marcada;
      - pruebas de fusión con líneas entrando en varias fuentes a la vez.
      Lo necesitan tanto el grid principal como el panel de filtro avanzado.
- [ ] **Columna Delta Time**. Desde el menú contextual de la cabecera de `Time`,
      añadir una columna con el tiempo transcurrido entre líneas. En el **grid
      principal el delta se calcula sobre todas las filas del fichero**, no solo
      sobre las visibles. Formato: milisegundos si el log los trae; minutos y
      segundos enteros si no. Decidido: en la primera fila, vacío, y las líneas
      sin instante cortan la serie en vez de inventar un salto.
- [ ] **Filtro avanzado con grid propio**. Consulta estructurada sobre la sesión,
      del estilo «eventos WARN que contengan "tal", entre dos fechas y dentro de
      la franja de 12:07 a 15:29». El resultado se ve en un **segundo grid en la
      parte inferior**, con su propia zona de filtros, que se puede ocultar y
      volver a mostrar.
      - **Independiente del grid principal**: cada uno mantiene su scroll, su tail
        y su autoscroll; el de abajo puede seguir el fichero mientras el de arriba
        está parado, y al revés. No hace falta otro hilo de tail: la sesión se
        sigue una vez en Rust y cada grid decide si se pega al final de *su*
        resultado filtrado.
      - Su **Delta Time** se calcula sobre las filas que pasan el filtro, no sobre
        todas: es lo útil cuando estás filtrando.
      - El panel es **por pestaña**: aparece solo donde se pidió y desaparece al
        cambiar a otra que no lo tenga.
      - **Vale también para pestañas con ficheros combinados**: el filtro se
        aplica al orden entremezclado por instante, no a cada fuente. Y hay que
        poder **filtrar por fuente** como una condición más (la columna `Source`
        ya existe): es lo que permite quedarse con uno solo de los ficheros de la
        vista combinada. **Decidido: se hace.**
      - **Decisiones cerradas**:
        - La consulta se edita en una **ventana con formulario**, con **grupos**:
          dentro de cada grupo las condiciones se unen con **Y** o con **O**, los
          grupos se unen entre sí con **Y**, y cada condición admite **NO**.
        - Rango **entre dos fechas cualesquiera** (día, sin hora) y franja horaria
          repetida **todos los días** de ese rango; la franja puede **cruzar
          medianoche** (22:00–02:00 = 22:00–23:59 y 00:00–02:00 del día siguiente).
        - El filtro **sustituye** a los niveles y el texto de la barra: la barra
          sigue mandando en el grid principal y deja de aplicar al de abajo.
        - Panel **redimensionable** (un tercio de la pantalla como alto inicial) y
          recuerda su alto.
        - El grid de abajo tiene **columnas visibles y anchos propios**,
          independientes del principal: arrastrar `Message` arriba no toca el de
          abajo. Solo se comparte la lista de columnas disponibles del fichero.
        - Los filtros llevan **nombre**, se guardan **por fichero y además en una
          biblioteca común** reutilizable entre logs, con **Guardar** y **Guardar
          como…**.
        - Al abrir un fichero con filtro guardado se **pregunta** si aplicarlo, y
          en Ajustes se elige entre preguntar siempre o aplicar sin preguntar.
        - Almacenamiento en `localStorage` (como las reglas de color), en una
          clave nueva por ámbito; exportar e importar filtros a fichero queda como
          paso siguiente.
      - **Notas técnicas**:
        - El filtrado va en el **núcleo**: `Filters` (`index.rs`) hoy solo tiene
          `levels` y `text`; hay que ampliarlo con el árbol de condiciones, el
          rango de fechas y la franja. El grid de abajo pedirá páginas igual que
          el principal, no el conjunto completo.
        - Las fechas de la consulta se guardan en ISO (`YYYY-MM-DD`) para no
          depender del formato que se muestre en pantalla.
        - Las líneas **sin instante** quedan fuera cuando hay rango de fechas o
          franja horaria.
- [ ] **Filtro avanzado en ventanas independientes** (pedido por el usuario). Hoy
      el resultado se vería en el panel inferior; además tiene que poder **sacarse
      a una ventana propia**, y poder tener **varias a la vez** (por ejemplo la
      ventana principal con tres filtros). Con monitores grandes o varios
      monitores, cada filtro en su ventana se lee mucho mejor que apilado abajo.
      - **Notas técnicas**:
        - Tauri 2 permite abrir ventanas con `WebviewWindow`. Las sesiones ya viven
          en el estado de Rust (`AppState`), así que una ventana nueva puede pedir
          `read_page` de la misma sesión sin duplicar nada.
        - Cada ventana necesita su permiso: `capabilities/default.json` hoy cubre
          solo la ventana `main`; habrá que añadir una capacidad para las ventanas
          de filtro (patrón de etiqueta, p. ej. `filter-*`).
        - El evento `log://appended` se emite con `app.emit`, que llega a **todas**
          las ventanas, así que el tail funcionará en ellas sin cambios en Rust.
        - La configuración (reglas de color, filtros guardados, anchos) vive en
          `localStorage`, compartido porque todas las ventanas usan el mismo perfil
          de WebView2; pero el navegador no avisa de los cambios entre ventanas de
          forma fiable, así que hay que sincronizar con un evento de Tauri.
        - El bundle es una sola entrada de Vite: hay que decidir cómo se abre la
          vista de filtro (parámetro en la URL frente a una segunda entrada).
        - Cerrar la ventana principal no debe dejar ventanas huérfanas apuntando a
          sesiones cerradas.
      - **Decidido con el usuario**:
        - Al sacar un filtro a su ventana, **desaparece del panel inferior**: se
          mueve, no se duplica.
        - Dentro de esa ventana se **puede cambiar de filtro** con la biblioteca.
        - Al arrancar, las ventanas de filtro se reabren **o no, según un ajuste**.
        - Si se cierra la pestaña dueña, la ventana **avisa antes de cerrarse**.

- [ ] **Tail en vivo en vistas combinadas**. Hoy `start_tail` se rechaza con
      `tail_merged` (`lib.rs`) y la interfaz ni lo pide cuando la vista está
      combinada (`App.tsx`: `settings.startWithTail && !result.merged`). El orden
      de una vista combinada es `Vec<(ts, source_idx, entry_idx)>` ordenado por
      instante, así que cada línea nueva hay que insertarla en su sitio. Hace
      falta:
      - insertar por instante con búsqueda binaria sobre `order`, manteniendo la
        ronda entre fuentes cuando varias traen el mismo instante;
      - avisar a la interfaz sin romper el grid virtualizado: hoy
        `sync_single_source` solo empuja índices al final, y con inserciones en
        medio hay que invalidar la caché de páginas y recolocar el scroll y la
        fila marcada;
      - pruebas de fusión con líneas entrando en varias fuentes a la vez.
      Lo necesitan tanto el grid principal como el panel de filtro avanzado.
- [ ] **Columna Delta Time**. Desde el menú contextual de la cabecera de `Time`,
      añadir una columna con el tiempo transcurrido entre líneas. En el **grid
      principal el delta se calcula sobre todas las filas del fichero**, no solo
      sobre las visibles. Formato: milisegundos si el log los trae; minutos y
      segundos enteros si no. Decidido: en la primera fila, vacío, y las líneas
      sin instante cortan la serie en vez de inventar un salto.
- [ ] **Exportar la selección a fichero**. Copiar ya está hecho (menú contextual
      de la selección y Ctrl+C, con o sin número de línea). Falta exportar a un
      fichero de texto, que en Tauri 2 necesita diálogo de guardado:
      `tauri-plugin-dialog`, **dependencia nueva pendiente de autorizar**
      (comprobado: no está en `Cargo.toml` ni en `package.json`). Alternativa sin
      dependencia: escribir junto al log como `<nombre>-seleccion.txt` y avisar de
      la ruta.
- [ ] **Atajos de teclado**: `F12` pantalla completa (oculta las dos filas de la
      barra y deja el log con su cabecera), `F` follow tail, `S` scroll
      automático, `O` abrir un log. Detalles a resolver: no deben dispararse
      mientras se escribe en un campo (filtro, patrón, reglas) ni con la ventana
      de reglas abierta; `F12` en WebView2 abre las herramientas de desarrollo si
      están habilitadas; la pantalla completa necesita una salida clara (`Esc`) y
      no confundirse con el F11 del sistema; con la barra oculta, un filtro
      activo pierde su indicador, así que hace falta uno mínimo.
      **El diseño se discute con el usuario cuando se vaya a implementar.**
- [ ] **Configuración de atajos**: sección nueva en Ajustes para reasignarlos,
      con validación (una tecla no puede hacer dos cosas) y persistencia como el
      resto de preferencias. El mapa de atajos debería vivir en un solo módulo y
      los botones de la barra mostrar su atajo en el `title`.
- [ ] **Persistencia de la configuración por fichero**. Todo lo que se ajuste
      sobre un log se recuerda para la próxima vez. Ya se guardan parser, mapeo,
      codificación y reglas de color (clave `sourceKey`). Añadir:
      - columnas visibles y sus **anchos por fichero y por grid** (hoy
        `logscope.columnWidths.v1` es global, por nombre de columna y única para
        todo);
      - Delta Time;
      - filtros avanzados con nombre: cuáles tiene el fichero, cuál estaba activo
        y si el panel estaba abierto;
      - **tail y autoscroll por fichero** (hoy son preferencia global en
        `Settings`: `startWithTail`, `startWithAutoScroll`);
      - alto del panel de filtro y, si algún día hay ventanas de filtro, su
        posición, tamaño y qué filtro tenía cada una;
      Ajustes nuevos que salen de aquí: comportamiento al abrir un fichero con
      filtro guardado (preguntar o aplicar siempre).
      Cuidado: recordar una consulta restrictiva hace parecer que al fichero le
      faltan líneas; hace falta un indicador visible y una forma clara de
      limpiarla.

- [ ] **Exportar con diálogo y varios formatos**. Hoy la exportación escribe
      `<nombre>-seleccion.txt` junto al log, sin preguntar nada. Debe abrir un
      diálogo que pida **ruta, nombre y tipo de fichero**, y antes hay que
      **estudiar qué formatos** tiene sentido generar además de texto plano:
      - **CSV / TSV** con las columnas del grid y cabecera. Ojo con el escapado de
        comillas, separadores y saltos de línea dentro de un campo (un registro de
        varias líneas rompería el fichero).
      - **JSON**: una entrada por objeto, con sus campos y el número de línea.
      - **`.log` filtrado**: solo las líneas de la selección, tal cual, para
        reabrirlas en otro sitio.
      - Decisiones que salen de ahí: qué separador y qué codificación (UTF-8 con
        BOM para que Excel abra bien los acentos), si el CSV respeta el orden de la
        selección o el del fichero, y si se respeta el mapeo de columnas activo.
      - Para el diálogo hace falta `tauri-plugin-dialog`: **dependencia nueva, hay
        que autorizarla**. Alternativa sin dependencia: formulario propio con ruta
        escrita a mano y tipo elegido en un desplegable.
      - El contenido debe generarse en el **núcleo**, que es quien tiene las filas,
        y no en la interfaz.

## Publicación

- [ ] **Traducir la documentación al inglés**. Orden recomendado: `README.md` en
      inglés con `README.es.md` al lado y una línea para cambiar de idioma;
      después `requirements.md`, `SPEC.md` y `AGENTS.md`. El `CHANGELOG.md` se
      queda en un solo idioma: traducir el histórico duplica mantenimiento y no
      aporta.
- [ ] **Ficha del repositorio en GitHub**: descripción corta, temas
      (`log-viewer`, `windows`, `rust`, `tauri`, `i18n`…), captura en las notas de
      la release y un texto de presentación en inglés.
- [ ] **Capturas que enseñen las funciones nuevas**: reglas de color en acción,
      vista combinada de dos ficheros y panel de codificación. Una sola imagen no
      cuenta todo lo que hace.

## Calidad

- [ ] **Pruebas de la interfaz**: hoy no hay ninguna automática; `npm run build`
      solo comprueba tipos. Con la i18n recién hecha, una prueba de que `t()`
      devuelve texto para cada clave del catálogo cubriría lo más frágil.
- [ ] **Pruebas del filtro avanzado en el núcleo**: árbol de condiciones, franja
      que cruza medianoche y bordes de fecha (día incluido y día siguiente
      excluido), con datos sintéticos. Van junto con la ampliación de `Filters`.

## Plan de arranque

Las fases 0 a 2 están hechas: boceto, cáscara de interfaz (`f07482a`) e i18n con
seis idiomas (`70b36cf`). Queda:

3. ~~**Selección múltiple, copiar y exportar**~~ — hecho. La exportación escribe
   junto al log (`<nombre>-seleccion.txt`) para no añadir dependencias; con
   diálogo de guardado haría falta `tauri-plugin-dialog`.
4. **Filtro avanzado**, por partes: (a) núcleo con `Filters` ampliado y pruebas;
   (b) formulario y biblioteca de filtros; (c) grid inferior independiente con su
   Delta Time; (d) pregunta al abrir y persistencia; (e) ventanas propias.
5. **Tail en combinadas** (el trabajo delicado del núcleo): insertar por
   instante, invalidar caché y pruebas de fusión.
6. **Delta Time del principal, atajos con editor y persistencia por fichero**.
7. **Publicación**: NSIS, documentación en inglés, ficha y capturas. La licencia
   ya está hecha.

En paralelo y cuando apetezca, sin bloquear nada: las **pruebas manuales
pendientes** de la sección de arriba. La de la rotación conviene hacerla **antes**
de tocar el código del tail (fase 5), para saber qué funcionaba.

## Notas de proceso

- Cada release: cerrar `[Unreleased]` del CHANGELOG antes de `bump.cmd X.Y.Z
  --tag`, que exige el árbol limpio.
- En el CHANGELOG solo va lo que cambia; no describir lo que se mantiene igual.
- Revisado el 2026-10-24: todos los `Err` del núcleo pasan por `error_json` o
  `error_io`, no queda ninguna frase suelta en castellano (por eso ya no hay una
  entrada de pendiente para eso).

## Mejoras futuras

Lo último de la cola: no urgente, pero conviene no olvidarlo.

- [ ] **Corrección de zona horaria y desplazamiento de horas a petición**. Hoy la
      hora de cada fichero se interpreta en la zona del equipo, así que un log
      escrito en otra zona (un servidor en UTC, por ejemplo) se muestra desplazado
      **sin avisar**. Se decidió dejarlo así por ahora. Las opciones, por orden de
      utilidad:
      - Guardar además la **hora de pared tal y como viene escrita** y pintar
        siempre los dígitos del fichero, sin reformatear; el instante seguiría
        usándose por dentro para ordenar, para el Delta Time y para los filtros.
        Es lo más fiel para un visor de logs.
      - **Zona horaria por fichero** en Propiedades, guardada en la receta, con la
        del equipo como valor por defecto.
      - **Desplazar todas las horas del log** un desfase elegido por el usuario
        (positivo o negativo), para cuadrar un fichero con otra fuente o con la
        hora actual. El desplazamiento afectaría a lo que se muestra y a lo que se
        compara, y tendría que verse de forma inequívoca en la interfaz y quedar
        guardado en la receta.
