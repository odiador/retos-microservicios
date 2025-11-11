# SMS Notification Service

Microservicio para envío de notificaciones SMS mediante procesamiento de eventos del bus de mensajes.

## 🏗️ Arquitectura

### Componentes
- **`consumer.py`**: Consumer RabbitMQ que procesa eventos de envío de SMS
- **`message.py`**: Servicio de health checks (solo monitoreo)
- **`test_sms.py`**: Utilidad para testing manual
- **`test_consumer.py`**: Suite de tests unitarios

### Principios de Diseño
- ✅ **Event-Driven**: Solo procesa eventos del bus, no expone APIs REST públicas
- ✅ **Single Responsibility**: Consumer solo procesa SMS, health checks solo monitorean
- ✅ **Security First**: No endpoints REST expuestos en producción
- ✅ **Observable**: Logs estructurados JSON para Loki/Grafana

## 📨 Formato de Eventos

Los eventos se reciben vía RabbitMQ con el siguiente formato JSON:

```json
{
  "recipient": "+573001234567",
  "message": "Contenido del SMS",
  "type": "notification"
}
```

## 🔍 Health Checks

### Endpoints Disponibles
- `GET /health` - Health check completo
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Ejemplo de Respuesta
```json
{
  "status": "UP",
  "checks": [
    {
      "name": "Readiness check",
      "status": "UP",
      "data": {
        "status": "READY",
        "version": "1.0.0"
      }
    }
  ]
}
```

## 🚀 Ejecución

### Desarrollo
```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar consumer + health checks
./start.sh
```

### Docker
```bash
# Construir imagen
docker build -t retos-sms .

# Ejecutar contenedor
docker run -p 6379:6379 retos-sms
```

### Docker Compose
```bash
# Desde raíz del proyecto
docker compose up notifications
```

## 🧪 Testing

### Testing Integrado
```bash
# Ejecutar tests unitarios
python -m pytest test_consumer.py -v

# Ejecutar con cobertura
python -m pytest test_consumer.py --cov=consumer --cov-report=html

# Enviar mensaje de prueba
python test_sms.py "+573001234567" "Mensaje de prueba"
```

### Testing como Microservicio (Recomendado)
Para entornos de producción, se recomienda implementar testing como microservicio separado:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   sms-testing   │───▶│   RabbitMQ Bus   │───▶│   sms-consumer  │
│ (pytest + API)  │    │                  │    │ (producción)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📊 Monitoreo y Observabilidad

### Logs Estructurados
Todos los logs siguen formato JSON para integración con Loki:

```json
{
  "timestamp": "2025-11-10T15:30:00.000Z",
  "level": "INFO",
  "service": "sms",
  "logger": "sms",
  "message": "SMS enviado exitosamente",
  "payload": {
    "to": "+573001234567",
    "sid": "SM123456789"
  }
}
```

### Métricas
- **RabbitMQ**: Conexión y procesamiento de mensajes
- **Twilio**: Estado de envío y errores
- **Sistema**: Memoria, CPU, uptime

## 🔧 Configuración

### Variables de Entorno
```bash
# RabbitMQ
RABBITMQ_URL=amqp://admin:securepass@rabbitmq:5672
AUTH_EVENTS_EXCHANGE=auth.events
SEND_SMS_ROUTING_KEY=send.sms
MESSAGING_SMS_QUEUE=messaging.sms.queue

# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Servicio
MESSAGING_PORT=6379
```

## 📋 Checklist de Seguridad

- ✅ No APIs REST públicas expuestas
- ✅ Validación de entrada de datos
- ✅ Manejo seguro de credenciales Twilio
- ✅ Logs no contienen información sensible
- ✅ Health checks no revelan estado interno crítico

## 🎯 Recomendaciones de Producción

1. **Testing**: Implementar como microservicio separado
2. **Secrets**: Usar gestores de secretos (Vault, AWS Secrets Manager)
3. **Rate Limiting**: Implementar límites de envío por minuto/hora
4. **Circuit Breaker**: Para fallos de Twilio
5. **Monitoring**: Alertas en fallos de envío masivos