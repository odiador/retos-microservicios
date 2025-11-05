import { z } from 'zod'
import appLogger from '../logger.js'

// Middleware para manejar errores de validación de Zod
export const errorHandler = async (err, c) => {
  // use structured logger
  appLogger.error('Error en middleware', err)

  // Manejar errores de validación de Zod
  if (err instanceof z.ZodError) {
    const validationErrors = err.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code
    }))

    return c.json({
      error: 'Error de validación',
      details: validationErrors
    }, 400)
  }

  // Manejar errores de Hono/Zod OpenAPI
  if (err.message && err.message.includes('Validation')) {
    return c.json({
      error: 'Error de validación en la solicitud',
      details: err.message
    }, 400)
  }

  // Manejar errores de autenticación
  if (err.message && err.message.includes('Unauthorized')) {
    return c.json({
      error: 'No autorizado',
      details: 'Token de acceso requerido o inválido'
    }, 401)
  }

  // Manejar errores de base de datos
  if (err.code && typeof err.code === 'string') {
    // Errores de PostgreSQL
    if (err.code === '23505') { // unique_violation
      return c.json({
        error: 'Conflicto de datos',
        details: 'Ya existe un registro con estos datos'
      }, 409)
    }
    if (err.code === '23503') { // foreign_key_violation
      return c.json({
        error: 'Referencia inválida',
        details: 'Los datos referenciados no existen'
      }, 400)
    }
    if (err.code === '23502') { // not_null_violation
      return c.json({
        error: 'Datos requeridos faltantes',
        details: 'Campos obligatorios no pueden estar vacíos'
      }, 400)
    }
  }

  // Error genérico del servidor
  return c.json({
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error inesperado'
  }, 500)
}

// Middleware para logging de requests
export const requestLogger = async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path

  // Emit structured request start log
  appLogger.info('request_start', { method, path, timestamp: new Date().toISOString() })

  await next()

  const duration = Date.now() - start
  const status = c.res.status

  // Emit structured request end log
  appLogger.info('request_end', { method, path, status, duration })
}
