# Implementación de Webhooks - Resumen

## ¿Qué se agregó?

Se ha implementado un sistema completo de webhooks para el microservicio de autenticación, permitiendo que aplicaciones externas reciban notificaciones en tiempo real sobre eventos del sistema.

## Componentes Implementados

### 1. Base de Datos

**Archivos:**
- `db/025_webhooks.sql` - Tablas para webhooks y entregas
- `db/035_webhooks_indexes.sql` - Índices para optimización

**Tablas creadas:**
- `webhooks` - Configuración de webhooks (URL, eventos, secret, etc.)
- `webhook_deliveries` - Historial de entregas con estado y errores

### 2. Lógica de Negocio

**Archivo:** `auth/utils/webhook.js`

**Funcionalidades:**
- ✅ Envío HTTP POST a URLs registradas
- ✅ Generación de firma HMAC SHA-256
- ✅ Reintentos automáticos (3 intentos con delays)
- ✅ Registro de entregas exitosas y fallidas
- ✅ CRUD completo de webhooks
- ✅ Consulta de historial de entregas

### 3. API REST

**Archivo:** `auth/routes/webhooks.js`

**Endpoints implementados:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /webhooks | Crear nuevo webhook |
| GET | /webhooks | Listar webhooks del usuario |
| GET | /webhooks/:id | Obtener webhook específico |
| PATCH | /webhooks/:id | Actualizar webhook |
| DELETE | /webhooks/:id | Eliminar webhook |
| GET | /webhooks/:id/deliveries | Ver historial de entregas |

### 4. Integración con Eventos

**Archivo modificado:** `auth/events/publisher.js`

- Integrado con el sistema existente de eventos RabbitMQ
- Cada evento publicado también dispara webhooks registrados
- Procesamiento asíncrono (no bloquea la petición principal)

### 5. Rutas Registradas

**Archivo modificado:** `auth/index.js`

- Montadas las rutas de webhooks en la aplicación principal
- Tag "Webhooks" agregado a la documentación OpenAPI

**Archivo modificado:** `auth/app.js`

- Tag de webhooks agregado a la especificación OpenAPI

### 6. Documentación

**Archivos creados:**

1. **`auth/docs/WEBHOOKS.md`** (Documentación técnica completa)
   - Descripción de webhooks
   - Eventos disponibles
   - Configuración paso a paso
   - Ejemplos de implementación (Node.js, Python)
   - Formato del payload
   - Seguridad y verificación de firma
   - Sistema de reintentos
   - Buenas prácticas
   - Troubleshooting

2. **`auth/docs/WEBHOOK_GUIDE.md`** (Guía de uso)
   - Configuración rápida
   - API de webhooks
   - Ejemplos prácticos (Express, Flask, Slack, DB)
   - Testing local con ngrok
   - Troubleshooting común

3. **`auth/README.md`** (Actualizado)
   - Sección de webhooks agregada
   - Ejemplos de uso
   - Referencias a documentación

### 7. Utilidades de Testing

**Archivo:** `auth/test-webhook-receiver.mjs`

- Servidor HTTP simple para recibir webhooks
- Verificación de firma
- Logs coloridos de eventos
- Sin dependencias externas (solo Node.js nativo)
- Ejecutable: `node test-webhook-receiver.mjs`

## Eventos Disponibles

Los webhooks pueden suscribirse a los siguientes eventos:

| Evento | Descripción | Datos incluidos |
|--------|-------------|-----------------|
| `user.created` | Nuevo usuario registrado | id, username, email, phone, role |
| `user.updated` | Usuario actualizado | id, username, email |
| `user.deleted` | Usuario eliminado | id, username |
| `user.login` | Inicio de sesión | id, username, email, role, IP |
| `password.reset.requested` | Solicitud de reseteo | userId, email, token |
| `password.updated` | Contraseña cambiada | userId, username, email, phone |

## Seguridad

### Verificación de Firma

Cada webhook incluye una firma HMAC SHA-256 en el header `X-Webhook-Signature`:

```javascript
const signature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

### Headers de Seguridad

- `X-Webhook-Signature`: Firma HMAC SHA-256
- `X-Webhook-Event`: Tipo de evento
- `User-Agent`: Microservicios-Webhook/1.0

## Sistema de Reintentos

En caso de fallo, el sistema reintenta automáticamente:

1. **Intento 1**: Inmediato
2. **Intento 2**: Después de 1 segundo
3. **Intento 3**: Después de 5 segundos  
4. **Intento 4**: Después de 15 segundos

Después de 3 reintentos fallidos, el evento se registra como no entregado.

## Ejemplo de Uso Completo

### 1. Crear un webhook

```bash
curl -X POST http://localhost:3500/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Webhook",
    "url": "https://myapp.com/webhook",
    "events": ["user.created", "user.login"]
  }'
