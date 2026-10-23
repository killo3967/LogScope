# LogScope — visor de logs de escritorio

Visor de logs nativo para Windows con parseo configurable, grid virtualizado y
seguimiento en vivo. Alternativa propia a LogViewPlus, sin dependencias
comerciales.

## Decisiones tomadas

| Decisión | Valor |
|---|---|
| Stack | Rust (núcleo) + Tauri 2 + React/TypeScript (UI) |
| Plataforma | Solo Windows 10/11 x64 |
| Alcance v1 | Archivos locales + parseo + filtros + búsqueda + tail en vivo con rotación |
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
Toolbar  ──open_file──────▶  Parser       (basic | dsv | pattern)
Status   ◀─log://appended──  Tailer       (polling + rotación)
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

### Parseo

Trait `LogParser` con tres implementaciones en v1:

| Parser | Uso | Extrae |
|---|---|---|
| `basic` | Logs típicos sin configuración | timestamp, nivel, mensaje |
| `dsv` | CSV/TSV/pipe | columnas por cabecera o por posición |
| `pattern` | Regex con grupos con nombre | `ts`, `level` y un campo por grupo |

El tiempo se reconoce con una lista de formatos (RFC 3339, ISO, `dd/MM/yyyy`,
log4j `dd-MMM-yyyy`, `HH:mm:ss`, epoch en s o ms) y se normaliza a epoch ms en
hora local.

### Tail en vivo

Hilo propio por sesión, sondeo cada 250 ms:

1. Lee del offset actual al final del fichero.
2. Acumula bytes incompletos hasta el siguiente `\n`.
3. Si `len(fichero) < offset_actual` → truncado: se reinicia el índice.
4. Si cambia la identidad del fichero → rotación: se reinicia el índice.
5. Emite `log://appended` con el número de bytes nuevos.

`ReadDirectoryChangesW` por `notify` es la mejora prevista: elimina el sondeo,
no el algoritmo.

## Contrato entre UI y núcleo

| Comando | Entrada | Salida |
|---|---|---|
| `open_file` | `{path, parser?, pattern?, delimiter?}` | `{session_id, parser, entries, bytes, fields}` |
| `read_page` | `{session_id, start, count, filters}` | `{total, start, rows[]}` |
| `start_tail` / `stop_tail` | `{session_id}` | `{}` |
| `stats` | `{session_id}` | `{entries, bytes, tailing}` |
| `close_session` | `{session_id}` | `{}` |

Evento: `log://appended` → `{sessionId, bytes}`.

## Hitos

- [x] M1 — Esqueleto y modelo de datos (este estado)
- [ ] M2 — Compila y abre un log real con el parser `basic`
- [ ] M3 — Grid virtualizado fluido con 1 M de líneas
- [ ] M4 — Filtros por nivel y texto, con caché de coincidencias
- [ ] M5 — Tail en vivo con rotación y autoscroll
- [ ] M6 — Parser `pattern` configurable con editor de campos
- [ ] M7 — Persistencia de sesión (workspace) y empaquetado NSIS

## Verificación

- `cargo build` sin warnings en el núcleo.
- `npm run build` (tsc + vite) sin errores.
- Prueba de carga: fichero sintético de 1 M de líneas, medir RAM y latencia de
  scroll por debajo de 16 ms por frame.
- Prueba de tail: escribir mientras se lee, truncar el fichero y rotarlo,
  comprobando que el índice se reinicia sin duplicar ni perder líneas.

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Filtro O(n) en cada lectura | Caché de índices de coincidencia, invalidada al añadir líneas |
| Ficheros de varios GB | Lectura por bloques de 1 MB; mmap si el rendimiento lo exige |
| Encoding mixto | UTF-8 con caída a Windows-1252 |
| Puente IPC Tauri | Paginación fija de 200 filas, no envío del dataset |
