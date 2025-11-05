# 📊 Monitor Service - Microservicio de Monitoreo

Microservicio dedicado al monitoreo de salud de otros servicios con alertas automáticas por email.

## 🎯 Características

- ✅ **Registro dinámico** de servicios a monitorear
- ✅ **Health checks periódicos** configurables
- ✅ **Detección automática** de cambios de estado
- ✅ **Notificaciones por email** cuando un servicio cae o se recupera
- ✅ **Historial de checks** (últimos 100 por servicio)
- ✅ **Cálculo de uptime** en tiempo real
- ✅ **Auto-registro** de servicios conocidos
- ✅ **Logs estructurados** en formato JSON

## 🚀 Quick Start

### Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=tu-email@gmail.com
export SMTP_PASS=tu-contraseña-app
export ALERT_EMAILS=admin@example.com
export PORT=8085

# Iniciar servicio
npm start

# Modo desarrollo con hot-reload
npm run dev
```

### Docker

```bash
# Build
docker build -t monitor-service .

# Run
docker run -p 8085:8085 \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_USER=tu-email@gmail.com \
  -e SMTP_PASS=tu-password \
  monitor-service
```

### Docker Compose

```yaml
monitor:
  build: ./monitor
  ports:
    - "8085:8085"
  environment:
    - SMTP_HOST=${SMTP_HOST}
    - SMTP_PORT=${SMTP_PORT}
    - SMTP_USER=${SMTP_USER}
    - SMTP_PASS=${SMTP_PASS}
    - ALERT_EMAILS=${ALERT_EMAILS}
```

## 📡 API Reference

### Registrar Servicio

**Endpoint:** `POST /register`

**Request Body:**
```json
{
  "name": "auth-service",
  "endpoint": "http://auth:3500/health",
  "frequency": 30000,
  "notificationEmails": ["admin@example.com", "ops@example.com"],
  "timeout": 5000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Servicio registrado exitosamente",
  "service": {
    "name": "auth-service",
    "endpoint": "http://auth:3500/health",
    "frequency": 30000,
    "notificationEmails": ["admin@example.com"],
    "timeout": 5000,
    "registeredAt": "2025-11-05T12:00:00.000Z"
  }
}
```

**Parámetros:**
- `name` (requerido): Nombre identificador del servicio
- `endpoint` (requerido): URL del endpoint de health check
- `frequency` (opcional): Frecuencia de verificación en ms (default: 60000)
- `notificationEmails` (opcional): Array de emails para alertas
- `timeout` (opcional): Timeout en ms para el health check (default: 5000)

---

### Obtener Estado de Todos los Servicios

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "UP",
  "services": {
    "auth-service": {
      "service": "auth-service",
      "endpoint": "http://auth:3500/health",
      "lastCheck": {
        "healthy": true,
        "status": 200,
        "duration": 45,
        "timestamp": "2025-11-05T12:05:00.000Z"
      },
      "checksCount": 120,
      "uptime": 0.991
    },
    "orchestrator": {
      "service": "orchestrator",
      "endpoint": "http://orchestrator:8080/actuator/health",
      "lastCheck": {
        "healthy": true,
        "status": 200,
        "duration": 67,
        "timestamp": "2025-11-05T12:05:00.000Z"
      },
      "checksCount": 118,
      "uptime": 1.0
    }
  },
  "timestamp": "2025-11-05T12:05:01.000Z"
}
```

**Información devuelta:**
- `lastCheck`: Resultado del último health check
- `checksCount`: Número total de checks realizados
- `uptime`: Porcentaje de checks exitosos (0.0 - 1.0)

---

### Obtener Estado de un Servicio Específico

**Endpoint:** `GET /health/:service`

**Ejemplo:** `GET /health/auth-service`

**Response:**
```json
{
  "service": "auth-service",
  "endpoint": "http://auth:3500/health",
  "lastCheck": {
    "healthy": true,
    "status": 200,
    "duration": 45,
    "body": {
      "status": "UP",
      "check": [...]
    },
    "timestamp": "2025-11-05T12:05:00.000Z"
  },
  "history": [
    {
      "healthy": true,
      "status": 200,
      "duration": 43,
      "timestamp": "2025-11-05T12:04:30.000Z"
    },
    ...
  ],
  "checksCount": 120,
  "uptime": 0.991,
  "timestamp": "2025-11-05T12:05:01.000Z"
}
```

