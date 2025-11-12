import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import cron from 'node-cron'
import nodemailer from 'nodemailer'

const app = new Hono()

// Store for registered services
const services = new Map()
const healthHistory = new Map()

// Email transporter configuration
let transporter = null
try {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })
} catch (err) {
  console.error('[monitor] Error configurando email:', err.message)
}

// Logger
function log(level, message, payload = null) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'monitor',
    host: process.env.HOSTNAME || null,
    logger: 'monitor',
    message
  }
  if (payload !== null) record.payload = payload
  console.log(JSON.stringify(record))
}

// Health check function
async function checkHealth(service) {
  const startTime = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), service.timeout || 5000)
    
    const response = await fetch(service.endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    
    clearTimeout(timeout)
    const duration = Date.now() - startTime
    const isHealthy = response.ok
    
    let body = null
    try {
      body = await response.json()
    } catch (e) {
      // Response might not be JSON
    }
    
    return {
      healthy: isHealthy,
      status: response.status,
      duration,
      body,
      timestamp: new Date().toISOString()
    }
  } catch (err) {
    return {
      healthy: false,
      error: err.message,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }
  }
}

// Send alert email
async function sendAlert(service, healthResult) {
  if (!transporter || !service.notificationEmails || service.notificationEmails.length === 0) {
    return
  }
  
  try {
    const subject = `🚨 Alerta: ${service.name} está ${healthResult.healthy ? 'recuperado' : 'caído'}`
    const html = `
      <h2>Estado del servicio: ${service.name}</h2>
      <p><strong>Estado:</strong> ${healthResult.healthy ? '✅ RECUPERADO' : '❌ CAÍDO'}</p>
      <p><strong>Endpoint:</strong> ${service.endpoint}</p>
      <p><strong>Timestamp:</strong> ${healthResult.timestamp}</p>
      <p><strong>Duración:</strong> ${healthResult.duration}ms</p>
      ${healthResult.error ? `<p><strong>Error:</strong> ${healthResult.error}</p>` : ''}
      ${healthResult.body ? `<p><strong>Detalles:</strong> <pre>${JSON.stringify(healthResult.body, null, 2)}</pre></p>` : ''}
    `
    
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: service.notificationEmails.join(','),
      subject,
      html
    })
    
    log('INFO', 'Email de alerta enviado', { service: service.name, emails: service.notificationEmails })
  } catch (err) {
    log('ERROR', 'Error enviando email de alerta', { service: service.name, error: err.message })
  }
}

// Periodic health check
async function performHealthChecks() {
  for (const [name, service] of services.entries()) {
    const result = await checkHealth(service)
    
    // Get previous status
    const history = healthHistory.get(name) || []
    const previousStatus = history.length > 0 ? history[history.length - 1] : null
    
    // Store result
    history.push(result)
    if (history.length > 100) history.shift() // Keep last 100 checks
    healthHistory.set(name, history)
    
    // Check for status change
    if (previousStatus && previousStatus.healthy !== result.healthy) {
      log('WARN', 'Cambio de estado de servicio', { 
        service: name, 
        previous: previousStatus.healthy ? 'healthy' : 'unhealthy',
        current: result.healthy ? 'healthy' : 'unhealthy'
      })
      await sendAlert(service, result)
    }
    
    if (!result.healthy) {
      log('ERROR', 'Servicio no saludable', { service: name, result })
    }
  }
}

// Routes

// Register a service
app.post('/register', async (c) => {
  try {
    const body = await c.req.json()
    const { name, endpoint, frequency, notificationEmails, timeout } = body
    
    if (!name || !endpoint) {
      return c.json({ error: 'name y endpoint son requeridos' }, 400)
    }
    
    services.set(name, {
      name,
      endpoint,
      frequency: frequency || 60000, // Default 1 minute
      notificationEmails: notificationEmails || [],
      timeout: timeout || 5000,
      registeredAt: new Date().toISOString()
    })
    
    log('INFO', 'Servicio registrado', { name, endpoint })
    
    return c.json({
      success: true,
      message: 'Servicio registrado exitosamente',
      service: services.get(name)
    }, 201)
  } catch (err) {
    log('ERROR', 'Error registrando servicio', { error: err.message })
    return c.json({ error: 'Error registrando servicio' }, 500)
  }
})

