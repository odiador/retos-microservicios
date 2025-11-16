# Guía de Uso de Webhooks

Esta guía demuestra cómo agregar y utilizar webhooks en el sistema de microservicios.

## Contenido

1. [¿Qué son los webhooks?](#qué-son-los-webhooks)
2. [Configuración rápida](#configuración-rápida)
3. [API de Webhooks](#api-de-webhooks)
4. [Ejemplos prácticos](#ejemplos-prácticos)
5. [Verificación de seguridad](#verificación-de-seguridad)

## ¿Qué son los webhooks?

Los webhooks permiten recibir notificaciones HTTP en tiempo real cuando ocurren eventos en el sistema. En lugar de hacer polling constante, tu aplicación se suscribe a eventos específicos y recibe una petición HTTP POST cuando ocurren.

## Configuración Rápida

### Paso 1: Iniciar el servidor de prueba

```bash
cd auth
node test-webhook-receiver.mjs
```

Este servidor escucha en `http://localhost:3001/webhook` y muestra todos los webhooks recibidos.

### Paso 2: Iniciar el servidor de autenticación

```bash
cd auth
npm start
```

### Paso 3: Obtener un token de acceso

Primero, registra un usuario:

```bash
curl -X POST http://localhost:3500/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+1234567890"
  }'
```

Guarda el `access_token` de la respuesta.

### Paso 4: Crear un webhook

```bash
curl -X POST http://localhost:3500/webhooks \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi primer webhook",
    "url": "http://localhost:3001/webhook",
    "events": ["user.created", "user.login", "user.updated"]
  }'
```

La respuesta incluirá un `secret` - **guárdalo**.

### Paso 5: Configurar el secret en el receptor

```bash
curl -X POST http://localhost:3001/configure \
  -H "Content-Type: application/json" \
  -d '{"secret": "EL_SECRET_QUE_RECIBISTE"}'
```

### Paso 6: ¡Probar!

Ahora, cada vez que ocurra un evento suscrito, verás la notificación en la consola del servidor de prueba.

Prueba iniciando sesión:

```bash
curl -X POST http://localhost:3500/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "password123"
  }'
```

Deberías ver el webhook `user.login` en la consola del receptor.

## API de Webhooks

### Crear webhook

**POST /webhooks**

```bash
curl -X POST http://localhost:3500/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Webhook",
    "url": "https://myapp.com/webhooks",
    "events": ["user.created", "user.login"]
  }'
```

**Eventos disponibles:**
- `user.created` - Usuario registrado
- `user.updated` - Usuario actualizado
- `user.deleted` - Usuario eliminado
- `user.login` - Inicio de sesión
- `password.reset.requested` - Solicitud de reseteo de contraseña
- `password.updated` - Contraseña actualizada

### Listar webhooks

**GET /webhooks**

```bash
curl http://localhost:3500/webhooks \
  -H "Authorization: Bearer TOKEN"
```

### Obtener webhook

**GET /webhooks/:id**

```bash
curl http://localhost:3500/webhooks/{WEBHOOK_ID} \
  -H "Authorization: Bearer TOKEN"
```

### Actualizar webhook

**PATCH /webhooks/:id**

```bash
curl -X PATCH http://localhost:3500/webhooks/{WEBHOOK_ID} \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "active": false
  }'
```

Puedes actualizar: `name`, `url`, `events`, `active`

### Eliminar webhook

**DELETE /webhooks/:id**

```bash
curl -X DELETE http://localhost:3500/webhooks/{WEBHOOK_ID} \
  -H "Authorization: Bearer TOKEN"
```

### Ver historial de entregas

**GET /webhooks/:id/deliveries**

```bash
curl http://localhost:3500/webhooks/{WEBHOOK_ID}/deliveries?limit=20 \
  -H "Authorization: Bearer TOKEN"
```

## Ejemplos Prácticos

### Ejemplo 1: Node.js con Express

```javascript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = 'tu_secret_aqui';

function verifySignature(payload, signature) {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === expected;
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const event = req.headers['x-webhook-event'];
  
  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  console.log(`Evento recibido: ${event}`, req.body);
  
  // Procesar de forma asíncrona
  processWebhook(event, req.body).catch(console.error);
  
  // Responder inmediatamente
  res.json({ received: true });
});

async function processWebhook(event, data) {
  switch (event) {
    case 'user.created':
      await sendWelcomeEmail(data.data.email);
      break;
    case 'user.login':
      await logUserActivity(data.data.id, 'login');
      break;
  }
}

app.listen(3000);
```

### Ejemplo 2: Python con Flask

```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)
WEBHOOK_SECRET = 'tu_secret_aqui'

def verify_signature(payload, signature):
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    event = request.headers.get('X-Webhook-Event')
    payload = request.get_json()
    
    if not verify_signature(payload, signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    print(f'Event: {event}', payload)
    
    # Procesar evento
    if event == 'user.created':
        send_welcome_email(payload['data']['email'])
    
    return jsonify({'received': True})

if __name__ == '__main__':
    app.run(port=3000)
```

### Ejemplo 3: Integración con Slack

```javascript
app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'user.created') {
    await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🎉 Nuevo usuario registrado: ${data.username} (${data.email})`
      })
    });
  }
  
  res.json({ received: true });
});
```

### Ejemplo 4: Guardar en base de datos

```javascript
app.post('/webhook', async (req, res) => {
  const { event, data, timestamp } = req.body;
  
  // Guardar evento en tu base de datos
  await db.webhookEvents.create({
    eventType: event,
    eventData: data,
    receivedAt: new Date(timestamp)
  });
  
  res.json({ received: true });
});
```

## Verificación de Seguridad

### ¿Por qué verificar la firma?

La firma garantiza que:
1. La petición proviene realmente de tu sistema
2. El payload no ha sido modificado
3. No es un ataque de replay

### Cómo funciona

1. El sistema genera una firma HMAC SHA-256 del payload usando tu secret
2. La firma se envía en el header `X-Webhook-Signature`
3. Tu servidor calcula la firma esperada con el mismo método
4. Si coinciden, la petición es auténtica

### Implementación segura

```javascript
function verifySignature(payload, receivedSignature, secret) {
  // Importante: usar el payload JSON exacto
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  // Usar compare_digest para evitar timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
}
```

## Reintentos

Si tu endpoint falla, el sistema reintentará:
- **Intento 1**: Inmediato
- **Intento 2**: Después de 1 segundo
- **Intento 3**: Después de 5 segundos
- **Intento 4**: Después de 15 segundos

Después de 3 reintentos fallidos, el evento se marca como no entregado.

## Buenas Prácticas

1. **Responde rápido**: Responde con 200 inmediatamente, procesa después
2. **Sé idempotente**: Prepárate para recibir duplicados
3. **Valida siempre**: Verifica la firma en cada petición
4. **Usa HTTPS**: En producción, solo acepta HTTPS
5. **Registra todo**: Mantén logs de eventos recibidos
6. **Maneja errores**: Implementa manejo robusto de errores
7. **Monitorea**: Vigila el historial de entregas

## Testing Local

### Usando ngrok

```bash
# Instalar ngrok
npm install -g ngrok

# Exponer tu servidor local
ngrok http 3000

# Usar la URL de ngrok en tu webhook
# Ejemplo: https://abc123.ngrok.io/webhook
```

### Usando webhook.site

1. Ve a https://webhook.site
2. Copia la URL única que te dan
3. Úsala en tu webhook para inspeccionar las peticiones

## Troubleshooting

### El webhook no se dispara

- ✅ Verifica que el webhook esté activo
- ✅ Confirma que el evento está en la lista de eventos suscritos
- ✅ Revisa los logs del servidor

### Error 401 en la firma

- ✅ Usa el secret correcto
- ✅ Verifica el payload exacto (sin modificar)
- ✅ Asegúrate de usar HMAC SHA-256

### Timeout

- ✅ Responde en menos de 10 segundos
- ✅ Procesa de forma asíncrona
- ✅ Verifica que tu servidor esté accesible

## Soporte

Para más información:
- Documentación completa: [auth/docs/WEBHOOKS.md](./WEBHOOKS.md)
- API Reference: http://localhost:3500/ui
- Ejemplos: Ver `test-webhook-receiver.mjs`
