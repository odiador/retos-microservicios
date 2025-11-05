// Structured JSON logger for auth service
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO'

const levels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

const currentLevel = levels[LOG_LEVEL] || levels.INFO

function log(level, message, payload = null, meta = null) {
  if (levels[level] < currentLevel) return

  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'auth',
    host: process.env.HOSTNAME || null,
    logger: 'auth',
    message
  }

  if (payload !== null) {
    record.payload = payload
  }

  if (meta) {
    record.meta = meta
  }

  const jsonMsg = JSON.stringify(record)
  
  if (level === 'ERROR') {
    console.error(jsonMsg)
  } else {
    console.log(jsonMsg)
  }
}

const logger = {
  debug: (msg, payload, meta) => log('DEBUG', msg, payload, meta),
  info: (msg, payload, meta) => log('INFO', msg, payload, meta),
  warn: (msg, payload, meta) => log('WARN', msg, payload, meta),
  error: (msg, payload, meta) => log('ERROR', msg, payload, meta)
}

export default logger
