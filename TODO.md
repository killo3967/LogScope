# Pendientes

Cola de trabajo acordada. Lo terminado vive en [CHANGELOG.md](CHANGELOG.md) y
los hitos del plan en [SPEC.md](SPEC.md); aquí solo lo que falta, en el orden en
que conviene hacerlo.

## Producto

- [ ] **Completar la i18n** (en curso de preparación). Falta el diccionario en
      inglés, el selector de idioma en Ajustes, guardar la preferencia, ajustar
      el `lang` del documento y formatear fechas y números con `Intl` en el
      idioma activo (hoy son fijos: `toLocaleString("es-ES")` y `formatDate`
      construye la cadena a mano). La parte difícil ya está hecha: todo el texto
      sale de `src/textos.ts` y los errores del núcleo viajan por código.
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
      aplicación lo sigue. También queda pendiente ver que la columna `#` no
      duplique líneas al crecer.

## Funciones pedidas

Peticiones del dueño del proyecto, en el orden en que conviene atacarlas.

- [ ] **Selección de varias líneas** — requisito de casi todo lo que sigue. Hoy
      solo hay una fila marcada con el clic (`selected` en `LogGrid.tsx`) y el
      menú de selección aparece al marcar texto con el ratón. Hace falta
      selección por rango (Mayús+clic), añadir y quitar líneas (Ctrl+clic) y
      decidir qué pasa con la selección al cambiar el filtro o al entrar líneas
      por el tail.
- [ ] **Atajos de teclado**: `F12` pantalla completa (oculta las dos filas de la
      barra y deja el log con su cabecera), `F` follow tail, `S` scroll
      automático, `O` abrir un log. Detalles a resolver: los atajos no deben
      dispararse mientras se escribe en un campo (filtro, patrón, reglas) ni con
      la ventana de reglas abierta; `F12` en WebView2 abre las herramientas de
      desarrollo si están habilitadas, así que hay que reservarlo o desactivarlas;
      la pantalla completa necesita una salida clara (`Esc`) y no confundirse con
      el F11 del sistema. **El diseño se discute con el usuario cuando se vaya a
      implementar**, no antes.
- [ ] **Configuración de atajos**: sección nueva en Ajustes para reasignarlos,
      con validación (una tecla no puede hacer dos cosas) y persistencia como el
      resto de preferencias. El mapa de atajos debería vivir en un solo módulo, y
      los botones de la barra mostrar su atajo en el `title`.
- [ ] **Columna Delta Time** (alcance decidido): desde el menú contextual de la
      cabecera de `Time`, añadir una columna con el tiempo transcurrido entre
      líneas. En el **grid principal el delta se calcula sobre todas las filas del
      fichero**, no solo sobre las visibles. Formato: milisegundos si el log los
      trae; minutos y segundos enteros si no. Pendiente: qué mostrar en la primera
      fila y qué hacer con las líneas sin instante.
- [ ] **Exportar y copiar la selección**: menú contextual sobre las líneas
      marcadas, con copiar y exportar a texto, con y sin número de línea. Copiar
      ya se puede hacer con `navigator.clipboard`; exportar a fichero necesita un
      diálogo de guardado, que en Tauri 2 es `tauri-plugin-dialog`: **dependencia
      nueva, hay que autorizarla antes de añadirla**. A decidir: formato del
      número (`1234` o `1234: `), si el fichero lleva cabecera y si el "con
      números" es una preferencia recordada en vez de cuatro acciones distintas.
