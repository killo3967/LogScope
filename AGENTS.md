# AGENTS.md — LogScope

Visor de logs de escritorio (Rust + Tauri 2 + React/TypeScript).
Núcleo de parseo e índice en `src-tauri/src/`, interfaz en `src/`.
Decisiones de diseño en `SPEC.md`; lo que cambia de versión, en `CHANGELOG.md`.

## Permiso permanente: cerrar la aplicación para recompilar

El dueño del repositorio autoriza **cerrar `LogScope.exe` sin preguntar** cada
vez que haga falta recompilar el ejecutable.

`build.cmd` aborta antes de compilar si el fichero está bloqueado, y el bloqueo
lo produce la propia aplicación abierta. Secuencia permitida:

```powershell
taskkill //IM LogScope.exe //F    # solo si está en ejecución
build.cmd                          # ~1m 45s; deja LogScope.exe en la raíz
```

Es el único proceso que se puede matar sin confirmación. Cualquier otra
aplicación o servicio del usuario requiere permiso explícito.

Tras recompilar, avisar de que el binario está listo: las pruebas de interfaz
las hace el usuario a mano sobre `LogScope.exe`.

## Comandos

| Qué | Comando |
|---|---|
| Frontend (tsc + vite) | `npm run build` |
| Tests de Rust | `cd src-tauri && cargo test` |
| Ejecutable autónomo | `build.cmd` |
| Arnés de logs reales (lento, `#[ignore]`) | `cd src-tauri && cargo test --test formatos_reales -- --ignored --nocapture` |
| Desarrollo con recarga | `npm run tauri dev` |
| Versión (única fuente) | `bump.cmd` |

## Reglas del repositorio

- Español de España en documentación, comentarios y mensajes de commit; los
  identificadores del código, en inglés.
- Commits convencionales (`feat:`, `fix:`, `build:`, `chore:`), en imperativo y
  explicando el porqué en el cuerpo.
- `samples/` y `LogScope.exe` están en `.gitignore`: son datos de prueba y
  binarios locales, no se versionan.
- Ficheros de texto con LF (`.gitattributes`); los `.cmd`, con CRLF.
- Antes de decir que algo funciona: `npm run build` y `cargo test` en verde.
- Los cambios de interfaz no se pueden verificar desde la línea de comandos:
  se comprueba `tsc`, se compila y se le pide al usuario que lo pruebe.

## Notas que ahorran tiempo

- `tauri build` recompila el crate aunque solo cambien assets del frontend.
- `npx tauri build` no tiene `--profile`; los perfiles propios van tras `--`.
- Para distinguir un build de desarrollo: `cfg(dev)` en
  `src-tauri/target/<perfil>/build/logscope-<hash>/output`. El string
  `localhost:5173` no sirve como indicador.
- `EntryTable::matching_indices` devuelve vacío cuando el filtro no está activo;
  para leer filas en un test, usa `row(index)`.
- El menú contextual de WebView2 no se puede ampliar desde JS: o se sustituye
  por completo o se deja pasar el nativo.
