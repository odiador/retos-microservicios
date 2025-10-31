# Servicio de Autenticación JWT

Servicio de autenticación basado en JWT con soporte para webhooks y eventos.

## Características

- 🔐 Autenticación JWT
- 👥 Gestión de usuarios (CRUD)
- 🔒 Recuperación de contraseña
- 🪝 **Webhooks para notificaciones en tiempo real**
- 📡 Eventos a través de RabbitMQ
- 📖 Documentación OpenAPI/Swagger

## Endpoints Principales

### Autenticación
- `POST /accounts` - Registrar nuevo usuario
- `POST /sessions` - Iniciar sesión
- `POST /codes` - Solicitar código de recuperación de contraseña

### Usuarios
- `GET /accounts/:username` - Obtener perfil de usuario
- `PATCH /accounts/:username` - Actualizar perfil
- `PUT /accounts/:username` - Cambiar contraseña
- `DELETE /accounts/:username` - Eliminar cuenta
- `GET /accounts` - Listar usuarios (solo admin)

### Webhooks
- `POST /webhooks` - Crear webhook
- `GET /webhooks` - Listar webhooks
- `GET /webhooks/:id` - Obtener webhook específico
- `PATCH /webhooks/:id` - Actualizar webhook
- `DELETE /webhooks/:id` - Eliminar webhook
- `GET /webhooks/:id/deliveries` - Ver historial de entregas

### Health & Docs
- `GET /health` - Health check
- `GET /ui` - Documentación Swagger UI
- `GET /doc` - OpenAPI spec (YAML)

## Webhooks

Los webhooks permiten recibir notificaciones HTTP en tiempo real cuando ocurren eventos:

### Eventos disponibles
- `user.created` - Usuario registrado
- `user.updated` - Usuario actualizado  
- `user.deleted` - Usuario eliminado
- `user.login` - Inicio de sesión
- `password.reset.requested` - Solicitud de reseteo
- `password.updated` - Contraseña actualizada

### Inicio rápido

```bash
# 1. Crear un webhook
curl -X POST http://localhost:3500/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Webhook",
    "url": "https://myapp.com/webhook",
    "events": ["user.created", "user.login"]
  }'

# 2. Guardar el secret de la respuesta

# 3. Implementar endpoint receptor (ver docs/WEBHOOK_GUIDE.md)
```

**Documentación completa:**
- [Guía de uso de webhooks](./docs/WEBHOOK_GUIDE.md)
- [Referencia técnica](./docs/WEBHOOKS.md)
- Servidor de prueba: `node test-webhook-receiver.mjs`

## Variables de Entorno

```bash
# Base de datos
DB_NAME=microservicios
DB_USER=postgres
DB_PASS=postgres123
DB_SCHEMA=auth

# JWT
JWT_SECRET=mi_secreto_super_seguro
TOKEN_EXP=1h

# RabbitMQ
RABBITMQ_URL=amqp://admin:securepass@rabbitmq:5672
AUTH_EVENTS_EXCHANGE=auth.events
```

## Instalación y Uso

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# El servidor estará disponible en http://localhost:3500
```

## Ejemplo de Uso

```bash
# 1. Registrar usuario
curl -X POST http://localhost:3500/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "username": "juan",
    "email": "juan@example.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+1234567890"
  }'

# 2. Iniciar sesión
curl -X POST http://localhost:3500/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "juan",
    "password": "password123"
  }'

# 3. Obtener perfil (con token)
curl http://localhost:3500/accounts/juan \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Documentación API

Accede a la documentación interactiva Swagger en:
```
http://localhost:3500/ui
```

## Testing de Webhooks

Usa el servidor de prueba incluido:

```bash
# Terminal 1: Iniciar receptor de webhooks
node test-webhook-receiver.mjs

# Terminal 2: Iniciar servidor de auth
npm start

# Terminal 3: Crear webhook y realizar pruebas
# Ver docs/WEBHOOK_GUIDE.md para ejemplos completos
```
