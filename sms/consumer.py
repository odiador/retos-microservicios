import pika
import json
import os
import sys
from twilio.rest import Client
from twilio.base.exceptions import TwilioException
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración RabbitMQ
RABBIT_URL = os.environ.get('RABBITMQ_URL', 'amqp://admin:securepass@rabbitmq:5672')
EXCHANGE = os.environ.get('AUTH_EVENTS_EXCHANGE', 'auth.events')
QUEUE = os.environ.get('MESSAGING_SMS_QUEUE', 'messaging.sms.queue')
ROUTING_KEY = os.environ.get('SEND_SMS_ROUTING_KEY', 'send.sms')

# Configuración Twilio
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

# Inicializar cliente Twilio solo si las credenciales están configuradas
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    logger.info("[sms-consumer] Twilio configurado correctamente")
else:
    logger.warning("[sms-consumer] Twilio no configurado - solo se logearán los SMS")

def handle_sms_message(body):
    """Procesar mensaje de SMS desde RabbitMQ"""
    try:
        event_data = json.loads(body)
        logger.info(f"[sms-consumer] Procesando SMS: {event_data}")
        
        recipient = event_data.get('recipient')
        message = event_data.get('message')
        event_type = event_data.get('type')
        
        if not recipient or not message:
            logger.error(f"[sms-consumer] Datos incompletos - recipient: {recipient}, message: {message}")
            return
        
        # Si Twilio no está configurado, solo logear
        if not twilio_client:
            logger.info(f"[sms-consumer] SMS simulado a {recipient}: {message}")
            return
        
        # Validar formato del número de teléfono
        if not recipient.startswith('+'):
            logger.warning(f"[sms-consumer] Número sin formato internacional: {recipient}")
            recipient = '+57' + recipient.lstrip('+0')  # Agregar código de Colombia por defecto
        
        # Enviar SMS real con Twilio
        try:
            response = twilio_client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=recipient
            )
            logger.info(f"[sms-consumer] SMS enviado exitosamente a {recipient}, SID: {response.sid}")
            
        except TwilioException as e:
            logger.error(f"[sms-consumer] Error de Twilio enviando SMS a {recipient}: {str(e)}")
        except Exception as e:
            logger.error(f"[sms-consumer] Error inesperado enviando SMS a {recipient}: {str(e)}")
            
    except json.JSONDecodeError as e:
        logger.error(f"[sms-consumer] Error parseando JSON: {str(e)}")
    except Exception as e:
        logger.error(f"[sms-consumer] Error procesando mensaje: {str(e)}")

def callback(ch, method, properties, body):
    """Callback para procesar mensajes de RabbitMQ"""
    try:
        logger.info(f"[sms-consumer] Mensaje recibido: {body.decode()}")
        handle_sms_message(body.decode())
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f"[sms-consumer] Error en callback: {str(e)}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def start_consumer():
    """Iniciar consumer de RabbitMQ para SMS"""
    try:
        # Conectar a RabbitMQ
        logger.info(f"[sms-consumer] Conectando a RabbitMQ: {RABBIT_URL}")
        connection = pika.BlockingConnection(pika.URLParameters(RABBIT_URL))
        channel = connection.channel()
        
        # Declarar exchange y queue
        channel.exchange_declare(exchange=EXCHANGE, exchange_type='topic', durable=True, auto_delete=False)
        channel.queue_declare(queue=QUEUE, durable=True)
        channel.queue_bind(exchange=EXCHANGE, queue=QUEUE, routing_key=ROUTING_KEY)
        
        # Configurar consumer
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=QUEUE, on_message_callback=callback)
        
        logger.info(f'[sms-consumer] Esperando mensajes de SMS en queue {QUEUE}. Para salir presiona CTRL+C')
        channel.start_consuming()
        
    except pika.exceptions.AMQPConnectionError as e:
        logger.error(f"[sms-consumer] Error conectando a RabbitMQ: {str(e)}")
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info('[sms-consumer] Detenido por usuario')
        try:
            channel.stop_consuming()
            connection.close()
        except:
            pass
        sys.exit(0)
    except Exception as e:
        logger.error(f"[sms-consumer] Error inesperado: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    start_consumer()
