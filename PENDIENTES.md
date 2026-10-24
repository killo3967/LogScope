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
