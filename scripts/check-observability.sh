#!/bin/bash

# Script para verificar el estado del sistema de observabilidad

echo "🔍 Verificando Sistema de Observabilidad..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar si un servicio está arriba
check_service() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    echo -n "Verificando $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" -eq "$expected_code" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response, esperado $expected_code)"
        return 1
    fi
}

# Función para verificar logs en Loki
check_loki_logs() {
    local service=$1
    echo -n "Verificando logs de $service en Loki... "
    
    query="{service=\"$service\"}"
    url="http://localhost:3100/loki/api/v1/query?query=$(echo "$query" | jq -sRr @uri)"
    
    response=$(curl -s "$url" 2>/dev/null)
    count=$(echo "$response" | jq -r '.data.result | length' 2>/dev/null)
    
    if [ "$count" -gt 0 ]; then
        echo -e "${GREEN}✓ OK${NC} ($count streams encontrados)"
        return 0
    else
        echo -e "${YELLOW}⚠ WARNING${NC} (No se encontraron logs aún)"
        return 1
    fi
}

echo "=== SERVICIOS CORE ==="
check_service "Auth Service" "http://localhost:3500/health"
check_service "Orchestrator" "http://localhost:8080/actuator/health"
check_service "RabbitMQ Management" "http://localhost:15672"

echo ""
echo "=== STACK DE OBSERVABILIDAD ==="
check_service "Loki" "http://localhost:3100/ready"
check_service "Grafana" "http://localhost:3000/api/health"
check_service "Monitor Service" "http://localhost:8085/health-check"

echo ""
echo "=== HEALTH CHECKS AVANZADOS ==="
check_service "Auth /health/ready" "http://localhost:3500/health/ready"
check_service "Auth /health/live" "http://localhost:3500/health/live"

echo ""
echo "=== MONITOR - SERVICIOS REGISTRADOS ==="
monitor_health=$(curl -s "http://localhost:8085/health" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "$monitor_health" | jq -r '.services | to_entries[] | "\(.key): uptime \(.value.uptime * 100 | floor)%"' 2>/dev/null || echo "Error parseando respuesta"
else
    echo -e "${RED}✗ No se pudo conectar al monitor${NC}"
fi

echo ""
echo "=== LOGS EN LOKI ==="
sleep 2  # Esperar un poco para que los logs lleguen
check_loki_logs "auth"
check_loki_logs "monitor"

echo ""
echo "=== RESUMEN ==="
echo "Para ver logs en Grafana:"
echo "  1. Abre http://localhost:3000"
echo "  2. Login: admin / admin"
echo "  3. Ve a Explore → Loki"
echo "  4. Query: {service=\"auth\"} | json"
echo ""
echo "Para ver el monitor:"
echo "  curl http://localhost:8085/health | jq"
echo ""
echo "Para registrar un servicio en el monitor:"
echo "  curl -X POST http://localhost:8085/register -H 'Content-Type: application/json' -d '{\"name\":\"test\",\"endpoint\":\"http://test:8080/health\"}'"
echo ""
