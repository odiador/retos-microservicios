import amqplib from 'amqplib';
import twilio from 'twilio';

const RABBIT_URL = process.env.RABBITMQ_URL || `amqp://${process.env.rabbitmq_user || 'guest'}:${process.env.rabbitmq_pass || 'guest'}@rabbitmq:5672`;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function startConsumer() {
  try {
    const conn = await amqplib.connect(RABBIT_URL);
    const ch = await conn.createChannel();

    await ch.assertExchange('events', 'topic', { durable: true });
    const q = await ch.assertQueue('sms_notifications', { durable: true });
    await ch.bindQueue(q.queue, 'events', 'messaging.sms');

    console.log('[consumer-messaging] Escuchando en routingKey "messaging.sms"');

    ch.consume(q.queue, async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        const { phone, message } = content;

        if (!phone || !message) {
          console.error('[consumer-messaging] Datos incompletos:', content);
          ch.ack(msg);
          return;
        }

        // Enviar SMS con Twilio
        const response = await client.messages.create({
          body: message,
          from: TWILIO_PHONE_NUMBER,
          to: phone
        });

        console.log(`[consumer-messaging] SMS enviado a ${phone}, SID: ${response.sid}`);
      } catch (err) {
        console.error('[consumer-messaging] Error procesando mensaje:', err.message);
      }
      ch.ack(msg);
    });
  } catch (err) {
    console.error('[consumer-messaging] Error conectando a RabbitMQ:', err.message);
    process.exit(1);
  }
}

startConsumer();
