# LogScope — visor de logs de escritorio

Visor de logs nativo para Windows con parseo configurable, grid virtualizado y
seguimiento en vivo. Alternativa propia a LogViewPlus, sin dependencias
comerciales.

## Decisiones tomadas

| Decisión | Valor |
|---|---|
| Stack | Rust (núcleo) + Tauri 2 + React/TypeScript (UI) |
| Plataforma | Solo Windows 10/11 x64 |
| Alcance v1 | Archivos locales + parseo + filtros + búsqueda + tail en vivo con rotación + combinar ficheros por instante + pestañas + reglas de color por fichero + detección de codificación |
| Fuera de v1 | Syslog/red, fuentes remotas, SQL sobre logs, plugins, macOS/Linux |

## Origen del diseño

El modelo de dominio no se ha inventado: se ha extraído del XML de documentación
que la propia instalación de LogViewPlus publica sin ofuscar
(`Clearcove.LogViewer.Common.xml`, 255 miembros, 43 tipos). La arquitectura de
referencia que expone es:

```
ILogReader / ILogFile        → lectura y ciclo de vida del fichero
ILogParser / ParseResult     → parseo de línea a campos
ILogMem / IEntrySize         → almacenamiento compacto indexado
FieldColumnInfo              → modelo de columna tipada
ILogFilter                   → filtrado
SearchHighlightCriteria      → búsqueda y resaltado
ILogAnalyzer                 → análisis derivado
ITailChangedNotification     → aviso de cambios en vivo
IAddOn                       → extensibilidad
```

LogScope implementa el mismo esqueleto conceptual con tres módulos propios. No
reutiliza código de LogViewPlus ni de DevExpress: esas son obras ajenas con
licencia propia.

## Arquitectura

```
UI (React)                    Núcleo (Rust)
─────────────────             ─────────────────────────────
LogGrid  ──read_page──────▶  EntryTable   (arena + índices)
Toolbar  ──open_files─────▶  Parser       (auto | basic | logfmt | json | clf |
                                             squarebracket | log4jxml | glassfish |
                                             websphere | dsv | pattern)
Status   ◀─log://appended──  Tailer       (polling + rotación)
                              encoding     (BOM → ceros → frecuencias)
```

### Modelo de datos (equivalente a `ILogMem`)

No se guarda un `String` por campo: eso son cientos de MB con un millón de
líneas. Se guarda la línea cruda en una **arena contigua** y se proyectan las
columnas al leer la página visible.

```rust
arena: Vec<u8>      // bytes de todas las líneas, concatenados
starts: Vec<u32>    // offset de cada línea dentro de la arena
lens: Vec<u32>      // longitud de cada línea
ts: Vec<i64>        // epoch ms (i64::MIN = sin timestamp)
level: Vec<u8>      // nivel como código
line_nos: Vec<u32>
```

Coste por línea: ~20 B de tablas + el tamaño de la línea. Un fichero de 1 M de
líneas de 150 B ocupa ~170 MB, no gigabytes.

Con varios ficheros abiertos a la vez, `LogSet` envuelve varias `EntryTable`
—cada una con su propio parser y su propia codificación— y guarda un
`order: Vec<(ts, source_idx, entry_idx)>` con el orden por instante; a igual
instante las fuentes se alternan en ronda. Con una sola fuente el orden es la
identidad, que es lo que permite que el tail empuje índices nuevos sin
reordenar nada.

### Parseo

Trait `LogParser` con detección automática al abrir y once implementaciones:

| Parser | Uso | Extrae |
|---|---|---|
| `auto` (por defecto) | Detecta el formato y agrupa entradas multilínea | instante, nivel, hilo, etiqueta, logger y mensaje |
| `basic` | Una línea por entrada, sin agrupar | instante, nivel, hilo, etiqueta, logger y mensaje |
| `logfmt` | Pares `clave=valor` | `Logger`, `Extra` y `Message` |
| `json` | Una línea JSON por entrada | `@timestamp`, `level`, `logger_name`, `message` |
| `clf` | Apache/Nginx | host, petición, estado, bytes, referer y user-agent |
| `squarebracket` | `[fecha] [hora] [nivel] [origen] mensaje` | instante, nivel, origen y mensaje |
| `log4jxml` | Eventos `<log4j:event>` de varias líneas | instante, hilo, logger y mensaje |
| `glassfish` | `[#\|instante\|NIVEL\|…\|#]` | instante, nivel, hilo, logger y mensaje |
| `websphere` | `[fecha hora:ms zona] hilo componente N mensaje` | instante, hilo, logger y mensaje |
| `dsv` | CSV/TSV/pipe | columnas deducidas por contenido, no por cabecera |
| `pattern` | Regex con grupos con nombre | `ts`, `level` y un campo por grupo |

El conjunto se comprobó contra logs reales de esta máquina (log4net/NLog, CBS de
Windows, LM Studio, opencode, vcpkg, calibre-mcp y trazas multilínea de Python) y
contra las muestras de formato de LogExpert.

El tiempo se reconoce con una lista de formatos (RFC 3339, ISO, `dd/MM/yyyy`,
log4j `dd-MMM-yyyy`, `HH:mm:ss`, epoch en s o ms) y se normaliza a epoch ms en
hora local.

#### Codificación

