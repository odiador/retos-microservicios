import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import query from '../db.js'
import events from '../events/publisher.js'
import { parseTokenExpToSeconds } from '../utils/token.js'
import crypto from 'crypto'
import { baseUserSchema, userSchema, errorResponse, validationErrorResponse, successResponse } from '../schemas.js'

const SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro'
const TOKEN_EXP = process.env.TOKEN_EXP || '1h'
const SCHEMA = process.env.DB_SCHEMA || 'auth'

const auth = new OpenAPIHono()

// Helper para obtener IP de forma segura en distintos entornos
function getRequestIp(c) {
  try {
    // Hono exposes headers via c.req.header or c.req.headers.get depending on context
    const xfwd = (typeof c.req.header === 'function' && c.req.header('x-forwarded-for')) ||
      (c.req.headers && typeof c.req.headers.get === 'function' && c.req.headers.get('x-forwarded-for')) ||
      null
    if (xfwd) return xfwd.split(',')[0].trim()
    // fallback to socket remote address if available
    const remote = c.req.socket && c.req.socket.remoteAddress
    if (remote) return remote
  } catch (e) {
    // ignore and return null
  }
  return null
}

/* =====================
  Registrar un nuevo usuario
===================== */

const registerBody = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(20, 'El nombre de usuario no puede tener más de 20 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos').describe('Nombre de usuario único (3-20 caracteres)'),
  email: z.string().email('Formato de email inválido').describe('Correo electrónico válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100, 'La contraseña no puede tener más de 100 caracteres').describe('Contraseña segura (mínimo 8 caracteres)'),
  firstName: z.string().min(1, 'El nombre es obligatorio').max(50, 'El nombre no puede tener más de 50 caracteres').describe('Nombre del usuario'),
  lastName: z.string().min(1, 'El apellido es obligatorio').max(50, 'El apellido no puede tener más de 50 caracteres').describe('Apellido del usuario'),
  phone: z.string().min(7, 'El número de teléfono debe tener al menos 7 dígitos').max(20, 'El número de teléfono no puede tener más de 20 caracteres').regex(/^[+]?[0-9\s\-()]+$/, 'El número de teléfono solo puede contener números, espacios, guiones, paréntesis y el símbolo +').describe('Número de teléfono del usuario'),
})

const registerResp = z.object({
  message: z.string().describe('Mensaje de confirmación del registro'),
  user: baseUserSchema.describe('Información del usuario registrado'),
  access_token: z.string().describe('Token de acceso JWT'),
  token_type: z.literal('Bearer').describe('Tipo de token de autenticación'),
  expires_in: z.number().nullable().describe('Tiempo de expiración del token en segundos'),
})

