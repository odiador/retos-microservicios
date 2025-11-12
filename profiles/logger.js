/**
 * Simple structured logger for profiles service
 */

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const currentLevel = levels[process.env.LOG_LEVEL?.toLowerCase()] ?? levels.info

function log(level, message, meta = {}) {
  if (levels[level] < currentLevel) return

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    service: 'profiles',
    logger: 'profiles-service',
    message,
    ...meta
  }

  console.log(JSON.stringify(logEntry))
}

export default {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta)
}
