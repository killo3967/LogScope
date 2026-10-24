# Sesión 2026-10-24

## Peticiones

- Cerrar la QA manual pendiente y arreglar lo que saliera (reglas con regex, marcar en rojo las inválidas).
- Arreglar `eMule_Verbose.log`: la primera línea se leía bien y el resto con espacios entre letras.
- Saber qué otras codificaciones se escapan; añadir `chardetng`, CP850 y un selector de codificación que recargue al momento.
- Separar la columna Logger en log4net y arrastrar ficheros sobre la ventana.
- Barra de título arrastrable para el panel de reglas y arrastrar y soltar ficheros.
- README para usuarios con captura; los requisitos y la compilación aparte.
- Licencia MIT, commits y publicación de una versión.
- Preparar y completar la i18n: seis idiomas (es, en, fr, it, de, pt) con selector.
- Rediseño de interfaz: menú de aplicación, barra corta, panel de Propiedades del fichero.
- Selección múltiple de líneas, copiar y exportar; Escape para desmarcar.
- Filtro avanzado: grupos con Y/O/NO, fechas, franja horaria, fuentes; después, dejarlo como está.
- Tail en vivo en vistas combinadas; columna Delta Time.
- Ordenar el trabajo: TODO.md con la cola, el plan y las pruebas manuales.

## Decisiones

- **Encoding**: detección en capas (BOM → patrón de ceros → frecuencias con `chardetng` → respaldo por línea); CP850/CP437/1250/1251 vía `MultiByteToWideChar`, sin dependencia nueva.
- **i18n**: catálogo plano por idioma (`src/i18n/*.ts`), castellano como fuente de tipos y `t()` con `useSyncExternalStore`; los errores del núcleo viajan por código, no como frases.
- **Interfaz**: menú de aplicación solo para lo global, barra para el log; Formato, Codificación y Columnas se mudan a Propiedades.
- **Tiempos**: se guarda la **hora de pared** (los dígitos del fichero) y el instante real se deriva con la **zona horaria del log** (ajuste por fichero, la del equipo por defecto). Se descartó convertir siempre a la zona del equipo.
- **Filtro avanzado**: sustituye a la barra mientras está activo; el grid propio, la biblioteca con nombre y las ventanas quedan pendientes.
- **Tail en combinadas**: inserción por instante con coste proporcional a lo nuevo; a igual instante, las nuevas detrás.
- **Exportar** sin diálogo (junto al log) por no autorizar `tauri-plugin-dialog`; el diálogo y los formatos quedan en la cola.
- Regla operativa: no añadir dependencias sin permiso explícito.

## Commits realizados

- `9e71759` feat(ui): columna Delta Time
- `19f6cee` feat(core): tail en vivo en vistas combinadas
- `08e2911` feat(ui): ventana del filtro avanzado
- `a2c7eee` feat(core): la rejilla enseña la hora escrita y la zona es un ajuste del log
- `654f3ac` feat(core): modelo y evaluación del filtro avanzado
- `5326b55` feat(ui): exportar la selección de líneas a un fichero de texto
- `26a0199` feat(ui): Escape quita la selección de líneas
- `bc06059` feat(ui): selección múltiple de líneas y copiar al portapapeles
- `70b36cf` feat(i18n): interfaz en seis idiomas con selector en Ajustes
- `f07482a` feat(ui): fase 1 del rediseño: menú de aplicación, barra corta y propiedades
- `1f73073` chore: publica LogScope bajo licencia MIT
- `2ef8f10` feat(ui): codificación en la barra, arrastrar ficheros y reglas más claras
- `8a83c63` feat(core): separa el columna Logger en log4net y NLog
- `e0f9b87` feat(core): lee la codificación real del fichero, no solo UTF-8
- `c252093` chore: recoge en AGENTS.md cómo trabajar en este repositorio
- Releases publicadas: **v0.2.0** y **v0.2.1** (con ejecutable adjunto).
- El resto, unos veinte commits de documentación (CHANGELOG, TODO, README, SPEC, requirements).

