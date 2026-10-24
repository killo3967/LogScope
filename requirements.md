# LogScope — requisitos y trabajo en el repositorio

Este documento es para quien vaya a **compilar o modificar** LogScope. Si solo
quieres usar la aplicación, descarga `LogScope.exe` de la
[última versión](https://github.com/killo3967/LogScope/releases/latest) y lee el
[README](README.md): no hace falta nada de lo que hay aquí.

## Requisitos

- **Rust** 1.77 o superior (probado con 1.94.0) y el toolchain MSVC.
- **Node.js** 20 o superior (probado con 24.22.1).
- **Visual Studio Build Tools** con el conjunto de herramientas C++ (MSVC), que
  es lo que enlaza el núcleo.
- **WebView2**: viene con Windows 10/11 actualizado. Si no estuviera, el
  instalador de Microsoft lo añade.
- Windows 10/11 x64. No hay soporte para macOS ni Linux.

## Puesta en marcha

```powershell
npm install
npm run build        # tsc --noEmit + vite build
npm run tauri dev    # ventana de desarrollo con recarga en caliente
```

`npm run tauri dev` compila el núcleo la primera vez (tarda unos minutos) y
después recarga la interfaz al guardar.

## Ejecutable autónomo

```powershell
build.cmd
```

Deja `LogScope.exe` en la raíz del repositorio, con el frontend incrustado: no
necesita servidor de Vite ni Node instalado. Tarda alrededor de un minuto y
medio, porque compila en modo release con LTO.

`build.cmd` **aborta antes de compilar** si `LogScope.exe` está en ejecución,
porque Windows bloquea el fichero. Cierra la aplicación y vuelve a lanzarlo.

## Pruebas

```powershell
cd src-tauri
cargo test                                   # 87 pruebas: únicas + integración
cargo test --test formatos_reales -- --ignored --nocapture
```

El segundo comando es un arnés manual que abre ficheros de log **reales** de esta
máquina (CBS de Windows, LM Studio, opencode, vcpkg, muestras de formato…) y
muestra el parser detectado, las columnas y el tiempo de ingesta. Está marcado
como `#[ignore]` porque depende de rutas locales, así que no corre en cada
`cargo test`.

La interfaz se comprueba con `npm run build`, que ejecuta `tsc --noEmit` antes de
empaquetar. No hay pruebas automáticas de la interfaz: los cambios visuales se
prueban a mano sobre el ejecutable.

## Versionado y publicación

La versión vive en cinco sitios y se cambia desde un solo comando:

```powershell
bump.cmd 0.2.0              # escribe la versión en los manifiestos
bump.cmd 0.2.0 --dry-run    # solo muestra qué cambiaría
bump.cmd 0.2.0 --tag        # además commitea y crea la etiqueta v0.2.0
```

La fuente de verdad es `package.json`; el script aborta si los manifiestos ya
discrepan entre sí.

Para publicar una versión:

1. Cerrar `[Unreleased]` en `CHANGELOG.md` como `[X.Y.Z] - fecha` y actualizar
   los enlaces de comparación del final.
2. `bump.cmd X.Y.Z --tag`.
3. `git push origin main && git push origin vX.Y.Z`.
4. `build.cmd` y adjuntar el ejecutable a la release:

```powershell
gh release create vX.Y.Z LogScope.exe --title "LogScope vX.Y.Z" --notes-file notas.md
```

## Estructura

```
src/                 interfaz (React + TypeScript)
  App.tsx            estado de pestañas, apertura, ajustes y atajos
  textos.ts          catálogo de todos los textos visibles (preparado para i18n)
  errores.ts         traduce los códigos de error del núcleo a frases
  LogGrid.tsx        grid virtualizado, reglas de color y arrastre de columnas
  Toolbar.tsx        barra: ruta, acciones, formato, codificación y filtros
  HighlightRules.tsx panel de reglas (ventana arrastrable)
  types.ts           tipos compartidos con el núcleo
src-tauri/src/       núcleo (Rust)
  lib.rs             comandos de Tauri (open_files, read_page, stats…)
  index.rs           arena de líneas, índices y filtros
  parser.rs          trait LogParser y los parsers de una línea
  columnizers.rs     parsers de formato (json, clf, glassfish…)
  encoding.rs        detección y conversión de codificación
  tail.rs            seguimiento en vivo
  fsbrowse.rs        árbol de directorios
samples/             logs de prueba (no se versiona)
docs/                capturas usadas en la documentación
```

## Muestras de prueba

`samples/` está en `.gitignore`: no se versiona. Si necesitas datos, cualquier
log real sirve; para las pruebas de carga se usó un fichero sintético de 200 000
líneas en formato log4net.

## Textos y errores

Ningún componente escribe texto visible directamente: todos leen de
`src/textos.ts` con `t("zona.clave", params)`. Para añadir un idioma basta con
un diccionario nuevo en ese fichero y un valor en `Idioma`; no hay dependencias
de i18n.

Los errores del núcleo viajan como JSON (`{"code":"…","params":{…}}`, ver
`error_json` en `src-tauri/src/lib.rs`) y `src/errores.ts` los convierte en la
frase de `error.<código>`. Los errores del sistema van con `code: "io"` y el
texto original en `params.message`, para no perder información. Si añades un
error nuevo en Rust, añade también su clave `error.<código>` al catálogo.

## Detalles que ahorran tiempo

- Cada `tauri build` recompila el crate aunque solo cambien los assets del
  frontend.
- `npx tauri build` no tiene `--profile`; un perfil propio se pasa tras `--`.
- Para distinguir un build de desarrollo: `cfg(dev)` en
  `src-tauri/target/<perfil>/build/logscope-<hash>/output`.
- Los ficheros de texto van con LF y los `.cmd` con CRLF (`.gitattributes`).
