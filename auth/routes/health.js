import { Hono } from 'hono'
import db from '../db.js'

const health = new Hono()
const startTime = new Date().toISOString()

// General health endpoint
health.get('/health', async (c) => {
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
health.get('/health/ready', async (c) => {
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
health.get('/health/live', (c) => {
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
