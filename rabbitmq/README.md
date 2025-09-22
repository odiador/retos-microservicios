# RabbitMQ Configuration

Esta carpeta contiene la configuración de RabbitMQ para el sistema de microservicios, incluyendo configuración dinámica mediante variables de entorno.

## Archivos

- `rabbitmq.conf`: Configuración básica de RabbitMQ
- `definitions.template.json`: Template para generar `definitions.json` con variables de entorno
- `definitions.json`: Archivo generado dinámicamente (no versionar)
- `generate-definitions.sh`: Script que genera `definitions.json` desde el template
- `Dockerfile`: Dockerfile personalizado para RabbitMQ con configuración dinámica

## Variables de Entorno

El sistema usa las siguientes variables de entorno para configurar RabbitMQ dinámicamente:

### Credenciales
- `RABBITMQ_USER`: Usuario administrador (default: admin)
- `RABBITMQ_PASSWORD`: Contraseña del usuario (default: securepass)
- `RABBITMQ_VHOST`: Virtual host (default: /)

### Exchanges y Queues
- `AUTH_EVENTS_EXCHANGE`: Nombre del exchange de eventos de autenticación (default: auth.events)
- `ORCHESTRATOR_QUEUE`: Cola del orquestador (default: orchestrator.queue)
- `MESSAGING_EMAIL_QUEUE`: Cola de mensajería email (default: messaging.email.queue)
- `MESSAGING_SMS_QUEUE`: Cola de mensajería SMS (default: messaging.sms.queue)
- `AUTH_AUDIT_QUEUE`: Cola de auditoría de auth (default: auth.audit.queue)

### Routing Keys
- `USER_ROUTING_KEY`: Routing key para eventos de usuario (default: user.*)
- `PASSWORD_ROUTING_KEY`: Routing key para eventos de contraseña (default: password.*)
- `SEND_EMAIL_ROUTING_KEY`: Routing key para envío de emails (default: send.email)
- `SEND_SMS_ROUTING_KEY`: Routing key para envío de SMS (default: send.sms)

## Cómo Funciona

1. **Template**: `definitions.template.json` contiene placeholders como `${RABBITMQ_USER}`
2. **Script**: `generate-definitions.sh` carga las variables de entorno y usa `envsubst` para reemplazar los placeholders
3. **Docker**: El `Dockerfile` instala `envsubst` y configura el script como entrypoint
4. **Resultado**: Se genera `definitions.json` con los valores reales antes de iniciar RabbitMQ

## Uso

Para usar esta configuración:

1. Asegúrate de que las variables de entorno estén definidas en `.env`
2. Ejecuta `docker-compose up rabbitmq` - el contenedor generará automáticamente `definitions.json`
3. RabbitMQ se iniciará con la configuración personalizada

## Testing

Para probar la generación manualmente:

```bash
cd rabbitmq
# Cargar variables de entorno
export $(cat ../.env | xargs)
# Generar definitions.json
./generate-definitions.sh --dry-run
```

El script validará que todas las variables requeridas estén presentes antes de generar el archivo.

## Flujo de Mensajería

1. **Auth Service** publica eventos en `auth.events` con routing keys específicas
2. **Orchestrator** consume de `orchestrator.queue`, aplica lógica de negocio y republica eventos de messaging
3. **Messaging Service** consume de `messaging.email.queue` y `messaging.sms.queue` para enviar notificaciones
4. **Auth Consumer** consume de `auth.audit.queue` para auditoría y logging

## Management UI
Accede a la interfaz web en: http://localhost:15672

## Comandos Útiles

### Ver estado de RabbitMQ
```bash
docker exec retos-rabbitmq rabbitmq-diagnostics status
```

### Ver colas
```bash
docker exec retos-rabbitmq rabbitmqctl list_queues
```

### Ver exchanges
```bash
docker exec retos-rabbitmq rabbitmqctl list_exchanges
```

### Ver bindings
```bash
docker exec retos-rabbitmq rabbitmqctl list_bindings
```
