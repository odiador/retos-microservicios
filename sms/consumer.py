import pika
import json
import os
import sys
from twilio.rest import Client
from twilio.base.exceptions import TwilioException
import logging
import sys

# Configurar logging para enviar a STDOUT y añadir etiqueta de servicio
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter('%(message)s')
handler.setFormatter(formatter)

logger = logging.getLogger('sms')
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(handler)

def log_json(level, message, payload=None, meta=None, logger_name='sms'):
    rec = {
        'timestamp': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'level': level,
        'service': 'sms',
        'host': os.environ.get('HOSTNAME') or None,
        'logger': logger_name,
        'message': message
    }
    if payload is not None:
        rec['payload'] = payload
    if meta:
        rec['meta'] = meta
    json_msg = json.dumps(rec, default=str, ensure_ascii=False)
    if level == 'INFO':
        logger.info(json_msg)
    elif level == 'WARN':
        logger.warning(json_msg)
    elif level == 'ERROR':
        logger.error(json_msg)
    else:
        logger.debug(json_msg)

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
    log_json('INFO', 'Twilio configurado correctamente')
else:
    log_json('WARN', 'Twilio no configurado - solo se logearan los SMS')

def handle_sms_message(body):
    """Procesar mensaje de SMS desde RabbitMQ"""
    try:
        event_data = json.loads(body)
        log_json('INFO', 'Procesando SMS', payload=event_data)

        recipient = event_data.get('recipient')
        message = event_data.get('message')
        event_type = event_data.get('type')

        if not recipient or not message:
            log_json('ERROR', 'Datos incompletos', payload={'recipient': recipient, 'message': message})
            return

        # Si Twilio no está configurado, solo logear
        if not twilio_client:
            log_json('INFO', 'SMS simulado', payload={'to': recipient, 'message': message})
            return

        # Validar formato del número de teléfono
        if not recipient.startswith('+'):
            log_json('WARN', 'Número sin formato internacional', payload={'recipient': recipient})
            recipient = '+57' + recipient.lstrip('+0')  # Agregar código de Colombia por defecto

        # Enviar SMS real con Twilio
        try:
            response = twilio_client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=recipient
            )
            log_json('INFO', 'SMS enviado exitosamente', payload={'to': recipient, 'sid': getattr(response, 'sid', None)})

        except TwilioException as e:
            log_json('ERROR', 'Error de Twilio enviando SMS', payload={'to': recipient, 'error': str(e)})
        except Exception as e:
            log_json('ERROR', 'Error inesperado enviando SMS', payload={'to': recipient, 'error': str(e)})

    except json.JSONDecodeError as e:
        log_json('ERROR', 'Error parseando JSON', payload={'error': str(e), 'body': body})
    except Exception as e:
        log_json('ERROR', 'Error procesando mensaje', payload={'error': str(e), 'body': body})

def callback(ch, method, properties, body):
    """Callback para procesar mensajes de RabbitMQ"""
    try:
        decoded = body.decode()
        log_json('INFO', 'Mensaje recibido', payload={'raw': decoded})
        handle_sms_message(decoded)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        log_json('ERROR', 'Error en callback', payload={'error': str(e)})
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def start_consumer():
    """Iniciar consumer de RabbitMQ para SMS"""
    try:
        # Conectar a RabbitMQ
        log_json('INFO', 'Conectando a RabbitMQ', payload={'url': RABBIT_URL})
        connection = pika.BlockingConnection(pika.URLParameters(RABBIT_URL))
        channel = connection.channel()
        
        # Declarar exchange y queue
        channel.exchange_declare(exchange=EXCHANGE, exchange_type='topic', durable=True, auto_delete=False)
        channel.queue_declare(queue=QUEUE, durable=True)
        channel.queue_bind(exchange=EXCHANGE, queue=QUEUE, routing_key=ROUTING_KEY)
        
        # Configurar consumer
        channel.basic_qos(prefetch_count=1)
        channel.basic_consume(queue=QUEUE, on_message_callback=callback)
        
        log_json('INFO', 'Esperando mensajes de SMS', payload={'queue': QUEUE})
        channel.start_consuming()
        
    except pika.exceptions.AMQPConnectionError as e:
        log_json('ERROR', 'Error conectando a RabbitMQ', payload={'error': str(e)})
        sys.exit(1)
    except KeyboardInterrupt:
        log_json('INFO', 'Detenido por usuario')
        try:
            channel.stop_consuming()
            connection.close()
        except:
            pass
        sys.exit(0)
    except Exception as e:
        log_json('ERROR', 'Error inesperado', payload={'error': str(e)})
        sys.exit(1)

if __name__ == '__main__':
    start_consumer()