- [ ] **Filtro avanzado con grid propio** (alcance definido por el usuario).
      Consulta estructurada sobre la sesión, del estilo «eventos WARN que
      contengan "tal", entre los días 2 y 15 y dentro de la franja de 12:07 a
      15:29». El resultado se ve en un **segundo grid en la parte inferior**, de
      un tercio de la pantalla como máximo, con su propia zona de filtros, que se
      puede ocultar y volver a mostrar.
      - **Independiente del grid principal**: cada uno mantiene su scroll, su tail
        y su autoscroll. El de abajo puede estar siguiendo el fichero mientras el
        de arriba está parado, y al revés. Técnicamente no hace falta otro hilo de
        tail: la sesión ya se sigue una vez en Rust; cada grid solo decide si se
        pega al final de *su* resultado filtrado.
      - Su **Delta Time** se calcula sobre las filas que pasan el filtro, no sobre
        todas: es justo lo útil cuando estás filtrando.
      - El panel es **por pestaña**: aparece solo en la pestaña donde se pidió y
        desaparece al cambiar a otra que no lo tenga, reapareciendo al volver.
      - **Vale también para pestañas con ficheros combinados** (pedido por el
        usuario). El filtro se aplica al orden entremezclado por instante, no a
        cada fuente por separado; y ahí tiene sentido añadir la **fuente** como
        condición, para quedarse con uno solo de los ficheros de la vista
        combinada (la columna `Source` ya existe).
      - En una pestaña combinada el tail está desactivado hoy: si el grid de
        abajo debe poder seguir en vivo una vista combinada, hay que resolver
        antes el reordenado por instante con líneas entrando (ver «Vista
        combinada» en `README.md` y `SPEC.md`).
      - **Decidido con el usuario**: la consulta se edita en una **ventana con
        formulario** (nada de sintaxis de texto, las fechas y horas se escriben
        mal); admite **AND, OR y NOT**; el rango de fechas es **entre dos fechas
        cualesquiera** y la franja horaria se aplica **a todos los días** de ese
        rango; el filtro **sustituye** a los niveles y el texto de la barra —para
        el grid de abajo, la barra sigue mandando en el principal—; y los filtros
        **se guardan con nombre por fichero**, para poder cargarlos más adelante.
      - Pendiente de decidir: forma exacta del formulario (grupos con paréntesis
        o lista plana), si además de los filtros del fichero hay una biblioteca
        común, dónde se guardan (localStorage o fichero exportable/importable), si
        al reabrir el fichero se restaura el último filtro con el panel abierto, si
        el panel se puede redimensionar, si el grid de abajo debe seguir en vivo en
        pestañas combinadas y si en combinadas se puede filtrar por fuente.

- [ ] **Persistencia de la configuración por fichero**: todo lo que se ajuste
      sobre un log se recuerda para la próxima vez. Ya se guardan parser, mapeo de
      columnas, codificación y reglas de color. Añadir: columnas visibles y sus
      anchos, Delta Time, y los filtros avanzados **con nombre**: el fichero
      recuerda cuáles tiene, cuál estaba activo y si el panel estaba abierto.
      También el tail y el autoscroll pasan a guardarse **por fichero** (hoy son
      preferencia global). Cuidado con recordar una consulta restrictiva: puede
      parecer que al fichero le faltan líneas, así que hace falta un indicador
      visible y una forma clara de limpiarla.

## Publicación

- [ ] **Traducir la documentación al inglés**. Orden recomendado:
      `README.md` en inglés con `README.es.md` al lado y una línea para cambiar
      de idioma; después `requirements.md`, `SPEC.md` y `AGENTS.md`. El
      `CHANGELOG.md` se queda en un solo idioma: traducir el histórico duplica
      mantenimiento y no aporta.
- [ ] **Licencia**. El repositorio no tiene `LICENSE`, así que legalmente nadie
      puede reutilizar el código ni saber bajo qué condiciones está. Elegir una
      (MIT o Apache-2.0 si se quiere protección de patentes) y enlazarla desde
      el README.
- [ ] **Ficha del repositorio en GitHub**: descripción corta, temas
      (`log-viewer`, `windows`, `rust`, `tauri`, `i18n`…), captura en las notas
      de la release y un texto de presentación en inglés.
- [ ] **Capturas que enseñen las funciones nuevas**: reglas de color en acción,
      vista combinada de dos ficheros y el panel de codificación. Una sola
      imagen no cuenta todo lo que hace.

## Calidad

- [ ] **Pruebas de la interfaz**: hoy no hay ninguna automática; `npm run build`
      solo comprueba tipos. Con la i18n recién hecha, una prueba de que `t()`
      devuelve algo para cada clave del catálogo cubriría lo más frágil.
- [ ] **Errores del núcleo que aún no llevan código**: revisar con `grep` los
      `Err(` de `src-tauri/src/` para que no quede ninguna frase suelta en
      castellano, ahora que la interfaz compone el texto.

## Notas de proceso

- Cada release: cerrar `[Unreleased]` del CHANGELOG antes de `bump.cmd X.Y.Z
  --tag`, que exige el árbol limpio.
- En el CHANGELOG solo va lo que cambia; no describir lo que se mantiene igual.