```

**Respuesta:**
```json
{
  "message": "Webhook creado exitosamente",
  "webhook": {
    "id": "uuid",
    "secret": "a1b2c3d4...",
    "url": "https://myapp.com/webhook",
    "events": ["user.created", "user.login"],
    "active": true
  }
}
```

### 2. Implementar endpoint receptor

```javascript
import http from 'http';
import crypto from 'crypto';

const SECRET = 'a1b2c3d4...'; // Del paso 1

function verifySignature(payload, signature) {
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === expected;
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const payload = JSON.parse(body);
      const signature = req.headers['x-webhook-signature'];
      
      if (!verifySignature(payload, signature)) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Invalid signature' }));
        return;
      }
      
      console.log('Evento recibido:', payload.event, payload.data);
      
      res.writeHead(200);
      res.end(JSON.stringify({ received: true }));
    });
  }
}).listen(3000);
```

### 3. Recibir notificaciones

Cuando un usuario se registre o inicie sesión, tu endpoint recibirá:

```json
{
  "event": "user.created",
  "data": {
    "id": "uuid",
    "username": "john",
    "email": "john@example.com",
    "phone": "+1234567890",
    "role": "user"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "webhook_id": "uuid"
}
```

## Testing

### Opción 1: Usar el servidor de prueba incluido

```bash
# Terminal 1: Receptor de webhooks
cd auth
node test-webhook-receiver.mjs

# Terminal 2: Servidor de auth
npm start

# Terminal 3: Crear webhook y probar
curl -X POST http://localhost:3500/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Test",
    "url": "http://localhost:3001/webhook",
    "events": ["user.created"]
  }'
```

### Opción 2: Usar webhook.site

1. Ir a https://webhook.site
2. Copiar la URL única
3. Crear webhook con esa URL
4. Ver peticiones en tiempo real en el sitio

### Opción 3: Usar ngrok para testing local

```bash
# Exponer servidor local
ngrok http 3000

# Usar URL de ngrok en el webhook
# https://abc123.ngrok.io/webhook
```

## Archivos Modificados/Creados

### Nuevos archivos (8)
- ✅ `db/025_webhooks.sql`
- ✅ `db/035_webhooks_indexes.sql`
- ✅ `auth/utils/webhook.js`
- ✅ `auth/routes/webhooks.js`
- ✅ `auth/docs/WEBHOOKS.md`
- ✅ `auth/docs/WEBHOOK_GUIDE.md`
- ✅ `auth/test-webhook-receiver.mjs`

### Archivos modificados (4)
- ✅ `auth/events/publisher.js` (integración con webhooks)
- ✅ `auth/index.js` (montar rutas)
- ✅ `auth/app.js` (agregar tag)
- ✅ `auth/README.md` (documentación)

## Características Clave

✅ **CRUD completo** - Crear, leer, actualizar, eliminar webhooks  
✅ **Seguridad robusta** - Firma HMAC SHA-256 en cada petición  
✅ **Reintentos automáticos** - Hasta 3 intentos con delays incrementales  
✅ **Historial de entregas** - Tracking de éxitos y fallos  
✅ **Asíncrono** - No bloquea el flujo principal  
✅ **Multi-evento** - Suscripción selectiva a eventos  
✅ **Documentación completa** - Guías y ejemplos  
✅ **Testing incluido** - Servidor de prueba sin dependencias  
✅ **OpenAPI** - Documentación Swagger automática  

## Próximos Pasos Sugeridos

1. **Testing manual completo** - Probar todos los endpoints
2. **Pruebas unitarias** - Agregar tests automatizados
3. **Rate limiting** - Limitar webhooks por usuario
4. **Webhooks globales** - Para administradores
5. **Webhooks condicionales** - Filtros adicionales
6. **Métricas** - Dashboard de entregas
7. **Notificaciones** - Alertas por fallos persistentes

## Beneficios

- 🚀 **Integración en tiempo real** con sistemas externos
- 🔔 **Notificaciones automáticas** sin polling
- 🔒 **Seguro** con verificación de firma
- 📊 **Auditable** con historial completo
- 🛠️ **Fácil de usar** con documentación completa
- 🧪 **Testeable** con herramientas incluidas

## Soporte

- **Documentación técnica:** `auth/docs/WEBHOOKS.md`
- **Guía de uso:** `auth/docs/WEBHOOK_GUIDE.md`  
- **README:** `auth/README.md`
- **OpenAPI:** http://localhost:3500/ui
