import amqplib from 'amqplib'

const RABBIT_URL = process.env.RABBITMQ_URL || `amqp://${process.env.rabbitmq_user || 'guest'}:${process.env.rabbitmq_pass || 'guest'}@rabbitmq:5672`;

let channel = null

async function connect() {
  if (channel) return channel
  try {
    const conn = await amqplib.connect(RABBIT_URL)
    channel = await conn.createChannel()
    await channel.assertExchange('events', 'topic', { durable: true })
    console.log('[events] Conectado a RabbitMQ')
    return channel
  } catch (err) {
    console.error('[events] Error conectando a RabbitMQ', err.message)
    throw err
  }
}

export async function publish(routingKey, payload = {}) {
  try {
    const ch = await connect()
    const buf = Buffer.from(JSON.stringify(payload))
    ch.publish('events', routingKey, buf, { persistent: true })
    console.log(`[events] Publicado ${routingKey}`)
    return true
  } catch (err) {
    console.error('[events] Error publicando evento', err.message)
    return false
  }
}

export default { connect, publish }
