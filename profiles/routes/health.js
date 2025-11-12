import { Hono } from 'hono'
import db from '../db.js'
import logger from '../logger.js'

const health = new Hono()
const startTime = new Date().toISOString()

// General health endpoint
health.get('/health', async (c) => {
  let dbStatus = 'UP'
  try {
    await db('SELECT 1')
  } catch (err) {
    dbStatus = 'DOWN'
    logger.error('Health check: Database connection failed', { error: err.message })
  }

  const status = dbStatus === 'UP' ? 'UP' : 'DOWN'
  
  return c.json({
    status,
    service: 'profiles',
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
          status: dbStatus,
          schema: 'profiles'
        }
      }
    ]
  }, status === 'UP' ? 200 : 503)
})

// Readiness probe
health.get('/health/ready', async (c) => {
  let dbReady = true
  try {
    await db('SELECT 1')
  } catch (err) {
    dbReady = false
    logger.error('Readiness check: Database not ready', { error: err.message })
  }

  const ready = dbReady
  
  return c.json({
    status: ready ? 'UP' : 'DOWN',
    service: 'profiles',
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
health.get('/health/live', (c) => {
  return c.json({
    status: 'UP',
    service: 'profiles',
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
