@echo off
REM Script para Windows: crear entorno virtual y activarlo

REM Nombre del entorno virtual
set env_name=venv

REM Crear entorno virtual si no existe
if not exist %env_name% (
    python -m venv %env_name%
    echo Entorno virtual '%env_name%' creado.
) else (
    echo El entorno virtual '%env_name%' ya existe.
)

REM Activar entorno virtual
echo Ahora se activará el entorno virtual.
call %env_name%\Scripts\activate.bat