**Incluye:**
- Último check con body completo de la respuesta
- Historial de últimos 10 checks
- Estadísticas de uptime

---

### Eliminar Servicio del Monitoreo

**Endpoint:** `DELETE /register/:service`

**Ejemplo:** `DELETE /register/auth-service`

**Response:**
```json
{
  "success": true,
  "message": "Servicio eliminado exitosamente"
}
```

---

### Health Check del Monitor

**Endpoint:** `GET /health-check`

**Response:**
```json
{
  "status": "UP",
  "check": [
    {
      "name": "Readiness check",
      "status": "UP",
      "data": {
        "from": "2025-11-05T12:00:00.000Z",
        "status": "READY"
      }
    },
    {
      "name": "Liveness check",
      "status": "UP",
      "data": {
        "from": "2025-11-05T12:00:00.000Z",
        "status": "ALIVE"
      }
    }
  ]
}
```

## 🔔 Notificaciones por Email

### Configuración SMTP

El servicio requiere las siguientes variables de entorno para enviar emails:

```bash
SMTP_HOST=smtp.gmail.com        # Servidor SMTP
SMTP_PORT=587                   # Puerto (587 para TLS)
SMTP_USER=tu-email@gmail.com    # Usuario SMTP
SMTP_PASS=tu-app-password       # Contraseña de aplicación
ALERT_EMAILS=admin1@example.com,admin2@example.com  # Emails globales
```

### Gmail App Password

Si usas Gmail, necesitas una **App Password**:

1. Ir a https://myaccount.google.com/security
2. Habilitar "2-Step Verification"
3. Ir a "App passwords"
4. Generar password para "Mail"
5. Usar ese password en `SMTP_PASS`

### Tipos de Alertas

**Alerta de Caída:**
```
🚨 Alerta: auth-service está caído

Estado: ❌ CAÍDO
Endpoint: http://auth:3500/health
Timestamp: 2025-11-05T12:05:00.000Z
Duración: 5003ms
Error: Connection timeout
```

**Alerta de Recuperación:**
```
🚨 Alerta: auth-service está recuperado

Estado: ✅ RECUPERADO
Endpoint: http://auth:3500/health
Timestamp: 2025-11-05T12:06:00.000Z
Duración: 45ms
```

## 🔄 Auto-registro de Servicios

Al iniciar, el monitor auto-registra estos servicios conocidos:

```javascript
{
  name: 'auth',
  endpoint: 'http://auth:3500/health',
  frequency: 30000,
  notificationEmails: process.env.ALERT_EMAILS?.split(',') || []
},
{
  name: 'orchestrator',
  endpoint: 'http://orchestrator:8080/actuator/health',
  frequency: 30000,
  notificationEmails: process.env.ALERT_EMAILS?.split(',') || []
}
```

Puedes modificar esta lista en `index.js` en la función `autoRegisterServices()`.

## 📊 Logs Estructurados

Todos los logs están en formato JSON:

```json
{
  "timestamp": "2025-11-05T12:00:00.000Z",
  "level": "INFO",
  "service": "monitor",
  "host": "retos-monitor",
  "logger": "monitor",
  "message": "Monitor service started",
  "payload": {
    "port": 8085
  }
}
```

**Niveles de log:**
- `INFO`: Eventos normales (inicio, registro, checks exitosos)
- `WARN`: Cambios de estado de servicios
- `ERROR`: Errores en checks, envío de emails, etc.

## 🧪 Testing

### Pruebas Manuales

```bash
# 1. Registrar un servicio
curl -X POST http://localhost:8085/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-service",
    "endpoint": "http://auth:3500/health",
    "frequency": 10000,
    "notificationEmails": ["test@example.com"]
  }'

# 2. Ver estado
curl http://localhost:8085/health | jq

# 3. Ver detalles del servicio
curl http://localhost:8085/health/test-service | jq

# 4. Esperar algunos checks (30-60 segundos)
sleep 60

# 5. Ver historial actualizado
curl http://localhost:8085/health/test-service | jq '.history'

# 6. Eliminar servicio
curl -X DELETE http://localhost:8085/register/test-service
```

