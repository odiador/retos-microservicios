# Webhooks

## ¿Qué son los webhooks?

Los webhooks permiten que aplicaciones externas reciban notificaciones en tiempo real cuando ocurren eventos en el sistema. En lugar de hacer polling constante a la API, tu aplicación puede registrar una URL donde recibirá notificaciones automáticas cuando ocurran eventos específicos.

## Eventos disponibles

El sistema de autenticación emite los siguientes eventos:

- `user.created` - Cuando se registra un nuevo usuario
- `user.updated` - Cuando se actualiza información de un usuario
- `user.deleted` - Cuando se elimina una cuenta de usuario
- `user.login` - Cuando un usuario inicia sesión
- `password.reset.requested` - Cuando se solicita recuperación de contraseña
- `password.updated` - Cuando se cambia una contraseña

## Configuración de webhooks

### 1. Crear un webhook

Para crear un webhook, haz una petición POST a `/webhooks`:

```bash
curl -X POST http://localhost:3500/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi Webhook de Producción",
    "url": "https://mi-app.com/webhook/receiver",
    "events": ["user.created", "user.login"]
  }'
```

Respuesta:
```json
{
  "message": "Webhook creado exitosamente",
  "webhook": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Mi Webhook de Producción",
    "url": "https://mi-app.com/webhook/receiver",
    "events": ["user.created", "user.login"],
    "secret": "a1b2c3d4e5f6...",
    "active": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Importante:** Guarda el `secret` devuelto. Lo necesitarás para verificar la autenticidad de las peticiones.

### 2. Listar webhooks

```bash
curl http://localhost:3500/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Obtener un webhook específico

```bash
curl http://localhost:3500/webhooks/{webhook_id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Actualizar un webhook

```bash
curl -X PATCH http://localhost:3500/webhooks/{webhook_id} \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://nueva-url.com/webhook",
    "events": ["user.created", "user.updated", "user.deleted"],
    "active": true
  }'
```

### 5. Eliminar un webhook

```bash
curl -X DELETE http://localhost:3500/webhooks/{webhook_id} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Ver entregas de un webhook

Consulta el historial de entregas para debugging:

```bash
curl http://localhost:3500/webhooks/{webhook_id}/deliveries?limit=20 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Implementación del endpoint receptor

Tu aplicación debe exponer un endpoint HTTP que acepte peticiones POST. Aquí hay ejemplos de implementación:

### Node.js + Express

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = 'a1b2c3d4e5f6...'; // El secret que recibiste al crear el webhook

function verifySignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

app.post('/webhook/receiver', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const eventType = req.headers['x-webhook-event'];
  
  // Verificar la firma
  if (!verifySignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  console.log(`Received event: ${eventType}`, req.body);
  
  // Procesar el evento
  switch (eventType) {
    case 'user.created':
      // Lógica para nuevo usuario
      console.log('New user:', req.body.data);
      break;
    case 'user.login':
      // Lógica para login
      console.log('User login:', req.body.data);
      break;
    // ... otros eventos
  }
  
  // Responder rápidamente (200-299)
  res.status(200).json({ received: true });
});

app.listen(3000, () => console.log('Webhook receiver listening on port 3000'));
```

### Python + Flask

```python
from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)

WEBHOOK_SECRET = 'a1b2c3d4e5f6...'  # El secret que recibiste al crear el webhook

def verify_signature(payload, signature):
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhook/receiver', methods=['POST'])
def webhook_receiver():
    signature = request.headers.get('X-Webhook-Signature')
    event_type = request.headers.get('X-Webhook-Event')
    payload = request.get_json()
    
    # Verificar la firma
    if not verify_signature(payload, signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    print(f'Received event: {event_type}', payload)
    
    # Procesar el evento
    if event_type == 'user.created':
        print('New user:', payload['data'])
    elif event_type == 'user.login':
        print('User login:', payload['data'])
    
    # Responder rápidamente
    return jsonify({'received': True}), 200

if __name__ == '__main__':
    app.run(port=3000)
```

