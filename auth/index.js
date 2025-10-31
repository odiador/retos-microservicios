
import { serve } from '@hono/node-server'
import { app } from './app.js'
import auth from './routes/auth.js'
import health from './routes/health.js'
import users from './routes/users.js'
import webhooks from './routes/webhooks.js'
import { swaggerUI } from '@hono/swagger-ui'
import db from './db.js'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Soporte para dotenv si la flag --use-env está presente
if (process.argv.includes('--use-env')) {
  try {
    const dotenv = await import('dotenv')
    dotenv.config()
    console.log('[dotenv] Variables de entorno cargadas desde .env')
  } catch (err) {
    console.error('[dotenv] Error al cargar dotenv:', err && err.message ? err.message : err)
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function ensureAdminUser() {
  const email = 'admin@gmail.com'
  const username = 'admin'
  const password = 'admin123'
  const SCHEMA = process.env.DB_SCHEMA || 'auth'
  try {
    const existing = await db(`SELECT id FROM ${SCHEMA}.users WHERE email=$1 OR username=$2 LIMIT 1`, [email, username])
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(password, 10)      
      await db(`INSERT INTO ${SCHEMA}.users (username,email,password,first_name,last_name,role,status) VALUES ($1,$2,$3,$4,$5,'admin','active')`, [username, email, hash, 'Admin', 'User'])
      console.log('[seed] Usuario admin creado: admin@gmail.com / admin123')
    } else {
      console.log('[seed] Usuario admin ya existe')
    }
  } catch (err) {
    console.error('[seed] Error creando usuario admin', err && err.message ? err.message : err)
  }
}

// Montar rutas
app.route('/', health)
app.route('/', auth)
app.route('/', users)
app.route('/', webhooks)

// Servir la documentación OpenAPI desde el archivo YAML estático
app.get('/doc', async (c) => {
  try {
    const yamlPath = path.join(__dirname, 'docs', 'api-docs.yaml')
    const yamlContent = fs.readFileSync(yamlPath, 'utf8')
    return c.text(yamlContent, 200, {
      'Content-Type': 'application/yaml'
    })
  } catch (error) {
    console.error('Error al servir la documentación:', error)
    return c.text('Error al cargar la documentación', 500)
  }
})


app.get(
  '/ui',
  swaggerUI({
    url: '/doc',
  })
)


app.notFound((c) => c.text('Recurso no encontrado', 404))

await ensureAdminUser()

serve({ fetch: app.fetch, port: 3500 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
},)