### Tests BDD

Archivo: `/tests/feature/monitor.feature`

```gherkin
Escenario: Registrar un microservicio para monitoreo
  Dado que el servicio de monitoreo está activo
  Cuando registro un nuevo servicio con nombre "test-service"
  Entonces el servicio debe ser registrado exitosamente
  Y debe aparecer en la lista de servicios monitoreados
```

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│              Monitor Service (Port 8085)             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │         REST API (Hono Framework)          │    │
│  ├────────────────────────────────────────────┤    │
│  │ POST   /register                           │    │
│  │ GET    /health                             │    │
│  │ GET    /health/:service                    │    │
│  │ DELETE /register/:service                  │    │
│  │ GET    /health-check                       │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │    Cron Job (every 30 seconds)             │    │
│  ├────────────────────────────────────────────┤    │
│  │ for each registered service:               │    │
│  │   1. Fetch health endpoint                 │    │
│  │   2. Store result in history               │    │
│  │   3. Detect status changes                 │    │
│  │   4. Send email if status changed          │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │           Data Storage (In-Memory)         │    │
│  ├────────────────────────────────────────────┤    │
│  │ services: Map<name, serviceConfig>         │    │
│  │ healthHistory: Map<name, checkResults[]>   │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │        Email Alerter (Nodemailer)          │    │
│  ├────────────────────────────────────────────┤    │
│  │ SMTP Configuration                         │    │
│  │ Alert Templates                            │    │
│  │ Send on: UP → DOWN or DOWN → UP           │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## 📈 Métricas y Estadísticas

Para cada servicio monitoreado se calcula:

- **Uptime**: `checks_exitosos / total_checks`
- **Last Check Duration**: Tiempo de respuesta del último check
- **Health Status**: UP/DOWN basado en HTTP status y timeout
- **History**: Últimos 100 checks almacenados

Ejemplo de cálculo de uptime:
```
Total checks: 120
Checks exitosos: 119
Uptime: 119/120 = 0.991 = 99.1%
```

## 🔒 Seguridad

- **No autenticación**: El servicio es interno, no debe exponerse públicamente
- **SMTP credentials**: Usar variables de entorno, nunca hardcodear
- **Rate limiting**: Considerar agregar si se expone públicamente
- **CORS**: No configurado por defecto (servicio interno)

## 🐛 Troubleshooting

### El servicio no inicia

```bash
# Ver logs
docker compose logs monitor

# Verificar variables de entorno
docker compose exec monitor env | grep -E "SMTP|PORT"
```

### No se envían emails

```bash
# Verificar configuración SMTP
docker compose logs monitor | grep -i smtp

# Probar manualmente la conexión SMTP
npm install -g nodemailer
```

### Health checks fallan

```bash
# Verificar conectividad
docker compose exec monitor ping auth

# Verificar DNS
docker compose exec monitor nslookup auth

# Verificar endpoint manualmente
docker compose exec monitor wget -O- http://auth:3500/health
```

### Uptime incorrecto

El uptime se calcula desde el inicio del monitor. Si reinicias el monitor, el uptime se resetea. Esto es esperado ya que el storage es in-memory.

Para persistencia, considera agregar:
- Redis para storage distribuido
- Base de datos para histórico a largo plazo

## 🚀 Próximas Mejoras

- [ ] Persistencia en base de datos
- [ ] Webhooks además de email
- [ ] Dashboard web embebido
- [ ] Métricas Prometheus
- [ ] Alertas basadas en umbrales de uptime
- [ ] Integración con Slack/Teams
- [ ] Autenticación JWT
- [ ] Rate limiting por IP

## 📚 Dependencias

```json
{
  "@hono/node-server": "^1.13.7",  // Framework web ligero
  "hono": "^4.6.14",               // Core framework
  "node-cron": "^3.0.3",           // Job scheduling
  "nodemailer": "^6.9.16"          // Email sending
}
```

## 📄 Licencia

MIT

## 👥 Contribuciones

Este servicio es parte del proyecto de microservicios para el curso de arquitectura de software.

---

**Mantenedor**: Sistema de Microservicios - Retos  
**Versión**: 1.0.0  
**Última actualización**: 5 de Noviembre de 2025
