import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import authMw from '../auth-mw.js'
import webhookService from '../utils/webhook.js'
import { errorResponse, validationErrorResponse } from '../schemas.js'

const webhooks = new OpenAPIHono()

// Schemas for webhook operations
const webhookSchema = z.object({
  id: z.string().uuid().describe('ID único del webhook'),
  userId: z.string().uuid().describe('ID del usuario propietario'),
  name: z.string().describe('Nombre descriptivo del webhook'),
  url: z.string().url().describe('URL de destino del webhook'),
  events: z.array(z.string()).describe('Eventos a los que está suscrito el webhook'),
  secret: z.string().optional().describe('Secreto para verificación de firma (solo en creación)'),
  active: z.boolean().describe('Estado del webhook (activo/inactivo)'),
  createdAt: z.string().describe('Fecha de creación'),
  updatedAt: z.string().describe('Fecha de última actualización'),
})

const webhookResponseSchema = webhookSchema.omit({ secret: true })

const webhookCreateSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100, 'El nombre no puede tener más de 100 caracteres').describe('Nombre descriptivo del webhook'),
  url: z.string().url('URL inválida').describe('URL de destino donde se enviarán los eventos'),
  events: z.array(z.enum([
    'user.created',
    'user.updated',
    'user.deleted',
    'user.login',
    'password.reset.requested',
    'password.updated'
  ])).min(1, 'Debe suscribirse al menos a un evento').describe('Lista de eventos a los que desea suscribirse'),
})

const webhookUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional().describe('Nuevo nombre del webhook'),
  url: z.string().url().optional().describe('Nueva URL de destino'),
  events: z.array(z.enum([
    'user.created',
    'user.updated',
    'user.deleted',
    'user.login',
    'password.reset.requested',
    'password.updated'
  ])).min(1).optional().describe('Nueva lista de eventos'),
  active: z.boolean().optional().describe('Nuevo estado del webhook'),
})

const webhookDeliverySchema = z.object({
  id: z.string().uuid().describe('ID de la entrega'),
  webhookId: z.string().uuid().describe('ID del webhook'),
  eventType: z.string().describe('Tipo de evento'),
  payload: z.any().describe('Payload enviado'),
  responseStatus: z.number().nullable().describe('Código de estado HTTP de la respuesta'),
  responseBody: z.string().nullable().describe('Cuerpo de la respuesta'),
  error: z.string().nullable().describe('Error en caso de fallo'),
  attempt: z.number().describe('Número de intento'),
  deliveredAt: z.string().nullable().describe('Fecha de entrega exitosa'),
  createdAt: z.string().describe('Fecha de creación'),
})