auth.openapi(createRoute({
  method: 'post',
  path: '/accounts',
  tags: ['Authentication'],
  security: [], // Endpoint público - no requiere autenticación
  request: {
    body: {
      content: {
        'application/json': { schema: registerBody }
      }
    }
  },
  responses: {
    201: { description: 'Usuario registrado exitosamente', content: { 'application/json': { schema: registerResp.describe('Respuesta con la información del usuario registrado y token de acceso') } } },
    400: { description: 'Datos inválidos - Verifique los campos obligatorios y formatos', content: { 'application/json': { schema: validationErrorResponse } } },
    409: { description: 'Usuario existente - El nombre de usuario o email ya están registrados', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const { username, email, password, firstName, lastName, phone } = c.req.valid('json')

    // Validación rápida antes de ir a BD
    if (!username || !email || !password || !phone) {
      return c.json({ error: 'Faltan campos obligatorios (username, email, password o phone)' }, 400)
    }

    // Verificar si ya existe el usuario
    const existing = await query(
      `SELECT id FROM ${SCHEMA}.users WHERE username=$1 OR email=$2`,
      [username, email]
    )
    if (existing.rows.length > 0) {
      return c.json({ error: 'El usuario o correo ya están registrados' }, 409)
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const insert = await query(
      `INSERT INTO ${SCHEMA}.users (username,email,password,first_name,last_name,phone)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,username,email,first_name,last_name,phone,role,status,created_at,updated_at,last_login_at`,
      [username, email, passwordHash, firstName, lastName, phone]
    )

    const row = insert.rows[0]
    const user = {
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    }

    const token = jwt.sign(
      { sub: user.username, uid: user.id, role: user.role },
      SECRET,
      { expiresIn: TOKEN_EXP }
    )
    const expiresIn = parseTokenExpToSeconds(TOKEN_EXP)

    // Publicar evento user.created
    try {
      await events.publish('user.created', {
        type: 'user.created',
        data: { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          phone: user.phone,
          role: user.role 
        },
        meta: { ip: getRequestIp(c), timestamp: new Date().toISOString() }
      })
    } catch (err) {
      console.error('Error publicando evento user.created', err && err.message ? err.message : err)
    }

    return c.json({
      message: 'Usuario registrado exitosamente',
      user,
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresIn
    }, 201)

  } catch (error) {
    console.error('Error al registrar usuario:', error)
    if (error.code === '23505') {
      return c.json({ error: 'El usuario o correo ya están registrados' }, 409)
    }

    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})


/* =====================
  POST /sessions - Crear una nueva sesión (login)
  Crea una nueva sesión de usuario y devuelve un token JWT
===================== */
const loginBody = z.object({
  identifier: z.string().min(1, 'El identificador es obligatorio').describe('Nombre de usuario o correo electrónico'),
  password: z.string().min(1, 'La contraseña es obligatoria').describe('Contraseña del usuario'),
})

const loginResp = z.object({
  access_token: z.string().describe('Token de acceso JWT para autenticación'),
  token_type: z.literal('Bearer').describe('Tipo de token de autenticación'),
  expires_in: z.number().nullable().describe('Tiempo de expiración del token en segundos'),
  user: baseUserSchema.describe('Información del usuario autenticado'),
})

auth.openapi(createRoute({
  method: 'post',
  path: '/sessions',
  tags: ['Authentication'],
  security: [], // Endpoint público - no requiere autenticación
  request: {
    body: {
      content: {
        'application/json': { schema: loginBody }
      }
    }
  },
  responses: {
    200: { description: 'Sesión creada exitosamente', content: { 'application/json': { schema: loginResp.describe('Respuesta con token de acceso y información del usuario') } } },
    400: { description: 'Datos inválidos - Verifique el identificador y contraseña', content: { 'application/json': { schema: validationErrorResponse } } },
    401: { description: 'Credenciales inválidas - Usuario o contraseña incorrectos', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const { identifier, password } = c.req.valid('json')

    // Validación previa
    if (!identifier || !password) {
      return c.json({ error: 'Faltan campos obligatorios (identifier y password)' }, 400)
    }

    // Buscar usuario por username o email
    const result = await query(
      `SELECT id,username,email,password,first_name,last_name,phone,role,status,created_at,updated_at,last_login_at 
       FROM ${SCHEMA}.users 
       WHERE username=$1 OR email=$1 
       LIMIT 1`,
      [identifier]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Usuario no encontrado o credenciales inválidas' }, 401)
    }

    const row = result.rows[0]

    // Comparar contraseñas
    const match = await bcrypt.compare(password, row.password)
    if (!match) {
      return c.json({ error: 'Contraseña incorrecta' }, 401)
    }

    // Actualizar último login
    await query(`UPDATE ${SCHEMA}.users SET last_login_at = NOW() WHERE id=$1`, [row.id])

    // Construir usuario de respuesta
    const user = {
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    }

    // Generar JWT
    const token = jwt.sign(
      { sub: row.username, uid: row.id, role: row.role },
      SECRET,
      { expiresIn: TOKEN_EXP }
    )
    const expiresIn = parseTokenExpToSeconds(TOKEN_EXP)



    // Publicar evento user.login
    try {
      await events.publish('user.login', {
        type: 'user.login',
        data: { id: row.id, username: row.username, email: row.email, role: row.role },
        meta: { ip: getRequestIp(c), timestamp: new Date().toISOString() }
      })
    } catch (err) {
      console.error('Error publicando evento user.login', err && err.message ? err.message : err)
    }

    return c.json({
      message: 'Sesión creada exitosamente',
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresIn,
      user
    }, 200)

  } catch (error) {
    console.error('Error al crear sesión:', error)
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})


/* =====================
  POST /codes - Solicitar código de verificación
  Envía un código de verificación al email proporcionado
===================== */
const forgotBody = z.object({
  email: z.string().email('Formato de email inválido').describe('Correo electrónico donde enviar el código'),
})
const forgotResp = z.object({
  message: z.string().describe('Mensaje de confirmación del envío del código')
})

auth.openapi(createRoute({
  method: 'post',
  path: '/codes',
  tags: ['Authentication'],
  security: [], // Endpoint público - no requiere autenticación
  request: {
    body: {
      content: {
        'application/json': { schema: forgotBody }
      }
    }
  },
  responses: {
    200: { description: 'Código enviado exitosamente', content: { 'application/json': { schema: forgotResp.describe('Respuesta con mensaje de confirmación del envío del código') } } },
    400: { description: 'Datos inválidos - Verifique el formato del email', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Error interno del servidor', content: { 'application/json': { schema: errorResponse } } }
  },
}), async (c) => {
  try {
    const { email } = c.req.valid('json')

    if (!email) {
      return c.json({ error: 'El campo email es obligatorio' }, 400)
    }

    const res = await query(
      `SELECT id FROM ${SCHEMA}.users WHERE email=$1 LIMIT 1`,
      [email]
    )

    if (res.rows.length > 0) {
      const userId = res.rows[0].id
      const token = crypto.randomBytes(32).toString('hex')

      await query(
        `INSERT INTO ${SCHEMA}.password_resets (id,user_id,token,expires_at)
         VALUES (uuid_generate_v4(), $1, $2, NOW() + interval '1 hour')`,
        [userId, token]


      )

      // Aquí normalmente iría un servicio de envío de correo
      console.log(`[auth] Token de reseteo para ${email}: ${token}`)

      // Publicar evento password.reset.requested
      try {
        await events.publish('password.reset.requested', {
          type: 'password.reset.requested',
          data: { userId, email, token },
          meta: { ip: getRequestIp(c), timestamp: new Date().toISOString() }
        })
      } catch (err) {
        console.error('Error publicando evento password.reset.requested', err && err.message ? err.message : err)
      }
    }

    // Seguridad: nunca revelar si el email existe o no
    return c.json({
      message: 'Si el email existe, recibirás instrucciones de recuperación'
    }, 200)

  } catch (error) {
    console.error('Error en forgot password:', error)
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
})

export default auth
