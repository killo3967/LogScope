# TODO — pendientes

Cola de trabajo acordada. Lo terminado vive en [CHANGELOG.md](CHANGELOG.md) y
los hitos del plan en [SPEC.md](SPEC.md); aquí solo lo que falta.

## Producto

- [ ] **Completar la i18n** (la preparación está hecha). Falta el diccionario en
      inglés, el selector de idioma en Ajustes, guardar la preferencia, ajustar
      el `lang` del documento y formatear fechas y números con `Intl` en el
      idioma activo (hoy son fijos: `toLocaleString("es-ES")` en `App.tsx` y
      `formatDate`/`formatClock` en `types.ts`, que construyen la cadena a mano).
      Lo demás ya está: todo el texto sale de `src/textos.ts` y los errores del
      núcleo viajan por código.
- [ ] **Instalador NSIS**. `bundle.active` sigue en `false`, así que se
      distribuye un `.exe` suelto: sin instalador, sin acceso directo y con el
      aviso de SmartScreen por delante. Activarlo con `targets: ["nsis"]` y
      adjuntar el instalador a la release.
- [ ] **Prueba de carga con 1 M de líneas** (M3 de `SPEC.md`). Lo medido es con
      200 000 líneas: ingesta a 79,9 MB/s y página de 200 filas en 0,35 ms.
      Falta comprobar RAM y que el scroll se mantenga por debajo de 16 ms por
      frame con un millón.
- [ ] **Probar la rotación del tail a mano** (M5 de `SPEC.md`). Truncado y
      rotación están implementados y con pruebas unitarias, pero nunca se han
      probado con un fichero real que se renombra o se reemplaza mientras la
      aplicación lo sigue. También queda ver que la columna `#` no duplique
      líneas al crecer.

## Funciones pedidas

Peticiones del dueño del proyecto. Orden recomendado: **decidir la interfaz
(menú y barra) → selección múltiple → filtro avanzado → tail en combinadas →
Delta Time → exportar y copiar → atajos → persistencia**.

Por qué ese orden: la interfaz va primero porque decide dónde viven los botones
de todo lo demás; la selección múltiple es requisito de exportar y copiar; el
filtro y el tail en combinadas comparten el trabajo del orden por instante; y la
persistencia va al final, cuando ya exista todo lo que hay que recordar.

- [ ] **Simplificar la interfaz: menú superior, barra y accesos** (propuesta, sin
      decidir). Hoy la primera fila lleva ruta, Examinar, Abrir, Columnas…,
      Reglas…, Tail, Autoscroll y el engranaje; la segunda, filtro, siete chips de
      nivel, Formato y Codificación. Con lo que falta por añadir (filtro avanzado,
      pantalla completa, idioma, ventanas de filtro) se queda corta.
      - **Opción A (recomendada)**: menú **solo para lo de la aplicación**
        (Archivo, Ver, Herramientas, Ayuda: abrir, reabrir, pantalla completa,
        ajustes, acerca de) y la barra para lo del log; **Formato, Codificación y
        Columnas…** se van a un panel de *propiedades del fichero*, que se tocan al
        abrir y casi nunca más.
      - **Opción B**: menú completo. Libera la barra, pero esconde acciones de uso
        constante (tail, autoscroll, filtro) a dos clics, y hay que construir y
        traducir un menú por ventana abierta.
      - **Opción C**: sin menú; un botón **⋯ Más** con lo poco frecuente y una
        **paleta de comandos** (Ctrl+K) cuando lleguen los atajos.
      - A favor del menú: descubre los atajos gratis (aceleradores), es lo que
        espera un usuario de escritorio en Windows y permite manejar la aplicación
        sin ratón. En contra: unos 24 px permanentes de alto, en un visor donde el
        espacio vertical es el recurso escaso, y no se puede estilar.
- [ ] **Selección de varias líneas**. Hoy solo hay una fila marcada con el clic
      (`selected: number | null` en `LogGrid.tsx`) y el menú de selección aparece
      al marcar texto con el ratón. Hace falta selección por rango (Mayús+clic),
      añadir y quitar líneas (Ctrl+clic) y decidir qué pasa con la selección al
      cambiar el filtro o al entrar líneas por el tail.
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
- [ ] **Exportar y copiar la selección**. Menú contextual sobre las líneas
      marcadas, con copiar y exportar a texto, con y sin número de línea. Copiar
      se hace con `navigator.clipboard`, que ya se usa en `SelectionMenu.tsx`;
      exportar a fichero necesita diálogo de guardado, que en Tauri 2 es
      `tauri-plugin-dialog`: **dependencia nueva, hay que autorizarla antes de
      añadirla** (comprobado: no está en `Cargo.toml` ni en `package.json`).
      Propuesta: dos acciones (Copiar, Exportar…) y un conmutador «incluir número
      de línea» recordado como preferencia, en vez de cuatro entradas.
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

## Publicación

- [ ] **Traducir la documentación al inglés**. Orden recomendado: `README.md` en
      inglés con `README.es.md` al lado y una línea para cambiar de idioma;
      después `requirements.md`, `SPEC.md` y `AGENTS.md`. El `CHANGELOG.md` se
      queda en un solo idioma: traducir el histórico duplica mantenimiento y no
      aporta.
- [ ] **Licencia**. El repositorio no tiene `LICENSE`, así que legalmente nadie
      puede reutilizar el código ni saber bajo qué condiciones está. Elegir una
      (MIT o Apache-2.0 si se quiere protección de patentes) y enlazarla desde el
      README.
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

Orden de ejecución propuesto, con el tamaño aproximado de cada fase. Las fases
1 y 2 son la cáscara; no añaden funciones, solo colocan las que ya hay.

0. **Boceto de la interfaz** (horas): menú de aplicación, barra de dos filas con
   los controles reducidos, panel de *propiedades del fichero* y sitio del botón
   del filtro avanzado. Sin código.
1. **Cáscara de interfaz** (~2-3 h): menú nativo de aplicación, barra reducida y
   panel de propiedades con Formato, Codificación y Columnas…. Nada de lógica
   nueva; lo que hoy funciona debe seguir funcionando igual.
2. **i18n completo** (~2 h): diccionario inglés, selector en Ajustes, `Intl`.
   Va aquí para no traducir etiquetas que la fase 1 acaba de mover.
3. **Selección múltiple + exportar y copiar** (~2 h): la primera función nueva.
4. **Filtro avanzado**, por partes: (a) núcleo con `Filters` ampliado y pruebas;
   (b) formulario y biblioteca de filtros; (c) grid inferior independiente con su
   Delta Time; (d) pregunta al abrir y persistencia; (e) ventanas propias.
5. **Tail en combinadas** (el trabajo delicado del núcleo): insertar por
   instante, invalidar caché y pruebas de fusión.
6. **Delta Time del principal, atajos con editor y persistencia por fichero**.
7. **Publicación**: NSIS, licencia, documentación en inglés, ficha y capturas.

En paralelo y cuando apetezca, sin bloquea nada: la **licencia** (10 minutos) y
las **dos pruebas manuales pendientes** (rotación del tail y carga de 1 M de
líneas), que conviene hacer **antes** de tocar el código del tail.

## Notas de proceso

- Cada release: cerrar `[Unreleased]` del CHANGELOG antes de `bump.cmd X.Y.Z
  --tag`, que exige el árbol limpio.
- En el CHANGELOG solo va lo que cambia; no describir lo que se mantiene igual.
- Revisado el 2026-10-24: todos los `Err` del núcleo pasan por `error_json` o
  `error_io`, no queda ninguna frase suelta en castellano (por eso ya no hay una
  entrada de pendiente para eso).