## Formato del payload

Todas las peticiones webhook incluyen:

```json
{
  "event": "user.created",
  "data": {
    "id": "user-uuid",
    "username": "johndoe",
    "email": "john@example.com",
    ...
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "webhook_id": "webhook-uuid"
}
```

### Headers de las peticiones

- `Content-Type`: `application/json`
- `X-Webhook-Signature`: Firma HMAC SHA-256 del payload
- `X-Webhook-Event`: Tipo de evento (ej: `user.created`)
- `User-Agent`: `Microservicios-Webhook/1.0`

## Seguridad

### Verificación de firma

**SIEMPRE** verifica la firma del webhook usando el secret proporcionado:

```javascript
const crypto = require('crypto');

function verifySignature(payload, receivedSignature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return receivedSignature === expectedSignature;
}
```

### Buenas prácticas

1. **Responde rápido**: Responde con 200-299 inmediatamente y procesa el evento de forma asíncrona
2. **Verifica la firma**: Siempre valida que la petición proviene del sistema
3. **Idempotencia**: Prepárate para recibir el mismo evento múltiples veces
4. **Logging**: Registra todos los eventos recibidos para debugging
5. **HTTPS**: Usa siempre URLs HTTPS en producción
6. **Timeouts**: El sistema espera 10 segundos, responde antes de ese tiempo

## Reintentos

Si tu endpoint falla o no responde:

- **Reintento 1**: Después de 1 segundo
- **Reintento 2**: Después de 5 segundos
- **Reintento 3**: Después de 15 segundos

Después de 3 intentos fallidos, el evento se marca como no entregado. Puedes consultar el historial de entregas para ver qué falló.

## Testing local

Para probar webhooks localmente, puedes usar herramientas como:

- **ngrok**: Expone tu servidor local a internet
  ```bash
  ngrok http 3000
  # Usa la URL de ngrok en tu webhook: https://abc123.ngrok.io/webhook/receiver
  ```

- **webhook.site**: Servicio online para inspeccionar webhooks
  ```
  https://webhook.site
  ```

## Ejemplos de uso

### Sincronizar usuarios con otro sistema

```javascript
app.post('/webhook/receiver', async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'user.created') {
    // Crear usuario en tu CRM
    await crm.createContact({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName
    });
  }
  
  res.json({ received: true });
});
```

### Enviar notificaciones

```javascript
app.post('/webhook/receiver', async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'user.login') {
    // Enviar notificación de seguridad
    await sendEmail({
      to: data.email,
      subject: 'Nuevo inicio de sesión',
      body: `Se detectó un inicio de sesión desde ${data.meta.ip}`
    });
  }
  
  res.json({ received: true });
});
```

### Analytics y métricas

```javascript
app.post('/webhook/receiver', async (req, res) => {
  const { event, data } = req.body;
  
  // Enviar a sistema de analytics
  await analytics.track({
    event: event,
    userId: data.id,
    properties: data
  });
  
  res.json({ received: true });
});
```

## Troubleshooting

### El webhook no se dispara

- Verifica que el webhook esté activo (`active: true`)
- Confirma que el evento está en la lista de eventos suscritos
- Revisa los logs del servidor de autenticación

### Fallo en la entrega

- Verifica que tu endpoint esté accesible públicamente
- Asegúrate de responder con código 200-299
- Revisa el historial de entregas para ver el error específico
- Confirma que tu servidor responde en menos de 10 segundos

### Firma inválida

- Verifica que estás usando el secret correcto
- Asegúrate de verificar la firma del payload JSON exacto (sin modificar)
- El payload debe ser parseado como JSON antes de verificar

## Soporte

Para más información sobre la API de webhooks, consulta la documentación OpenAPI en:
```
http://localhost:3500/ui
```
