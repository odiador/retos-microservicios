from flask import Flask, request, jsonify
import os
from twilio.rest import Client
from twilio.base.exceptions import TwilioException
import logging
import re
from dotenv import load_dotenv

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')
PORT = int(os.getenv('PORT', 3000))


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
        
        logger.info(f"SMS sent successfully. SID: {twilio_message.sid}, To: {formatted_phone}")
        
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
        logger.error(f"Twilio error: {str(e)}")
        return jsonify({
            'error': 'Failed to send SMS',
            'details': str(e)
        }), 500
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
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
        logger.error(f"Twilio error getting message status: {str(e)}")
        return jsonify({
            'error': 'Failed to get message status',
            'details': str(e)
        }), 500
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({
            'error': 'Internal server error'
        }), 500

if __name__ == '__main__':
    # Verificar configuración de Twilio
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        logger.error("Twilio credentials not configured properly")
        exit(1)
    
    logger.info(f"Starting Notification Service on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)