Antes de parsear, los bytes se convierten a UTF-8. La detección va de más fiable
a menos: BOM (UTF-8, UTF-16 y UTF-32, con UTF-32 antes que UTF-16 porque
comparten prefijo), patrón de ceros para UTF-16 y UTF-32 sin BOM, y análisis de
frecuencias con `chardetng` cuando la cabecera no es UTF-8 limpio. El respaldo
por línea es UTF-8 con sustitución de los bytes rotos, o Windows-1252 si el
texto no tiene ni una secuencia multibyte válida.

La conversión la hacen `encoding_rs` y, para las páginas OEM que no trae
(CP850, CP437, CP1250, CP1251), la tabla del propio Windows
(`MultiByteToWideChar`). UTF-32 se decodifica a mano porque `encoding_rs` no lo
soporta. Cuando la detección no puede acertar —las páginas de un solo byte
comparten los mismos bytes con significados distintos— el usuario fuerza la
codificación desde la barra.

### Tail en vivo

Hilo propio por sesión, sondeo cada 250 ms:

1. Lee del offset actual al final del fichero.
2. Acumula bytes incompletos hasta el siguiente `\n`.
3. Si `len(fichero) < offset_actual` → truncado: se reinicia el índice.
4. Si cambia la identidad del fichero → rotación: se reinicia el índice.
5. Emite `log://appended` con el número de bytes nuevos.

En una vista combinada se vigila **cada fuente** por separado y las entradas
nuevas se insertan en el orden por instante con búsqueda binaria, así que el
coste es proporcional a lo que entra, no al tamaño del fichero. A igual instante,
las nuevas van después de las que ya estaban; la ronda perfecta entre fuentes
solo se garantiza al construir la vista. Al rotar o truncar una fuente hay que
reconstruir el orden completo, que es el caso caro y excepcional.

`ReadDirectoryChangesW` por `notify` es la mejora prevista: elimina el sondeo,
no el algoritmo.

## Contrato entre UI y núcleo

| Comando | Entrada | Salida |
|---|---|---|
| `open_files` | `{paths[], options{path, parser?, pattern?, delimiter?, mapping?, encoding?}}` | `{session_id, parser, encoding, entries, bytes, fields, sources, merged, sample_lines, proposed_mapping}` |
| `open_file` | `{path, parser?, pattern?, delimiter?}` | igual que `open_files`, con una sola ruta |
| `read_page` | `{session_id, start, count, filters{levels?, text?}}` | `{total, start, rows[]}` |
| `stats` | `{session_id}` | `{entries, bytes, tailing}` |
| `start_tail` / `stop_tail` | `{session_id}` | `{}` |
| `close_session` | `{session_id}` | `{}` |
| `list_dir` / `list_roots` | `{path}` / `{}` | entradas del árbol de directorios |

Eventos: `log://appended` → `{sessionId, bytes}` y `log://tail-stopped` →
`{sessionId}`.

## Hitos

- [x] M1 — Esqueleto y modelo de datos
- [x] M2 — Compila y abre un log real con el parser `basic`
- [ ] M3 — Grid virtualizado fluido con 1 M de líneas
      El grid está virtualizado y paginado en producción, y medido con 200 000
      líneas (página de 200 filas en 0,35 ms, ingesta a 79,9 MB/s). Falta la
      prueba de carga con 1 M.
- [x] M4 — Filtros por nivel y texto, con caché de coincidencias
- [x] M5 — Tail en vivo con rotación y autoscroll
      Tail y autoscroll validados a mano. La rotación está implementada, pero
      sin probar a mano.
- [x] M6 — Parser `pattern` configurable con editor de campos
- [ ] M7 — Persistencia de sesión (workspace) y empaquetado NSIS
      Hecha la persistencia: reapertura del último log con su receta completa
      (rutas, parser, patrón, delimitador, mapeo y codificación) y ajustes
      guardados. Pendiente el empaquetado NSIS (`bundle.active` sigue en `false`).

### Entregado después del plan (0.2.0)

Sin hito propio, pero ya en la release: combinación de varios ficheros por
instante, pestañas con estado propio, reglas de color por fichero, detección de
codificación (UTF-16, UTF-32, páginas OEM y análisis de frecuencias), arrastrar
ficheros sobre la ventana y columna Logger en log4net/NLog.

## Verificación

- `cargo build` sin warnings en el núcleo. **Hecho**, y además 87 pruebas en
  verde (`cargo test`), más un arnés con 14 ficheros reales de esta máquina que
  se ejecuta a mano (`cargo test --test formatos_reales -- --ignored`).
- `npm run build` (tsc + vite) sin errores. **Hecho**.
- Prueba de carga: fichero sintético de 1 M de líneas, medir RAM y latencia de
  scroll por debajo de 16 ms por frame. **Pendiente**: medido con 200 000 líneas.
- Prueba de tail: escribir mientras se lee, truncar el fichero y rotarlo,
  comprobando que el índice se reinicia sin duplicar ni perder líneas.
  **Parcial**: escribir y leer está validado; truncado y rotación están
  implementados pero sin probar a mano.

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Filtro O(n) en cada lectura | Caché de índices de coincidencia, invalidada al añadir líneas |
| Ficheros de varios GB | Lectura por bloques de 1 MB; mmap si el rendimiento lo exige |
| Encoding mixto | Cuatro capas de detección (BOM, ceros, frecuencias, respaldo por línea) y selector manual de codificación |
| Páginas de 8 bits ambiguas (CP1252 frente a CP850) | Se asume Windows-1252 y el usuario puede forzar la página en la barra |
| Ficheros binarios con extensión `.log` | Se muestran como texto; no hay detección de binario |
| Puente IPC Tauri | Paginación fija de 200 filas, no envío del dataset |
