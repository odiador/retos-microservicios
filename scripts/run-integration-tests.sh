#!/bin/bash

# Script E2E de Testing - Mejor Práctica
# Este script reemplaza al testing-service y se ejecuta solo en CI/CD

echo "🧪 Ejecutando tests E2E del sistema de microservicios..."
echo "=========================================================="
echo ""
echo "� NOTA: Este script reemplaza al testing-service (removed)"
echo "   - No hay servicio de testing en producción"
echo "   - Tests se ejecutan desde CI/CD scripts"
echo "   - Más seguro y menos complejidad"
echo ""

# Delegar a e2e-tests.sh
exec "$(dirname "$0")/e2e-tests.sh"