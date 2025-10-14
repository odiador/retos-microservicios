#!/bin/bash

# ============================================
# Script de Inicio para Entorno CI/CD
# ============================================

set -e

echo "═══════════════════════════════════════════════════════════"
echo "🚀 Iniciando Entorno CI/CD Completo"
echo "═══════════════════════════════════════════════════════════"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Función para imprimir mensajes
# ============================================
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ============================================
# Verificar que exista .env
# ============================================
print_step "Verificando archivo .env..."
if [ ! -f .env ]; then
    print_warning "Archivo .env no encontrado, copiando desde .env.example"
    cp .env.example .env
    print_success "Archivo .env creado"
else
    print_success "Archivo .env encontrado"
fi

# ============================================
# Detener contenedores existentes
# ============================================
print_step "Deteniendo contenedores existentes..."
docker-compose down
print_success "Contenedores detenidos"

# ============================================
# FASE 1: Infraestructura Base
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📦 FASE 1: Levantando Infraestructura Base"
echo "═══════════════════════════════════════════════════════════"

print_step "Iniciando PostgreSQL..."
docker-compose up -d db sonar-db

print_step "Esperando a que PostgreSQL esté listo..."
sleep 10

print_step "Iniciando RabbitMQ..."
docker-compose up -d rabbitmq

print_step "Esperando a que RabbitMQ esté listo..."
sleep 15

print_success "Infraestructura base lista"

# ============================================
# FASE 2: Servicios CI/CD
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔧 FASE 2: Levantando Servicios CI/CD"
echo "═══════════════════════════════════════════════════════════"

print_step "Iniciando SonarQube..."
docker-compose up -d sonarqube

print_step "Esperando a que SonarQube esté listo (esto puede tomar 2-3 minutos)..."
echo "   Por favor espera..."

# Esperar a que SonarQube esté disponible
MAX_ATTEMPTS=60
ATTEMPT=0
until $(curl --output /dev/null --silent --head --fail http://localhost:9000) || [ $ATTEMPT -eq $MAX_ATTEMPTS ]; do
    printf '.'
    sleep 5
    ATTEMPT=$((ATTEMPT+1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    print_warning "SonarQube tardó más de lo esperado, pero continuaremos..."
else
    print_success "SonarQube está listo"
fi

print_step "Iniciando Jenkins..."
docker-compose up -d jenkins

print_step "Esperando a que Jenkins esté listo (esto puede tomar 2-3 minutos)..."
echo "   Por favor espera..."

# Esperar a que Jenkins esté disponible
MAX_ATTEMPTS=60
ATTEMPT=0
until $(curl --output /dev/null --silent --head --fail http://localhost:8090/jenkins/login) || [ $ATTEMPT -eq $MAX_ATTEMPTS ]; do
    printf '.'
    sleep 5
    ATTEMPT=$((ATTEMPT+1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    print_warning "Jenkins tardó más de lo esperado, pero continuaremos..."
else
    print_success "Jenkins está listo"
fi

# ============================================
# FASE 3: Microservicios
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎯 FASE 3: Levantando Microservicios"
echo "═══════════════════════════════════════════════════════════"

print_step "Iniciando Auth Service..."
docker-compose up -d auth

print_step "Iniciando Orchestrator Service..."
docker-compose up -d orchestrator

print_step "Iniciando SMS Service..."
docker-compose up -d notifications

print_success "Microservicios iniciados"

# ============================================
# Verificación Final
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔍 Verificando Estado de los Servicios"
echo "═══════════════════════════════════════════════════════════"

sleep 5

check_service() {
    SERVICE_NAME=$1
    SERVICE_URL=$2
    
    if curl --output /dev/null --silent --head --fail "$SERVICE_URL"; then
        print_success "$SERVICE_NAME está funcionando"
    else
        print_warning "$SERVICE_NAME no está respondiendo aún"
    fi
}

check_service "PostgreSQL" "http://localhost:5432" || true
check_service "RabbitMQ" "http://localhost:15672"
check_service "SonarQube" "http://localhost:9000"
check_service "Jenkins" "http://localhost:8090/jenkins/login"
check_service "Auth Service" "http://localhost:3500/health"
check_service "Orchestrator" "http://localhost:8080/health"
check_service "SMS Service" "http://localhost:6379/health"

# ============================================
# Información de Acceso
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ ¡Entorno CI/CD Iniciado Exitosamente!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 URLs de Acceso:"
echo "   🔐 Jenkins:            http://localhost:8090/jenkins"
echo "   📊 SonarQube:          http://localhost:9000"
echo "   🐰 RabbitMQ:           http://localhost:15672"
echo "   🔑 Auth Service:       http://localhost:3500"
echo "   🔔 Orchestrator:       http://localhost:8080"
echo "   📱 SMS Service:        http://localhost:6379"
echo ""
echo "🔐 Credenciales por Defecto:"
echo ""
echo "   Jenkins:"
echo "   └─ Usuario: admin"
echo "   └─ Password: admin123"
echo ""
echo "   SonarQube:"
echo "   └─ Usuario: admin"
echo "   └─ Password: admin (cambiar en primer login)"
echo ""
echo "   RabbitMQ:"
echo "   └─ Usuario: admin"
echo "   └─ Password: securepass"
echo ""
echo "📚 Documentación:"
echo "   └─ jenkins/README.md - Guía completa de Jenkins"
echo "   └─ ANALISIS_Y_PLAN_JENKINS.md - Plan de implementación"
echo ""
echo "🎯 Próximos Pasos:"
echo "   1. Acceder a Jenkins: http://localhost:8090/jenkins"
echo "   2. Esperar a que se instalen los plugins (2-3 minutos)"
echo "   3. Crear pipelines para los servicios"
echo "   4. Configurar SonarQube"
echo "   5. Ejecutar primera build"
echo ""
echo "═══════════════════════════════════════════════════════════"

# ============================================
# Ver logs (opcional)
# ============================================
echo ""
read -p "¿Deseas ver los logs de Jenkins? (s/n): " VIEW_LOGS
if [[ $VIEW_LOGS == "s" || $VIEW_LOGS == "S" ]]; then
    echo ""
    print_step "Mostrando logs de Jenkins (Ctrl+C para salir)..."
    docker logs -f retos-jenkins
fi