// Get all services health
app.get('/health', async (c) => {
  const results = {}
  
  for (const [name, service] of services.entries()) {
    const history = healthHistory.get(name) || []
    const lastCheck = history.length > 0 ? history[history.length - 1] : null
    
    results[name] = {
      service: service.name,
      endpoint: service.endpoint,
      lastCheck,
      checksCount: history.length,
      uptime: history.filter(h => h.healthy).length / history.length
    }
  }
  
  return c.json({
    status: 'UP',
    services: results,
    timestamp: new Date().toISOString()
  })
})

// Get specific service health
app.get('/health/:service', async (c) => {
  const serviceName = c.req.param('service')
  const service = services.get(serviceName)
  
  if (!service) {
    return c.json({ error: 'Servicio no encontrado' }, 404)
  }
  
  const history = healthHistory.get(serviceName) || []
  const lastCheck = history.length > 0 ? history[history.length - 1] : null
  
  return c.json({
    service: service.name,
    endpoint: service.endpoint,
    lastCheck,
    history: history.slice(-10), // Last 10 checks
    checksCount: history.length,
    uptime: history.length > 0 ? history.filter(h => h.healthy).length / history.length : 0,
    timestamp: new Date().toISOString()
  })
})

// Unregister a service
app.delete('/register/:service', async (c) => {
  const serviceName = c.req.param('service')
  
  if (!services.has(serviceName)) {
    return c.json({ error: 'Servicio no encontrado' }, 404)
  }
  
  services.delete(serviceName)
  healthHistory.delete(serviceName)
  
  log('INFO', 'Servicio eliminado', { service: serviceName })
  
  return c.json({
    success: true,
    message: 'Servicio eliminado exitosamente'
  })
})

// Health endpoint for monitor itself
app.get('/health-check', (c) => {
  return c.json({
    status: 'UP',
    check: [
      {
        name: 'Readiness check',
        status: 'UP',
        data: {
          from: new Date().toISOString(),
          status: 'READY'
        }
      },
      {
        name: 'Liveness check',
        status: 'UP',
        data: {
          from: new Date().toISOString(),
          status: 'ALIVE'
        }
      }
    ]
  })
})

// Start cron job for periodic checks
cron.schedule('*/30 * * * * *', () => {
  // Run every 30 seconds
  performHealthChecks()
})

// Auto-register known services
const autoRegisterServices = async () => {
  const knownServices = [
    {
      name: 'auth',
      endpoint: 'http://auth:3500/health',
      frequency: 30000,
      notificationEmails: process.env.ALERT_EMAILS?.split(',') || []
    },
    {
      name: 'profiles',
      endpoint: 'http://profiles:3600/health',
      frequency: 30000,
      notificationEmails: process.env.ALERT_EMAILS?.split(',') || []
    },
    {
      name: 'orchestrator',
      endpoint: 'http://orchestrator:8080/actuator/health',
      frequency: 30000,
      notificationEmails: process.env.ALERT_EMAILS?.split(',') || []
    }
  ]
  
  for (const service of knownServices) {
    services.set(service.name, {
      ...service,
      timeout: 5000,
      registeredAt: new Date().toISOString()
    })
    log('INFO', 'Servicio auto-registrado', { name: service.name })
  }
}

const PORT = parseInt(process.env.PORT || '8085')

serve({ fetch: app.fetch, port: PORT }, async (info) => {
  log('INFO', 'Monitor service started', { port: info.port })
  await autoRegisterServices()
  log('INFO', 'Servicios auto-registrados completados')
})
