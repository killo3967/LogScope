# LogScope

Visor de logs de escritorio para Windows. Alternativa propia a LogViewPlus,
sin dependencias comerciales.

- Núcleo: Rust (parseo, índice, tail)
- UI: Tauri 2 + React + TypeScript
- Alcance: ficheros locales con parser configurable, filtros por nivel y texto,
  grid virtualizado y seguimiento en vivo

Diseño y decisiones en [SPEC.md](SPEC.md).

## Requisitos

- Rust 1.77+ (probado con 1.94.0)
- Node.js 20+ (probado con 24.22.1)
- Visual Studio Build Tools con el toolset C++ (MSVC)
- WebView2 (viene con Windows 10/11 actualizado)

## Uso

```powershell
npm install
npm run build        # tsc --noEmit + vite build
npm run tauri dev    # ventana de desarrollo con recarga en caliente
```

Un log se puede abrir de tres formas: escribiendo su ruta y pulsando
**Abrir**, con **Examinar…** para recorrer el árbol de directorios, o
arrastrándolo desde el explorador de Windows y soltándolo sobre la ventana.
Al soltar varios ficheros se abre uno por pestaña, en el orden en que se
soltaron.

## Parsers

`auto` es el predeterminado y detecta el formato al abrir. Formatos reales
verificados contra los logs de esta máquina:

| Formato | Ejemplo | Detectado como |
|---|---|---|
| log4net / NLog | `2026-10-22 08:00:00,004 [1] DEBUG App - msg` | `auto` |
| Multilínea (Python) | `ts \n tag \n info \n logger: msg` | `auto` |
| LM Studio | `[2026-02-09 10:39:38][INFO][LM STUDIO SERVER] msg` | `auto` |
| CBS de Windows | `﻿2026-10-15 22:45:21, Info  CBS  TI: --- …` | `auto` |
| opencode / estructurado | `timestamp=… level=INFO run=x message="…"` | `logfmt` |
| Delimitado (pipe, CSV) | `ts \| INFO \| logger \| hilo \| msg` | `dsv` |
| Sin instantes (texto, YAML) | `---` / `events:` | `auto` (una línea por entrada) |
| UTF-16LE con BOM (eMule, .NET) | `24/10/2026 10:55:36: Stopping Kademlia` | `auto` |

También se pueden forzar a mano:

| Parser | Uso | Equivalente en LogExpert |
|---|---|---|
| `auto` | Detecta instante, nivel, hilo, etiqueta, logger y mensaje | `AutoColumnizer` |
| `basic` | Una línea por entrada, sin agrupar | `DefaultLogfileColumnizer` |
| `logfmt` | Pares `clave=valor`; separa `Logger`, `Extra` y `Message` | — |
| `json` | Una línea JSON por entrada; mapea `@timestamp`, `level`, `logger_name`, `message` | `JsonColumnizer`, `JsonCompactColumnizer` |
| `clf` | Apache/Nginx: host, petición, estado, bytes, referer y user-agent | `ClfColumnizer` |
| `squarebracket` | `[fecha] [hora] [nivel] [origen] mensaje` | `SquareBracketColumnizer` |
| `log4jxml` | Eventos `<log4j:event>` de varias líneas | `Log4jXmlColumnizer` |
| `glassfish` | `[#\|instante\|NIVEL\|…\|#]` | `GlassfishColumnizer` |
| `websphere` | `[fecha hora:ms zona] hilo componente N mensaje` | `WebsphereColumnizer` |
| `dsv` | Deduce qué columna es tiempo, nivel, logger, hilo y mensaje según su contenido | `CsvColumnizer` |
| `pattern` | Regex con grupos con nombre; `ts` y `level` son reservados | `RegexColumnizer` |

Si la detección no acierta, el botón **Columnas…** permite reasignar cada línea
del registro a su columna (`time`, `level`, `thread`, `tag`, `logger`,
`message`, `ignore`).

En un formato de una sola línea, `auto` separa la columna **Logger** cuando el
logger viene como `Logger - mensaje` justo detrás del nivel, que es lo habitual
en log4net y NLog:

```
2026-10-22 08:00:03,103 [12] WARN App.Servicio.Pedidos - reintento
                                       └── Logger ──┘   └─ Message ─┘
```

Sin nivel delante no hay cabecera que separar, así que un ` - ` en el texto se
queda dentro del mensaje (`2026-10-15 10:00:00 hola - adios`).

La codificación se detecta en tres pasos: **BOM** (UTF-8/16/32, con UTF-32 antes
que UTF-16 porque comparten prefijo), **patrón de ceros** para UTF-16 y UTF-32
sin BOM, y **análisis de frecuencias** con `chardetng` (el detector de Mozilla)
cuando la cabecera no es UTF-8 limpio; ahí se resuelve el cirílico en CP1251 o
KOI8-R, el Shift-JIS, GBK, Big5, griego o hebreo. El detector no se consulta si
el texto ya es UTF-8 razonablemente válido, para no reinterpretar de más.
En la segunda fila de la barra, **Codificación** permite forzarla: `auto`,
UTF-8, UTF-16 y UTF-32 LE/BE, Windows-1252/1250/1251, CP850 y CP437 (consola),
ISO-8859-15, KOI8-R, Shift-JIS, GBK, Big5 y EUC-JP. Hace falta porque las
páginas de un solo byte comparten los mismos bytes con significados distintos y
ningún detector puede acertar siempre. Al lado, **Formato** elige el parser.

Ejemplo de patrón para formato log4net:

```
^(?P<ts>\S+ \S+) \[(?P<Thread>\d+)\] (?P<level>\w+) (?P<Logger>[\w.]+) - (?P<Message>.*)$
```

## Vista combinada

Marca varios ficheros en el navegador y pulsa **Combinar**. Cada fichero
conserva su propio parser, así que se pueden mezclar formatos distintos, y las
entradas se ordenan por instante:

- Instantes distintos: orden cronológico.
- **Instantes iguales: las fuentes se alternan en ronda** (`a0, b0, a1, b1…`),
  de manera que dos logs del mismo segundo quedan entremezclados y no en dos
  bloques. Si una fuente se queda sin líneas en ese instante, la otra continúa.
- Entradas sin instante: al final, en el orden en que se leyeron.

La columna `Source` indica el fichero de cada fila. El tail en vivo se
desactiva en vistas combinadas: mantener el orden con líneas entrando en varios
ficheros exigiría reordenar en cada línea.

## Estado

| Hito | Estado |
|---|---|
| M1 Esqueleto y modelo de datos | hecho |
| M2 Abrir un log real | en curso |
| M3 Grid fluido con 1 M de líneas | pendiente |
| M4 Filtros con caché de coincidencias | parcial (filtro O(n) con caché invalidada al crecer) |
| M5 Tail con rotación y autoscroll | implementado, sin probar |
| M6 Editor de campos del parser | pendiente |
| M7 Persistencia y empaquetado NSIS | pendiente |

## Notas

- El grid solo pide al núcleo las filas visibles (200 por página); nunca se
  transfiere el dataset completo por el puente IPC.
- La arena de líneas evita un `String` por campo: ~20 B de sobrecoste por línea.
- `samples/` está en `.gitignore`: contiene un log sintético de 200 000 líneas.
