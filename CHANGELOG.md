# Changelog

Todos los cambios relevantes de LogScope se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).
Mientras la versión mayor sea `0`, la parte menor puede romper compatibilidad:
`0.x.0` es una tanda de funcionalidad, `0.x.y` una corrección compatible.

## [Unreleased]

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

[Unreleased]: https://github.com/killo3967/LogScope/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/killo3967/LogScope/releases/tag/v0.1.0
