import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'retos',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASS || 'securepassword',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

/**
 * Execute a SQL query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export default async function query(text, params) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('[DB]', { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error('[DB Error]', { text, error: error.message })
    throw error
  }
}

export { pool }
