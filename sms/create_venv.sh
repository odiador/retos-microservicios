#!/bin/bash
# Script para Linux: crear entorno virtual y activarlo

# Nombre del entorno virtual
env_name="venv"

# Crear entorno virtual si no existe
if [ ! -d "$env_name" ]; then
    python3 -m venv $env_name
    echo "Entorno virtual '$env_name' creado."
else
    echo "El entorno virtual '$env_name' ya existe."
fi

# Activar entorno virtual
echo "Ahora se activará el entorno virtual."
source $env_name/bin/activate
