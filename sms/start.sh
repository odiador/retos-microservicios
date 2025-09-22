#!/bin/bash

# Script para iniciar tanto el servicio HTTP como el consumer de RabbitMQ

echo "Iniciando servicio SMS..."

# Función para limpiar procesos al recibir señal
cleanup() {
    echo "Deteniendo servicios..."
    kill $HTTP_PID $CONSUMER_PID 2>/dev/null
    exit 0
}

# Configurar trap para limpieza
trap cleanup SIGTERM SIGINT

# Iniciar servicio HTTP en background
echo "Iniciando servidor HTTP en puerto 6379..."
gunicorn --bind 0.0.0.0:6379 message:app &
HTTP_PID=$!

# Esperar un poco para que el servidor HTTP inicie
sleep 3

# Iniciar consumer de RabbitMQ en background
echo "Iniciando consumer de RabbitMQ..."
python consumer.py &
CONSUMER_PID=$!

# Esperar a que termine cualquiera de los procesos
wait $HTTP_PID $CONSUMER_PID
