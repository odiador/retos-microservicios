import amqplib from 'amqplib'

const RABBIT_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";

async function run() {
  const conn = await amqplib.connect(RABBIT_URL)
  const ch = await conn.createChannel()
  await ch.assertExchange('events', 'topic', { durable: true })
  
  const q = await ch.assertQueue('orchestrator_queue', { durable: true })
  await ch.bindQueue(q.queue, 'events', 'orchestrator.*')

  console.log('[orchestrator] Esperando eventos...')
  ch.consume(q.queue, (msg) => {
    if (!msg) return
    console.log('[orchestrator] Evento recibido:', msg.fields.routingKey, msg.content.toString())
    ch.ack(msg)
  })
}

run()
