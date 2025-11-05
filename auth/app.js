import { OpenAPIHono } from '@hono/zod-openapi'
import { errorHandler, requestLogger } from './middleware/error-handler.js'

export const app = new OpenAPIHono({
  openapi: '3.0.0',
  info: {
    title: 'Microservicios',
    version: '1.0.0',
    description: 'Reto numero 2 de microservicios',
  },
  servers: [
    { url: 'http://localhost:3500', description: 'Local' },
  ],
  tags: [
    { name: 'Health', description: 'Health check endpoints' },
    { name: 'Authentication', description: 'Authentication and registration endpoints' },
    { name: 'Users', description: 'User management endpoints' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        in: 'header',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Authorization header using the Bearer scheme. Example: "Authorization: Bearer {token}"'
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
})

// Middleware de logging y manejo de errores
app.use('*', requestLogger)
app.onError(errorHandler)