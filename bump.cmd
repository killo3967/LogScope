@echo off
rem ---------------------------------------------------------------------------
rem  Sube la version de LogScope en los cuatro manifiestos a la vez.
rem
rem    bump.cmd 0.2.0              escribe la version nueva
rem    bump.cmd 0.2.0 --dry-run    solo muestra que ficheros cambiarian
rem    bump.cmd 0.2.0 --tag        ademas commitea y crea la etiqueta v0.2.0
rem
rem  La fuente de verdad es package.json; el script aborta si los manifiestos
rem  ya no coinciden entre si.
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"
if errorlevel 1 (
    echo [ERROR] No se pudo entrar en el directorio del proyecto.
    exit /b 1
)

if "%~1"=="" (
    echo Uso: bump.cmd ^<X.Y.Z^> [--dry-run^] [--tag^]
    exit /b 2
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] node no esta en el PATH.
    exit /b 1
)

node scripts\bump-version.mjs %*
exit /b %errorlevel%
