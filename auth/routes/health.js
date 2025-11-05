import { OpenAPIHono } from '@hono/zod-openapi'
import db from '../db.js'

const health = new OpenAPIHono()
const startTime = new Date().toISOString()

// General health endpoint
health.openapi({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  security: [], // Endpoint público - no requiere autenticación
  responses: {
    200: {
      description: 'Health check completo del servicio',
      content: {
        'application/json': {
          schema: { type: 'object' }
        }
      }
    }
  }
}, async (c) => {
  let dbStatus = 'UP'
  try {
    await db('SELECT 1')
  } catch (err) {
    dbStatus = 'DOWN'
  }

  const status = dbStatus === 'UP' ? 'UP' : 'DOWN'
  
  return c.json({
    status,
    check: [
      {
        name: 'Readiness check',
        status: dbStatus === 'UP' ? 'UP' : 'DOWN',
        data: {
          from: startTime,
          status: dbStatus === 'UP' ? 'READY' : 'NOT_READY'
        }
      },
      {
        name: 'Liveness check',
        status: 'UP',
        data: {
          from: startTime,
          status: 'ALIVE'
        }
      },
      {
        name: 'Database check',
        status: dbStatus,
        data: {
          status: dbStatus
        }
      }
    ]
  }, status === 'UP' ? 200 : 503)
})

// Readiness probe
health.openapi({
  method: 'get',
  path: '/health/ready',
  tags: ['Health'],
  security: [],
  responses: {
    200: {
      description: 'El servicio está listo para recibir tráfico',
      content: {
        'application/json': {
          schema: { type: 'object' }
        }
      }
    }
  }
}, async (c) => {
  let dbReady = true
  try {
    await db('SELECT 1')
  } catch (err) {
    dbReady = false
  }

  const ready = dbReady
  
  return c.json({
    status: ready ? 'UP' : 'DOWN',
    check: [
      {
        name: 'Readiness check',
        status: ready ? 'UP' : 'DOWN',
        data: {
          from: startTime,
          status: ready ? 'READY' : 'NOT_READY',
          database: dbReady ? 'connected' : 'disconnected'
        }
      }
    ]
  }, ready ? 200 : 503)
})

// Liveness probe
health.openapi({
  method: 'get',
  path: '/health/live',
  tags: ['Health'],
  security: [],
  responses: {
    200: {
      description: 'El servicio está vivo',
      content: {
        'application/json': {
          schema: { type: 'object' }
        }
      }
    }
  }
}, (c) => {
  return c.json({
    status: 'UP',
    check: [
      {
        name: 'Liveness check',
        status: 'UP',
        data: {
          from: startTime,
          status: 'ALIVE',
          uptime: Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
        }
      }
    ]
  })
})

export default health
