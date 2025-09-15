import amqplib from 'amqplib'

const RABBIT_URL = process.env.RABBITMQ_URL || `amqp://${process.env.rabbitmq_user || 'guest'}:${process.env.rabbitmq_pass || 'guest'}@rabbitmq:5672`;

async function run() {
  try {
    const conn = await amqplib.connect(RABBIT_URL)
    const ch = await conn.createChannel()
    await ch.assertExchange('events', 'topic', { durable: true })
    const q = await ch.assertQueue('', { exclusive: true })
    await ch.bindQueue(q.queue, 'events', '#')
    console.log('[consumer] Escuchando eventos en exchange "events" con routing "#"')
    ch.consume(q.queue, (msg) => {
      if (!msg) return
      try {
        const content = msg.content.toString()
        console.log('[consumer] Mensaje recibido:', msg.fields.routingKey, content)
      } catch (err) {
        console.error('[consumer] Error parsing message', err)
      }
      ch.ack(msg)
    })
  } catch (err) {
    console.error('[consumer] Error conectando a RabbitMQ', err.message)
    process.exit(1)
  }
}

run()