## Estado verificado

- 122 pruebas en verde (91 unitarias + 17 del filtro avanzado + 8 de fusión + 6 de muestra); `npm run build` sin errores; `verifica-i18n.py` con 226 claves coherentes en los seis idiomas.
- `LogScope.exe` 7.670.784 bytes, recompilado con todo lo de la sesión.
- Captura del README regenerada con las horas correctas.

## Siguiente paso

- Discutir el diseño de los **atajos de teclado** (teclas, pantalla completa y qué pasa al escribir) o, si no, hacer la **persistencia por fichero** (anchos por fichero y por grid, zona, Delta, filtros con nombre, tail/autoscroll).
- Pruebas manuales pendientes: rotación del tail, carga con 1 M de líneas y repaso de las traducciones en la app.

# Sesión 2026-10-22

## Peticiones

- Explicar REA (`morluto/rea`) y si se puede instalar en Windows.
- Preguntar si se puede montar REA en Docker e invocarlo por MCP para analizar apps locales.
- "Quiero que REA me cree una aplicación que haga lo que hace LogViewPlus" (redirigido a construir el clon propio).
- Poder navegar por un árbol de directorios al abrir un fichero.
- Columnizar automáticamente entradas de log de 4 líneas (timestamp / tag / nivel / logger+mensaje).
- Corregir columnas: sin separadores verticales, campos que no coincidían con las cabeceras, 6 cabeceras para 4 campos, y poder cuadrarlo a mano.
- Buscar ficheros log en C: y K:, analizarlos y preparar el software para soportarlos todos.
- Implementar los tipos de parser que usa LogExpert.
- Columnas redimensionables, colorear filas o palabras por patrón, varios logs en pestañas y combinar logs de formatos distintos.
- Entremezclar las líneas cuando los tiempos coinciden.

## Decisiones

- REA no es la vía para clonar LogViewPlus: su binario está ofuscado con SmartAssembly y DevExpress es código ajeno. El diseño se extrajo del XML de documentación que la propia instalación publica sin ofuscar (43 tipos, 255 miembros).
- Stack: Rust + Tauri 2 + React, solo Windows. Núcleo con arena contigua de bytes (~20 B por línea) en lugar de un `String` por campo.
- Árbol de directorios sin dependencias nuevas: FFI a `GetLogicalDrives` (con `is_dir()` se perdían unidades no listas, p. ej. `J:`).
- Parser `auto` por defecto que agrupa entradas multilínea, más los seis columnizers de LogExpert que faltaban (`json`, `clf`, `squarebracket`, `log4jxml`, `glassfish`, `websphere`), `logfmt`, `dsv` semántico y `pattern`.
- Fusión: `LogSet` con varias fuentes, cada una con su parser; orden por instante y, a igualdad de instante, **ronda entre fuentes** (`a0, b0, a1, b1…`). Entradas sin instante al final.
- Tail en vivo deshabilitado en vistas combinadas: mantener el orden exigiría reordenar en cada línea.
- Regla operativa: **no instalar, registrar ni modificar nada sin permiso explícito**. La instalación global de `rea-agents` que se hizo sin permiso se revirtió.

## Estado verificado

- 58 tests en verde (50 unitarios + 2 de fusión + 6 de integración) y `tsc --noEmit` sin errores.
- Ingestion medido: 1 000 000 de líneas (95,7 MB) en 1,06 s (90,6 MB/s); filtro por nivel 1,34 ms; 0,20 ms por página de 200 filas.
- Formatos reales detectados y probados: LM Studio, CBS de Windows, opencode (logfmt), calibre-mcp (pipe), vcpkg sin instantes, log4net y multilínea de Python.

## Siguiente paso

- Empaquetado NSIS: activar `bundle.active` en `src-tauri/tauri.conf.json` (los iconos ya están generados) y repartir un `.exe` instalable que no dependa de `npm run tauri dev`.
- Validación manual pendiente (requiere clics): pestañas, arrastre de columnas, reglas de color y `Combinar` con dos ficheros del mismo segundo.
