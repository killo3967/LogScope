@echo off
rem ---------------------------------------------------------------------------
rem  Compila LogScope con el frontend incrustado y deja el ejecutable en la raiz.
rem
rem    build.cmd             perfil release   -> binario de distribucion
rem    build.cmd profiling   perfil profiling -> igual, pero con simbolos, para perfilar
rem
rem  Sin --no-bundle se generaria el instalador; bundle.active esta en false, asi
rem  que de momento solo interesa el .exe.
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"
if errorlevel 1 (
    echo [ERROR] No se pudo entrar en el directorio del proyecto.
    exit /b 1
)

set "PERFIL=%~1"
if not defined PERFIL set "PERFIL=release"

if /i "%PERFIL%"=="release" goto :release
if /i "%PERFIL%"=="profiling" goto :profiling

echo [ERROR] Perfil desconocido: %PERFIL%
echo         Uso: build.cmd [release^|profiling]
exit /b 2

:release
set "TAURI_ARGS="
set "BUILD_DIR=src-tauri\target\release"
set "COPIAR_PDB="
goto :build

:profiling
set "TAURI_ARGS=-- --profile profiling"
set "BUILD_DIR=src-tauri\target\profiling"
set "COPIAR_PDB=1"
goto :build

:build
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm no esta en el PATH.
    exit /b 1
)

rem Con LogScope abierto, la copia final falla despues de minuto y medio de
rem compilacion: el .exe en ejecucion esta bloqueado. Se comprueba antes.
if exist "LogScope.exe" (
    powershell -NoProfile -Command "try { $f = [IO.File]::Open('LogScope.exe','Open','ReadWrite','None'); $f.Close(); exit 0 } catch { exit 1 }"
    if errorlevel 1 (
        echo [ERROR] LogScope.exe esta abierto y bloquea el fichero.
        echo         Cierra la aplicacion y vuelve a ejecutar build.cmd.
        exit /b 1
    )
)

echo == LogScope ^| perfil %PERFIL%
echo    tauri build ejecuta antes "npm run build" ^(tsc --noEmit + vite build^)
echo    y compila con la feature tauri/custom-protocol, que incrusta el frontend.
echo.

call npx tauri build --no-bundle %TAURI_ARGS%
if errorlevel 1 (
    echo.
    echo [ERROR] La compilacion ha fallado.
    exit /b 1
)

if not exist "%BUILD_DIR%\logscope.exe" (
    echo [ERROR] No existe el ejecutable esperado: %BUILD_DIR%\logscope.exe
    exit /b 1
)

copy /y "%BUILD_DIR%\logscope.exe" "LogScope.exe" >nul
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudo copiar el ejecutable a la raiz: esta en uso.
    echo         Cierra LogScope y vuelve a ejecutar build.cmd.
    exit /b 1
)

if defined COPIAR_PDB (
    if exist "%BUILD_DIR%\logscope.pdb" (
        copy /y "%BUILD_DIR%\logscope.pdb" "LogScope.pdb" >nul
        echo    simbolos: %CD%\LogScope.pdb
    )
)

echo.
for %%F in ("LogScope.exe") do echo == Listo: %CD%\LogScope.exe ^(%%~zF bytes, perfil %PERFIL%^)
endlocal
exit /b 0
