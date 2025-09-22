import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import db from '../db.js'
import bcrypt from 'bcryptjs'
import authMw from '../auth-mw.js'
import events from '../events/publisher.js'
import { userSchema, errorResponse, validationErrorResponse, successResponse, paginationQuery, paginationResponse, usernameParam } from '../schemas.js'

const SCHEMA = process.env.DB_SCHEMA || 'auth'
const users = new OpenAPIHono()

// Esquemas de respuesta para la gestión de usuarios

users.openapi(createRoute({
  method: 'get',
  path: '/accounts/{username}',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    params: z.object({
      username: z.string()
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
        .max(20, 'El nombre de usuario no puede tener más de 20 caracteres')
        .regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos')
        .describe('Nombre de usuario del perfil a consultar')
    })
  },
  responses: {
    200: { description: 'Perfil del usuario obtenido exitosamente', content: { 'application/json': { schema: z.object({ user: userSchema }).describe('Respuesta con la información del perfil del usuario') } } },
    401: { description: 'No autenticado - Token de acceso requerido', content: { 'application/json': { schema: errorResponse } } },
    403: { description: 'No autorizado para ver este perfil de usuario', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Usuario no encontrado', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  const decoded = c.get('user')
  const { username } = c.req.valid('param')
  
  console.log('Usuario decodificado:', decoded)
  console.log('Username del parámetro:', username)
 
  if (!decoded || !decoded.uid) {
    return c.json({ error: 'No autenticado' }, 401)
  }
 
  if (decoded.sub !== username) {
    console.log(`username no coincide: ${decoded.sub} !== ${username}`)
    return c.json({ error: 'No autorizado' }, 403)
  }
  const result = await db(`SELECT id, username, email, first_name AS "firstName", last_name AS "lastName", phone, role, status, created_at AS "createdAt", updated_at AS "updatedAt", last_login_at AS "lastLoginAt" FROM ${SCHEMA}.users WHERE username=$1 LIMIT 1`, [username])
  if (result.rows.length === 0) return c.json({ error: 'Usuario no encontrado' }, 404)
  return c.json({ user: result.rows[0] })
})

/* =====================
   PATCH /users/me
===================== */
const patchBody = z.object({
  firstName: z.string().min(1, 'El nombre no puede estar vacío').max(50, 'El nombre no puede tener más de 50 caracteres').optional().describe('Nuevo nombre del usuario'),
  lastName: z.string().min(1, 'El apellido no puede estar vacío').max(50, 'El apellido no puede tener más de 50 caracteres').optional().describe('Nuevo apellido del usuario'),
  phone: z.string().min(1, 'El teléfono no puede estar vacío').max(20, 'El teléfono no puede tener más de 20 caracteres').optional().describe('Nuevo número de teléfono'),
})

users.openapi(createRoute({
  method: 'patch',
  path: '/accounts/{username}',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    params: z.object({
      username: z.string()
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
        .max(20, 'El nombre de usuario no puede tener más de 20 caracteres')
        .regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos')
        .describe('Nombre de usuario del perfil a actualizar')
    }),
    body: { content: { 'application/json': { schema: patchBody } } }
  },
  responses: {
    200: { description: 'Perfil de usuario actualizado exitosamente', content: { 'application/json': { schema: z.object({ user: userSchema }).describe('Respuesta con la información actualizada del perfil') } } },
    400: { description: 'Sin cambios - Los datos proporcionados son idénticos a los actuales', content: { 'application/json': { schema: validationErrorResponse } } },
    401: { description: 'No autenticado - Token de acceso requerido', content: { 'application/json': { schema: errorResponse } } },
    403: { description: 'No autorizado para actualizar este perfil', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Usuario no encontrado', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  const decoded = c.get('user')
  if (!decoded || !decoded.uid) return c.json({ error: 'No autenticado' }, 401)
  
  const { username } = c.req.valid('param')
  const { firstName, lastName, phone } = c.req.valid('json')

  // Verificar permisos: el usuario puede actualizar su propio perfil o un admin puede actualizar cualquier perfil
  if (decoded.sub !== username) {
    // Verificar si el usuario autenticado es admin
    const me = await db(`SELECT role FROM ${SCHEMA}.users WHERE id=$1 LIMIT 1`, [decoded.uid])
    if (me.rows.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404)
    }
    if (me.rows[0].role !== 'admin') {
      return c.json({ error: 'No autorizado para actualizar este perfil' }, 403)
    }
  }

  // Buscar el usuario a actualizar
  const userResult = await db(`SELECT id FROM ${SCHEMA}.users WHERE username=$1 LIMIT 1`, [username])
  if (userResult.rows.length === 0) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }
  const targetUserId = userResult.rows[0].id

  const sets = []
  const params = []
  let i = 1
  if (firstName !== undefined) { sets.push(`first_name = $${i++}`); params.push(firstName) }
  if (lastName !== undefined) { sets.push(`last_name = $${i++}`); params.push(lastName) }
  if (phone !== undefined) { sets.push(`phone = $${i++}`); params.push(phone) }
  if (sets.length === 0) return c.json({ error: 'No hay campos para actualizar' }, 400)
  
  params.push(targetUserId)
  const sql = `UPDATE ${SCHEMA}.users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING id, username, email, first_name AS "firstName", last_name AS "lastName", phone, role, status, created_at AS "createdAt", updated_at AS "updatedAt", last_login_at AS "lastLoginAt"`
  const updated = await db(sql, params)
  // Publicar evento user.updated
  try {
    await events.publish('user.updated', {
      type: 'user.updated',
      data: { id: updated.rows[0].id, username: updated.rows[0].username, email: updated.rows[0].email },
      meta: { actor: decoded.uid, timestamp: new Date().toISOString() }
    })
  } catch (err) {
    console.error('Error publicando evento user.updated', err && err.message ? err.message : err)
  }

  return c.json({ user: updated.rows[0] })
})

/* =====================
   PUT /accounts/{username} - Cambiar contraseña
===================== */
const changePasswordBody = z.object({
  oldPassword: z.string().min(1, 'La contraseña actual es obligatoria').describe('Contraseña actual del usuario'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(100, 'La nueva contraseña no puede tener más de 100 caracteres').describe('Nueva contraseña segura'),
})

users.openapi(createRoute({
  method: 'put',
  path: '/accounts/{username}',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    params: z.object({
      username: z.string()
        .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
        .max(20, 'El nombre de usuario no puede tener más de 20 caracteres')
        .regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos')
        .describe('Nombre de usuario cuya contraseña se va a cambiar')
    }),
    body: { content: { 'application/json': { schema: changePasswordBody } } }
  },
  responses: {
    200: { description: 'Contraseña cambiada exitosamente', content: { 'application/json': { schema: z.object({ message: z.string().describe('Mensaje de confirmación') }).describe('Respuesta de confirmación del cambio de contraseña') } } },
    400: { description: 'Datos inválidos - Verifique las contraseñas', content: { 'application/json': { schema: validationErrorResponse } } },
    401: { description: 'No autenticado - Token de acceso requerido', content: { 'application/json': { schema: errorResponse } } },
    403: { description: 'No autorizado para cambiar esta contraseña', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Usuario no encontrado', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  const decoded = c.get('user')
  if (!decoded || !decoded.uid) return c.json({ error: 'No autenticado' }, 401)
  
  const { username } = c.req.valid('param')
  const { oldPassword, newPassword } = c.req.valid('json')

  // Verificar permisos: el usuario puede cambiar su propia contraseña o un admin puede cambiar cualquier contraseña
  if (decoded.sub !== username) {
    // Verificar si el usuario autenticado es admin
    const me = await db(`SELECT role FROM ${SCHEMA}.users WHERE id=$1 LIMIT 1`, [decoded.uid])
    if (me.rows.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404)
    }
    if (me.rows[0].role !== 'admin') {
      return c.json({ error: 'No autorizado para cambiar esta contraseña' }, 403)
    }
  }

  // Obtener información completa del usuario
  const userResult = await db(`SELECT id, password, email, phone FROM ${SCHEMA}.users WHERE username=$1 LIMIT 1`, [username])
  if (userResult.rows.length === 0) return c.json({ error: 'Usuario no encontrado' }, 404)

  const { id: userId, password: currentHash, email, phone } = userResult.rows[0]

  // Verificar la contraseña actual
  const match = await bcrypt.compare(oldPassword, currentHash)
  if (!match) {
    return c.json({ error: 'Contraseña actual incorrecta' }, 400)
  }

  // Hashear la nueva contraseña
  const newHash = await bcrypt.hash(newPassword, 10)

  // Actualizar la contraseña en la BD
  await db(`UPDATE ${SCHEMA}.users SET password=$1, updated_at=NOW() WHERE username=$2`, [newHash, username])

  // Publicar evento password.updated con información completa
  try {
    await events.publish('password.updated', {
      type: 'password.updated',
      data: { userId, username, email, phone },
      meta: { actor: decoded.uid, timestamp: new Date().toISOString() }
    })
  } catch (err) {
    console.error('Error publicando evento password.updated', err && err.message ? err.message : err)
  }

  return c.json({ message: 'Contraseña cambiada exitosamente' }, 200)
})

/* =====================
   GET /accounts - Listar usuarios con paginación
===================== */
const listQuery = z.object({
  page: z.string().regex(/^\d+$/, 'El número de página debe ser un entero positivo').optional().describe('Número de página (empieza en 1)'),
  limit: z.string().regex(/^\d+$/, 'El límite debe ser un entero positivo').optional().describe('Número de elementos por página (máximo 100)'),
  search: z.string().optional().describe('Término de búsqueda para filtrar usuarios'),
  status: z.string().optional().describe('Filtrar por estado del usuario'),
  sortBy: z.string().optional().describe('Campo por el cual ordenar los resultados'),
  sortOrder: z.string().regex(/^(asc|desc)$/i, 'El orden debe ser "asc" o "desc"').optional().describe('Orden de clasificación (asc o desc)'),
})

const listResp = z.object({
  items: z.array(userSchema).describe('Lista de usuarios'),
  total: z.number().describe('Total de usuarios encontrados'),
  page: z.number().describe('Página actual'),
  limit: z.number().describe('Límite de elementos por página'),
})

users.openapi(createRoute({
  method: 'get',
  path: '/accounts',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: { query: listQuery },
  responses: {
    200: { description: 'Lista de usuarios obtenida exitosamente', content: { 'application/json': { schema: listResp.describe('Respuesta con la lista paginada de usuarios') } } },
    400: { description: 'Parámetros inválidos - Verifique los parámetros de paginación y filtros', content: { 'application/json': { schema: validationErrorResponse } } },
    401: { description: 'No autenticado - Token de acceso requerido', content: { 'application/json': { schema: errorResponse } } },
    403: { description: 'Acceso denegado - Se requieren permisos de administrador', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Usuario no encontrado', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const decoded = c.get('user')
    if (!decoded || !decoded.uid) {
      return c.json({ error: 'No autenticado' }, 401)
    }

    // Verificar que el usuario sea admin
    const me = await db(`SELECT role FROM ${SCHEMA}.users WHERE id=$1 LIMIT 1`, [decoded.uid])
    if (me.rows.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404)
    }
    if (me.rows[0].role !== 'admin') {
      return c.json({ error: 'Acceso denegado' }, 403)
    }

    // Parámetros de consulta
    const q = c.req.query()
    const page = Math.max(1, parseInt(q.page || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || '25', 10)))
    const offset = (page - 1) * limit
    const search = q.search || null
    const status = q.status || null
    const sortBy = q.sortBy || 'created_at'
    const sortOrder = (q.sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    const allowedSort = ['id', 'username', 'email', 'created_at', 'updated_at', 'last_login_at']
    const sortCol = allowedSort.includes(sortBy) ? sortBy : 'created_at'

    // Construcción dinámica de filtros
    const where = []
    const params = []
    let idx = 1
    if (search) {
      where.push(`(username ILIKE $${idx} OR email ILIKE $${idx})`)
      params.push(`%${search}%`)
      idx++
    }
    if (status) {
      where.push(`status = $${idx}`)
      params.push(status)
      idx++
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // Total de usuarios
    const totalRes = await db(
      `SELECT COUNT(*) AS total FROM ${SCHEMA}.users ${whereSql}`,
      params
    )
    const total = Number(totalRes.rows[0].total || 0)

    // Paginación
    params.push(limit)
    params.push(offset)
    const sql = `
      SELECT id, username, email, first_name AS "firstName", last_name AS "lastName",
             phone, role, status, created_at AS "createdAt", updated_at AS "updatedAt",
             last_login_at AS "lastLoginAt"
      FROM ${SCHEMA}.users
      ${whereSql}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${idx} OFFSET $${idx + 1}
    `
    const res = await db(sql, params)

    return c.json({ items: res.rows, total, page, limit }, 200)

  } catch (error) {
    console.error('Error en /accounts:', error)
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

users.openapi(createRoute({
  method: 'delete',
  path: '/accounts/{username}',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  middleware: [authMw],
  request: {
    params: usernameParam,
  },
  responses: {
    200: {
      description: 'Cuenta de usuario eliminada exitosamente',
      content: {
        'application/json': { schema: z.object({ message: z.string().describe('Mensaje de confirmación de eliminación de cuenta') }) }
      }
    },
    401: { description: 'No autenticado - Token de acceso requerido', content: { 'application/json': { schema: errorResponse } } },
    403: { description: 'No autorizado para eliminar esta cuenta', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Usuario no encontrado', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  const decoded = c.get('user')
  if (!decoded || !decoded.uid) return c.json({ error: 'No autenticado' }, 401)

  const { username } = c.req.valid('param')

  // Verificar permisos: solo los admins pueden eliminar cuentas
  if (decoded.sub !== username) {
    // Verificar si el usuario autenticado es admin
    const me = await db(`SELECT role FROM ${SCHEMA}.users WHERE id=$1 LIMIT 1`, [decoded.uid])
    if (me.rows.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404)
    }
    if (me.rows[0].role !== 'admin') {
      return c.json({ error: 'No autorizado para eliminar esta cuenta' }, 403)
    }
  }

  try {
    // Buscar el usuario a eliminar
    const userResult = await db(`SELECT id FROM ${SCHEMA}.users WHERE username=$1 LIMIT 1`, [username])
    if (userResult.rows.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404)
    }
    const targetUserId = userResult.rows[0].id

    // Eliminar el usuario
    const result = await db(
      `DELETE FROM ${SCHEMA}.users WHERE id=$1 RETURNING id`,
      [targetUserId]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404)
    }

    // Publicar evento user.deleted
    try {
      await events.publish('user.deleted', {
        type: 'user.deleted',
        data: { id: targetUserId, username },
        meta: { actor: decoded.uid, timestamp: new Date().toISOString() }
      })
    } catch (err) {
      console.error('Error publicando evento user.deleted', err && err.message ? err.message : err)
    }

    return c.json({ message: 'Cuenta eliminada exitosamente' }, 200)
  } catch (err) {
    console.error('Error al eliminar cuenta:', err)
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

export default users
