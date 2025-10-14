# ============================================
# Script de Inicio para Entorno CI/CD (PowerShell)
# ============================================

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🚀 Iniciando Entorno CI/CD Completo" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# ============================================
# Funciones de utilidad
# ============================================
function Print-Step {
    param([string]$Message)
    Write-Host "▶ $Message" -ForegroundColor Blue
}

function Print-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Print-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# ============================================
# Verificar que exista .env
# ============================================
Print-Step "Verificando archivo .env..."
if (-not (Test-Path ".env")) {
    Print-Warning "Archivo .env no encontrado, copiando desde .env.example"
    Copy-Item ".env.example" ".env"
    Print-Success "Archivo .env creado"
} else {
    Print-Success "Archivo .env encontrado"
}

# ============================================
# Detener contenedores existentes
# ============================================
Print-Step "Deteniendo contenedores existentes..."
docker-compose down
Print-Success "Contenedores detenidos"

# ============================================
# FASE 1: Infraestructura Base
# ============================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📦 FASE 1: Levantando Infraestructura Base" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

Print-Step "Iniciando PostgreSQL..."
docker-compose up -d db sonar-db

Print-Step "Esperando a que PostgreSQL esté listo..."
Start-Sleep -Seconds 10

Print-Step "Iniciando RabbitMQ..."
docker-compose up -d rabbitmq

Print-Step "Esperando a que RabbitMQ esté listo..."
Start-Sleep -Seconds 15

Print-Success "Infraestructura base lista"

# ============================================
# FASE 2: Servicios CI/CD
# ============================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔧 FASE 2: Levantando Servicios CI/CD" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

Print-Step "Iniciando SonarQube..."
docker-compose up -d sonarqube

Print-Step "Esperando a que SonarQube esté listo (esto puede tomar 2-3 minutos)..."
Write-Host "   Por favor espera..."

# Esperar a que SonarQube esté disponible
$maxAttempts = 60
$attempt = 0
do {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:9000" -Method Head -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            break
        }
    } catch {
        # Ignorar errores
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 5
    $attempt++
} while ($attempt -lt $maxAttempts)

Write-Host ""
if ($attempt -eq $maxAttempts) {
    Print-Warning "SonarQube tardó más de lo esperado, pero continuaremos..."
} else {
    Print-Success "SonarQube está listo"
}

Print-Step "Iniciando Jenkins..."
docker-compose up -d jenkins

Print-Step "Esperando a que Jenkins esté listo (esto puede tomar 2-3 minutos)..."
Write-Host "   Por favor espera..."

# Esperar a que Jenkins esté disponible
$attempt = 0
do {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8090/jenkins/login" -Method Head -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            break
        }
    } catch {
        # Ignorar errores
    }
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 5
    $attempt++
} while ($attempt -lt $maxAttempts)

Write-Host ""
if ($attempt -eq $maxAttempts) {
    Print-Warning "Jenkins tardó más de lo esperado, pero continuaremos..."
} else {
    Print-Success "Jenkins está listo"
}

# ============================================
# FASE 3: Microservicios
# ============================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎯 FASE 3: Levantando Microservicios" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

Print-Step "Iniciando Auth Service..."
docker-compose up -d auth

Print-Step "Iniciando Orchestrator Service..."
docker-compose up -d orchestrator

Print-Step "Iniciando SMS Service..."
docker-compose up -d notifications

Print-Success "Microservicios iniciados"

# ============================================
# Verificación Final
# ============================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🔍 Verificando Estado de los Servicios" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

Start-Sleep -Seconds 5

function Check-Service {
    param(
        [string]$ServiceName,
        [string]$ServiceUrl
    )
    
    try {
        $response = Invoke-WebRequest -Uri $ServiceUrl -Method Head -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Print-Success "$ServiceName está funcionando"
        } else {
            Print-Warning "$ServiceName no está respondiendo aún"
        }
    } catch {
        Print-Warning "$ServiceName no está respondiendo aún"
    }
}

Check-Service "RabbitMQ" "http://localhost:15672"
Check-Service "SonarQube" "http://localhost:9000"
Check-Service "Jenkins" "http://localhost:8090/jenkins/login"
Check-Service "Auth Service" "http://localhost:3500/health"
Check-Service "Orchestrator" "http://localhost:8080/health"
Check-Service "SMS Service" "http://localhost:6379/health"

# ============================================
# Información de Acceso
# ============================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ ¡Entorno CI/CD Iniciado Exitosamente!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📋 URLs de Acceso:" -ForegroundColor Cyan
Write-Host "   🔐 Jenkins:            http://localhost:8090/jenkins"
Write-Host "   📊 SonarQube:          http://localhost:9000"
Write-Host "   🐰 RabbitMQ:           http://localhost:15672"
Write-Host "   🔑 Auth Service:       http://localhost:3500"
Write-Host "   🔔 Orchestrator:       http://localhost:8080"
Write-Host "   📱 SMS Service:        http://localhost:6379"
Write-Host ""
Write-Host "🔐 Credenciales por Defecto:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Jenkins:"
Write-Host "   └─ Usuario: admin"
Write-Host "   └─ Password: admin123"
Write-Host ""
Write-Host "   SonarQube:"
Write-Host "   └─ Usuario: admin"
Write-Host "   └─ Password: admin (cambiar en primer login)"
Write-Host ""
Write-Host "   RabbitMQ:"
Write-Host "   └─ Usuario: admin"
Write-Host "   └─ Password: securepass"
Write-Host ""
Write-Host "📚 Documentación:" -ForegroundColor Cyan
Write-Host "   └─ jenkins\README.md - Guía completa de Jenkins"
Write-Host "   └─ ANALISIS_Y_PLAN_JENKINS.md - Plan de implementación"
Write-Host ""
Write-Host "🎯 Próximos Pasos:" -ForegroundColor Cyan
Write-Host "   1. Acceder a Jenkins: http://localhost:8090/jenkins"
Write-Host "   2. Esperar a que se instalen los plugins (2-3 minutos)"
Write-Host "   3. Crear pipelines para los servicios"
Write-Host "   4. Configurar SonarQube"
Write-Host "   5. Ejecutar primera build"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# ============================================
# Ver logs (opcional)
# ============================================
Write-Host ""
$viewLogs = Read-Host "¿Deseas ver los logs de Jenkins? (s/n)"
if ($viewLogs -eq "s" -or $viewLogs -eq "S") {
    Write-Host ""
    Print-Step "Mostrando logs de Jenkins (Ctrl+C para salir)..."
    docker logs -f retos-jenkins
}
