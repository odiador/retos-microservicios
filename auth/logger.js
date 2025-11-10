// Structured JSON logger for auth service
import util from 'node:util'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase()
const SERVICE_NAME = process.env.SERVICE_NAME || 'auth'
const HOST = process.env.HOSTNAME || null
const PID = process.pid

const levels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

let currentLevel = typeof levels[LOG_LEVEL] !== 'undefined' ? levels[LOG_LEVEL] : levels.INFO

function safeStringify(obj) {
  const seen = new WeakSet()
  return JSON.stringify(obj, function (key, value) {
    // Replace circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    if (typeof value === 'bigint') return value.toString()
    return value
  })
}

function serializeError(err) {
  if (!err) return null
  return {
    name: err.name,
    message: err.message,
    stack: err.stack
  }
}

function log(level, message, payload = null, meta = null) {
  if (typeof levels[level] === 'undefined') level = 'INFO'
  if (levels[level] < currentLevel) return

  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    host: HOST,
    pid: PID,
    logger: SERVICE_NAME,
    message
  }

  if (payload instanceof Error) {
    record.error = serializeError(payload)
  } else if (payload !== null) {
    record.payload = payload
  }

  if (meta) {
    // common meta fields like requestId are encouraged
    record.meta = meta
  }

  let jsonMsg
  try {
    jsonMsg = safeStringify(record)
  } catch (err) {
    // As a last resort, produce a minimally serializable message
    const fallback = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      message: String(message),
      fallback: util.inspect(record, { depth: 4 })
    }
    jsonMsg = JSON.stringify(fallback)
  }

  if (level === 'ERROR' || level === 'WARN') {
    console.error(jsonMsg)
  } else {
    console.log(jsonMsg)
  }
}

const logger = {
  setLevel: (lvl) => {
    const up = (lvl || '').toUpperCase()
    if (typeof levels[up] !== 'undefined') currentLevel = levels[up]
  },
  debug: (msg, payload = null, meta = null) => log('DEBUG', msg, payload, meta),
  info: (msg, payload = null, meta = null) => log('INFO', msg, payload, meta),
  warn: (msg, payload = null, meta = null) => log('WARN', msg, payload, meta),
  error: (msg, payload = null, meta = null) => log('ERROR', msg, payload, meta),
  levels
}

export default logger
