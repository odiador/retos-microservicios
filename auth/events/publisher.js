import amqplib from 'amqplib';
import logger from '../logger.js'

const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://admin:securepass@rabbitmq:5672';
const EXCHANGE = process.env.AUTH_EVENTS_EXCHANGE || 'auth.events';

let channel = null;

async function connect() {
  if (channel) return channel;
  try {
    const conn = await amqplib.connect(RABBIT_URL);
    channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true, autoDelete: false });
    logger.info('[events] Conectado a RabbitMQ');
    return channel;
  } catch (err) {
    logger.error('[events] Error conectando a RabbitMQ', err);
    throw err;
  }
}

async function publish(routingKey, payload = {}) {
  try {
    const ch = await connect();
    const buf = Buffer.from(JSON.stringify(payload));
    const result = await ch.publish(EXCHANGE, routingKey, buf, { persistent: true });
    logger.info(`[events] Publicado ${routingKey}: ${JSON.stringify(payload)}`);
    return result;
  } catch (err) {
    logger.error('[events] Error publicando evento', err);
    return false;
  }
}

export default { publish };