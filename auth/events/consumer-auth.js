import amqplib from 'amqplib'

const RABBIT_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";

async function run() {
  const conn = await amqplib.connect(RABBIT_URL)
  const ch = await conn.createChannel()
  await ch.assertExchange('events', 'topic', { durable: true })

  const q = await ch.assertQueue('auth_queue', { durable: true })

  await ch.bindQueue(q.queue, 'events', 'user.login')
  await ch.bindQueue(q.queue, 'events', 'password.reset.requested')

  console.log('[auth-consumer] Esperando eventos de autenticación...')
  ch.consume(q.queue, (msg) => {
    if (!msg) return
    const content = JSON.parse(msg.content.toString())
    console.log('[auth-consumer] Evento:', msg.fields.routingKey, content)

    if (msg.fields.routingKey === 'user.login') {
      console.log('[auth-consumer] Registrar auditoría de login:', content.data)
    }

    if (msg.fields.routingKey === 'password.reset.requested') {
      console.log('[auth-consumer] Enviar email de recuperación a:', content.data.email)
    }

    ch.ack(msg)
  })
}

run()
