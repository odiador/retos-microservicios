from flask import Flask, request, jsonify
import os
from twilio.rest import Client
from twilio.base.exceptions import TwilioException
import logging
import re
from dotenv import load_dotenv
import sys
import json

app = Flask(__name__)

# Configurar logging para enviar a STDOUT y añadir etiqueta de servicio
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter('%(message)s')
handler.setFormatter(formatter)

logger = logging.getLogger('sms.http')
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(handler)

def log_json(level, message, payload=None, meta=None, logger_name='sms.http'):
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

# Load environment variables from .env file only if --use-env flag is provided
if len(sys.argv) > 1 and sys.argv[1] == '--use-env':
    load_dotenv()

TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
PORT = int(os.environ.get('MESSAGING_PORT', 6379))


twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

def validate_phone_number(phone):
    """Validar formato de número de teléfono"""
    pattern = r'^\+[1-9]\d{1,14}$'
    return re.match(pattern, phone) is not None

def format_phone_number(phone):
    """Formatear número de teléfono"""
    phone = re.sub(r'[^\d+]', '', phone)

    if not phone.startswith('+'):
        phone = '+57' + phone  
    
    return phone

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de salud del servicio"""
    return jsonify({
        'status': 'healthy',
        'service': 'notification-service',
        'version': '1.0.0'
    })

@app.route('/notifications/sms', methods=['POST'])
def send_sms():
    """Enviar SMS usando Twilio"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        phone = data.get('phone')
        message = data.get('message')
        
        if not phone or not message:
            return jsonify({
                'error': 'Phone and message are required',
                'required_fields': ['phone', 'message']
            }), 400
        
        # Formatear y validar número de teléfono
        formatted_phone = format_phone_number(phone)
        
        if not validate_phone_number(formatted_phone):
            return jsonify({
                'error': 'Invalid phone number format',
                'format': 'Use international format: +1234567890'
            }), 400
        
        # Validar longitud del mensaje
        if len(message) > 1600:  # Límite de SMS
            return jsonify({
                'error': 'Message too long',
                'max_length': 1600,
                'current_length': len(message)
            }), 400
        
        # Enviar SMS con Twilio
        twilio_message = twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=formatted_phone
        )

        log_json('INFO', 'SMS sent successfully', payload={'sid': getattr(twilio_message, 'sid', None), 'to': formatted_phone})

        return jsonify({
            'success': True,
            'message': 'SMS sent successfully',
            'data': {
                'message_sid': twilio_message.sid,
                'to': formatted_phone,
                'status': twilio_message.status
            }
        }), 200
        
    except TwilioException as e:
        log_json('ERROR', 'Twilio error', payload={'error': str(e)})
        return jsonify({
            'error': 'Failed to send SMS',
            'details': str(e)
        }), 500
        
    except Exception as e:
        log_json('ERROR', 'Unexpected error', payload={'error': str(e)})
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/notifications/sms/<message_sid>', methods=['GET'])
def get_sms_status(message_sid):
    """Consultar estado de un SMS enviado"""
    try:
        message = twilio_client.messages(message_sid).fetch()
        
        return jsonify({
            'success': True,
            'data': {
                'sid': message.sid,
                'status': message.status,
                'to': message.to,
                'from': message.from_,
                'body': message.body,
                'date_created': message.date_created.isoformat() if message.date_created else None,
                'date_sent': message.date_sent.isoformat() if message.date_sent else None,
                'error_code': message.error_code,
                'error_message': message.error_message
            }
        })
        
    except TwilioException as e:
        log_json('ERROR', 'Twilio error getting message status', payload={'error': str(e)})
        return jsonify({
            'error': 'Failed to get message status',
            'details': str(e)
        }), 500
        
    except Exception as e:
        log_json('ERROR', 'Unexpected error getting message status', payload={'error': str(e)})
        return jsonify({
            'error': 'Internal server error'
        }), 500

if __name__ == '__main__':
    # Verificar configuración de Twilio
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        log_json('ERROR', 'Twilio credentials not configured properly')
        exit(1)
    
    log_json('INFO', 'Starting Notification Service', payload={'port': PORT})
    app.run(host='0.0.0.0', port=PORT, debug=False)