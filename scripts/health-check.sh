#!/bin/bash

# ============================================
# Script de Verificación de Salud
# ============================================

echo "==========================================================="
echo "🏥 Verificando Salud de Todos los Servicios"
echo "==========================================================="

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    SERVICE_NAME=$1
    SERVICE_URL=$2
    CONTAINER_NAME=$3
    
    printf "Verificando %-25s " "$SERVICE_NAME..."
    
    # Verificar si el contenedor está corriendo
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${RED}❌ Contenedor no está corriendo${NC}"
        return 1
    fi
    
    # Verificar si el servicio responde
    if curl --output /dev/null --silent --head --fail --max-time 5 "$SERVICE_URL" 2>/dev/null; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  No responde${NC}"
        return 1
    fi
}

echo ""
echo "📦 Servicios de Infraestructura:"
check_service "PostgreSQL (App)" "http://localhost:5432" "retos-postgres" || true
check_service "PostgreSQL (Sonar)" "http://localhost:5432" "retos-sonar-db" || true
check_service "RabbitMQ" "http://localhost:15672" "retos-rabbitmq"

echo ""
echo "🔧 Servicios CI/CD:"
check_service "Jenkins" "http://localhost:8090/jenkins/login" "retos-jenkins"
check_service "SonarQube" "http://localhost:9000" "retos-sonarqube"

echo ""
echo "🎯 Microservicios:"
check_service "Auth Service" "http://localhost:3500/health" "retos-docker-auth-1"
check_service "Orchestrator" "http://localhost:8080/health" "retos-docker-orchestrator-1"
check_service "SMS Service" "http://localhost:6379/health" "retos-docker-notifications-1"

echo ""
echo "==========================================================="
echo "📊 Estado de Contenedores:"
echo "═══════════════════════════════════════════════════════════"
docker-compose ps

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "💾 Uso de Volúmenes:"
echo "═══════════════════════════════════════════════════════════"
docker volume ls | grep retos

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Verificación Completada"
echo "═══════════════════════════════════════════════════════════"
