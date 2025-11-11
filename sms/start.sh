#!/bin/bash

# Script para iniciar el consumer de SMS y health checks
# Los endpoints REST han sido eliminados por seguridad

echo "Iniciando servicio SMS (solo consumer y health checks)..."

# Función para limpiar procesos al recibir señal
cleanup() {
    echo "Deteniendo servicios..."
    kill $CONSUMER_PID $HEALTH_PID 2>/dev/null
    exit 0
}

# Configurar trap para limpieza
trap cleanup SIGTERM SIGINT

# Iniciar consumer de RabbitMQ
echo "Iniciando consumer de RabbitMQ..."
python consumer.py &
CONSUMER_PID=$!

# Iniciar servicio de health checks (opcional, solo para monitoreo)
echo "Iniciando servicio de health checks en puerto 6379..."
gunicorn --bind 0.0.0.0:6379 message:app &
HEALTH_PID=$!

# Esperar a que termine cualquiera de los procesos
wait $CONSUMER_PID $HEALTH_PID
