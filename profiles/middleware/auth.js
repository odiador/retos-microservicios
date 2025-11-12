import jwt from 'jsonwebtoken'
import logger from '../logger.js'

const SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro'

/**
 * Middleware to verify JWT token
 */
export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid Authorization header')
    return c.json({ error: 'No autorizado', details: 'Token requerido' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, SECRET)
    c.set('user', decoded) // Store user data in context
    c.set('userId', decoded.uid || decoded.userId || decoded.sub) // User ID (UUID)
    await next()
  } catch (err) {
    logger.warn('Invalid JWT token', { error: err.message })
    return c.json({ error: 'No autorizado', details: 'Token inválido o expirado' }, 401)
  }
}

/**
 * Optional auth middleware (doesn't fail if no token)
 */
export async function optionalAuthMiddleware(c, next) {
  const authHeader = c.req.header('Authorization')

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    try {
      const decoded = jwt.verify(token, SECRET)
      c.set('user', decoded)
      c.set('userId', decoded.uid || decoded.userId || decoded.sub)
    } catch (err) {
      // Silently ignore invalid tokens in optional auth
      logger.debug('Optional auth: invalid token', { error: err.message })
    }
  }

  await next()
}
