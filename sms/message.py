from flask import Flask, request, jsonify
from datetime import datetime
import os
import psutil
import pika
import json
import sys
import logging
import re
from twilio.rest import Client
from twilio.base.exceptions import TwilioException

app = Flask(__name__)

# Configurar logging estructurado
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter('%(message)s')
handler.setFormatter(formatter)

logger = logging.getLogger('sms.http')
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(handler)

def log_json(level, message, payload=None, meta=None, logger_name='sms.http'):
    """Structured JSON logger"""
    rec = {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'level': level,
        'service': 'sms',
        'host': os.environ.get('HOSTNAME') or None,
        'pid': os.getpid(),
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

# Global variables
START_TIME = datetime.utcnow()
VERSION = "1.0.0"
RABBIT_URL = os.environ.get('RABBITMQ_URL', 'amqp://admin:securepass@rabbitmq:5672')
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')
PORT = int(os.environ.get('MESSAGING_PORT', 6379))

# Initialize Twilio client
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except Exception as e:
        log_json('ERROR', 'Failed to initialize Twilio client', payload={'error': str(e)})

def get_uptime():
    """Calculate service uptime"""
    delta = datetime.utcnow() - START_TIME
    days = delta.days
    hours, remainder = divmod(delta.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{days}d {hours}h {minutes}m {seconds}s"

def check_rabbitmq():
    """Check RabbitMQ connectivity"""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBIT_URL))
        connection.close()
        return True, "connected"
    except Exception as e:
        return False, f"disconnected: {str(e)}"

def check_twilio():
    """Check Twilio configuration and connectivity"""
    if not twilio_client:
        return False, "not_configured"
    try:
        # Try to fetch account info as a connectivity test
        account = twilio_client.api.accounts(TWILIO_ACCOUNT_SID).fetch()
        return True, "connected"
    except Exception as e:
        return False, f"error: {str(e)}"

def get_memory_info():
    """Get memory usage information"""
    process = psutil.Process()
    mem_info = process.memory_info()
    return {
        "rss": f"{mem_info.rss / (1024 * 1024):.2f} MB",
        "vms": f"{mem_info.vms / (1024 * 1024):.2f} MB"
    }

def validate_phone_number(phone):
    """Validate phone number format"""
    pattern = r'^\+[1-9]\d{1,14}$'
    return re.match(pattern, phone) is not None

def format_phone_number(phone):
    """Format phone number to international format"""
    phone = re.sub(r'[^\d+]', '', phone)
    if not phone.startswith('+'):
        phone = '+57' + phone  # Default to Colombia
    return phone

@app.route('/health', methods=['GET'])
def health():
    """Complete health check with all verifications"""
    rabbit_ok, rabbit_status = check_rabbitmq()
    twilio_ok, twilio_status = check_twilio()
    
    checks = [
        {
            "name": "Readiness check",
            "status": "UP" if (rabbit_ok and twilio_ok) else "DOWN",
            "data": {
                "from": START_TIME.isoformat() + "Z",
                "status": "READY" if (rabbit_ok and twilio_ok) else "NOT_READY",
                "version": VERSION,
                "uptime": get_uptime()
            }
        },
        {
            "name": "Liveness check",
            "status": "UP",
            "data": {
                "from": START_TIME.isoformat() + "Z",
                "status": "ALIVE",
                "version": VERSION,
                "uptime": get_uptime()
            }
        },
        {
            "name": "RabbitMQ check",
            "status": "UP" if rabbit_ok else "DOWN",
            "data": {
                "status": rabbit_status
            }
        },
        {
            "name": "Twilio check",
            "status": "UP" if twilio_ok else "DOWN",
            "data": {
                "status": twilio_status
            }
        }
    ]
    
    all_up = all(check["status"] == "UP" for check in checks)
    
    response = {
        "status": "UP" if all_up else "DOWN",
        "checks": checks
    }
    
    log_json('INFO', 'Health check', payload={'status': response['status']})
    return jsonify(response), 200 if all_up else 503

@app.route('/health/ready', methods=['GET'])
def health_ready():
    """Readiness probe - checks if service can accept traffic"""
    rabbit_ok, rabbit_status = check_rabbitmq()
    twilio_ok, twilio_status = check_twilio()
    
    ready = rabbit_ok and twilio_ok
    
    response = {
        "status": "UP" if ready else "DOWN",
        "checks": [
            {
                "name": "Readiness check",
                "status": "UP" if ready else "DOWN",
                "data": {
                    "from": START_TIME.isoformat() + "Z",
                    "status": "READY" if ready else "NOT_READY",
                    "version": VERSION,
                    "uptime": get_uptime(),
                    "rabbitmq": rabbit_status,
                    "twilio": twilio_status
                }
            }
        ]
    }
    
    return jsonify(response), 200 if ready else 503

@app.route('/health/live', methods=['GET'])
def health_live():
    """Liveness probe - checks if service is alive"""
    response = {
        "status": "UP",
        "checks": [
            {
                "name": "Liveness check",
                "status": "UP",
                "data": {
                    "from": START_TIME.isoformat() + "Z",
                    "status": "ALIVE",
                    "version": VERSION,
                    "uptime": get_uptime(),
                    "memory": get_memory_info()
                }
            }
        ]
    }
    
    return jsonify(response), 200

if __name__ == '__main__':
    # Verify Twilio configuration
    if not twilio_client:
        log_json('WARN', 'Starting without Twilio configuration - SMS endpoints will fail')

    log_json('INFO', 'Starting SMS Health Check service', payload={'port': PORT, 'version': VERSION})
    app.run(host='0.0.0.0', port=PORT, debug=False)