/* =====================
   POST /webhooks - Crear un nuevo webhook
===================== */
webhooks.openapi(createRoute({
  method: 'post',
  path: '/webhooks',
  tags: ['Webhooks'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    body: {
      content: {
        'application/json': { schema: webhookCreateSchema }
      }
    }
  },
  responses: {
    201: {
      description: 'Webhook creado exitosamente',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            webhook: webhookSchema
          })
        }
      }
    },
    400: { description: 'Datos inválidos', content: { 'application/json': { schema: validationErrorResponse } } },
    401: { description: 'No autenticado', content: { 'application/json': { schema: errorResponse } } },
    409: { description: 'Ya existe un webhook con ese nombre', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const decoded = c.get('user')
    if (!decoded || !decoded.uid) {
      return c.json({ error: 'No autenticado' }, 401)
    }

    const { name, url, events } = c.req.valid('json')

    const webhook = await webhookService.createWebhook(decoded.uid, { name, url, events })

    return c.json({
      message: 'Webhook creado exitosamente',
      webhook: {
        id: webhook.id,
        userId: webhook.user_id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret,
        active: webhook.active,
        createdAt: webhook.created_at,
        updatedAt: webhook.updated_at,
      }
    }, 201)

  } catch (error) {
    console.error('Error al crear webhook:', error)
    
    if (error.code === '23505') { // Unique constraint violation
      return c.json({ error: 'Ya existe un webhook con ese nombre' }, 409)
    }

    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

/* =====================
   GET /webhooks - Listar webhooks del usuario
===================== */
webhooks.openapi(createRoute({
  method: 'get',
  path: '/webhooks',
  tags: ['Webhooks'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  responses: {
    200: {
      description: 'Lista de webhooks obtenida exitosamente',
      content: {
        'application/json': {
          schema: z.object({
            webhooks: z.array(webhookResponseSchema)
          })
        }
      }
    },
    401: { description: 'No autenticado', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const decoded = c.get('user')
    if (!decoded || !decoded.uid) {
      return c.json({ error: 'No autenticado' }, 401)
    }

    const webhookList = await webhookService.listWebhooks(decoded.uid)

    const webhooks = webhookList.map(w => ({
      id: w.id,
      userId: w.user_id,
      name: w.name,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    }))

    return c.json({ webhooks }, 200)

  } catch (error) {
    console.error('Error al listar webhooks:', error)
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

/* =====================
   GET /webhooks/:id - Obtener un webhook específico
===================== */
webhooks.openapi(createRoute({
  method: 'get',
  path: '/webhooks/{id}',
  tags: ['Webhooks'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    params: z.object({
      id: z.string().uuid('ID de webhook inválido').describe('ID del webhook')
    })
  },
  responses: {
    200: {
      description: 'Webhook obtenido exitosamente',
      content: {
        'application/json': {
          schema: z.object({
            webhook: webhookResponseSchema
          })
        }
      }
    },
    401: { description: 'No autenticado', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Webhook no encontrado', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const decoded = c.get('user')
    if (!decoded || !decoded.uid) {
      return c.json({ error: 'No autenticado' }, 401)
    }

    const { id } = c.req.valid('param')

    const webhook = await webhookService.getWebhook(id, decoded.uid)
    if (!webhook) {
      return c.json({ error: 'Webhook no encontrado' }, 404)
    }

    return c.json({
      webhook: {
        id: webhook.id,
        userId: webhook.user_id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        createdAt: webhook.created_at,
        updatedAt: webhook.updated_at,
      }
    }, 200)

  } catch (error) {
    console.error('Error al obtener webhook:', error)
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

/* =====================
   PATCH /webhooks/:id - Actualizar un webhook
===================== */
webhooks.openapi(createRoute({
  method: 'patch',
  path: '/webhooks/{id}',
  tags: ['Webhooks'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    params: z.object({
      id: z.string().uuid('ID de webhook inválido').describe('ID del webhook')
    }),
    body: {
      content: {
        'application/json': { schema: webhookUpdateSchema }
      }
    }
  },
  responses: {
    200: {
      description: 'Webhook actualizado exitosamente',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            webhook: webhookResponseSchema
          })
        }
      }
    },
    400: { description: 'Datos inválidos', content: { 'application/json': { schema: validationErrorResponse } } },
    401: { description: 'No autenticado', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Webhook no encontrado', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const decoded = c.get('user')
    if (!decoded || !decoded.uid) {
      return c.json({ error: 'No autenticado' }, 401)
    }

    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')

    const webhook = await webhookService.updateWebhook(id, decoded.uid, updates)

    return c.json({
      message: 'Webhook actualizado exitosamente',
      webhook: {
        id: webhook.id,
        userId: webhook.user_id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        createdAt: webhook.created_at,
        updatedAt: webhook.updated_at,
      }
    }, 200)

  } catch (error) {
    console.error('Error al actualizar webhook:', error)
    
    if (error.message === 'Webhook not found') {
      return c.json({ error: 'Webhook no encontrado' }, 404)
    }
    if (error.message === 'No fields to update') {
      return c.json({ error: 'No hay campos para actualizar' }, 400)
    }

    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

/* =====================
   DELETE /webhooks/:id - Eliminar un webhook
===================== */
webhooks.openapi(createRoute({
  method: 'delete',
  path: '/webhooks/{id}',
  tags: ['Webhooks'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    params: z.object({
      id: z.string().uuid('ID de webhook inválido').describe('ID del webhook')
    })
  },
  responses: {
    200: {
      description: 'Webhook eliminado exitosamente',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string()
          })
        }
      }
    },
    401: { description: 'No autenticado', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Webhook no encontrado', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const decoded = c.get('user')
    if (!decoded || !decoded.uid) {
      return c.json({ error: 'No autenticado' }, 401)
    }

    const { id } = c.req.valid('param')

    const deleted = await webhookService.deleteWebhook(id, decoded.uid)
    if (!deleted) {
      return c.json({ error: 'Webhook no encontrado' }, 404)
    }

    return c.json({ message: 'Webhook eliminado exitosamente' }, 200)

  } catch (error) {
    console.error('Error al eliminar webhook:', error)
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

/* =====================
   GET /webhooks/:id/deliveries - Obtener entregas de un webhook
===================== */
webhooks.openapi(createRoute({
  method: 'get',
  path: '/webhooks/{id}/deliveries',
  tags: ['Webhooks'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    params: z.object({
      id: z.string().uuid('ID de webhook inválido').describe('ID del webhook')
    }),
    query: z.object({
      limit: z.string().regex(/^\d+$/).optional().describe('Número máximo de entregas a retornar (máximo 100)')
    })
  },
  responses: {
    200: {
      description: 'Lista de entregas obtenida exitosamente',
      content: {
        'application/json': {
          schema: z.object({
            deliveries: z.array(webhookDeliverySchema)
          })
        }
      }
    },
    401: { description: 'No autenticado', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Webhook no encontrado', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const decoded = c.get('user')
    if (!decoded || !decoded.uid) {
      return c.json({ error: 'No autenticado' }, 401)
    }

    const { id } = c.req.valid('param')
    const queryParams = c.req.valid('query')
    const limit = Math.min(100, parseInt(queryParams.limit || '50', 10))

    const deliveryList = await webhookService.getWebhookDeliveries(id, decoded.uid, limit)

    const deliveries = deliveryList.map(d => ({
      id: d.id,
      webhookId: d.webhook_id,
      eventType: d.event_type,
      payload: d.payload,
      responseStatus: d.response_status,
      responseBody: d.response_body,
      error: d.error,
      attempt: d.attempt,
      deliveredAt: d.delivered_at,
      createdAt: d.created_at,
    }))

    return c.json({ deliveries }, 200)

  } catch (error) {
    console.error('Error al obtener entregas:', error)
    
    if (error.message === 'Webhook not found') {
      return c.json({ error: 'Webhook no encontrado' }, 404)
    }

    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

export default webhooks
