import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import logger from './logger.js'
import healthRoutes from './routes/health.js'
import profilesRoutes from './routes/profiles.js'

const app = new Hono()

// Logging middleware
app.use('*', async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path

  await next()

  const duration = Date.now() - start
  const status = c.res.status

  logger.info('HTTP Request', {
    method,
    path,
    status,
    duration: `${duration}ms`
  })
})

// Error handling middleware
app.onError((err, c) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method
  })

  return c.json({
    error: 'Internal server error',
    message: err.message
  }, 500)
})

// Mount routes
app.route('/', healthRoutes)
app.route('/profiles', profilesRoutes)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    service: 'profiles',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      profiles: '/profiles'
    }
  })
})

// Start server
const port = parseInt(process.env.PORT || '3600')

serve({
  fetch: app.fetch,
  port
}, (info) => {
  logger.info(`Profiles service started`, {
    port: info.port,
    environment: process.env.NODE_ENV || 'development'
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  process.exit(0)
})

export default app
