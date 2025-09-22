import amqplib from 'amqplib';

const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://admin:securepass@rabbitmq:5672';
const EXCHANGE = process.env.AUTH_EVENTS_EXCHANGE || 'auth.events';

let channel = null;

async function connect() {
  if (channel) return channel;
  try {
    const conn = await amqplib.connect(RABBIT_URL);
    channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true, autoDelete: false });
    console.log('[events] Conectado a RabbitMQ');
    return channel;
  } catch (err) {
    console.error('[events] Error conectando a RabbitMQ', err.message);
    throw err;
  }
}

async function publish(routingKey, payload = {}) {
  try {
    const ch = await connect();
    const buf = Buffer.from(JSON.stringify(payload));
    const result = await ch.publish(EXCHANGE, routingKey, buf, { persistent: true });
    console.log(`[events] Publicado ${routingKey}:`, JSON.stringify(payload, null, 2));
    return result;
  } catch (err) {
    console.error('[events] Error publicando evento', err.message);
    return false;
  }
}

export default { publish };