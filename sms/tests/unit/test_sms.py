#!/usr/bin/env python3
"""
Script para testing del servicio SMS
Envía mensajes de prueba al bus RabbitMQ para verificar el funcionamiento
"""
import json
import pika
import sys
import os
from datetime import datetime

# Configuración RabbitMQ (igual que consumer.py)
RABBIT_URL = os.environ.get('RABBITMQ_URL', 'amqp://admin:securepass@rabbitmq:5672')
EXCHANGE = os.environ.get('AUTH_EVENTS_EXCHANGE', 'auth.events')
ROUTING_KEY = os.environ.get('SEND_SMS_ROUTING_KEY', 'send.sms')

def send_test_sms(recipient, message, test_type="manual_test"):
    """Enviar SMS de prueba al bus"""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBIT_URL))
        channel = connection.channel()

        # Declarar exchange (por si no existe)
        channel.exchange_declare(exchange=EXCHANGE, exchange_type='topic', durable=True, auto_delete=False)

        # Crear mensaje de prueba
        test_message = {
            'recipient': recipient,
            'message': message,
            'type': test_type,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'test_id': f"test_{int(datetime.utcnow().timestamp())}"
        }

        # Enviar mensaje
        channel.basic_publish(
            exchange=EXCHANGE,
            routing_key=ROUTING_KEY,
            body=json.dumps(test_message, ensure_ascii=False),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent message
                content_type='application/json'
            )
        )

        print(f"✅ Mensaje de prueba enviado:")
        print(f"   Para: {recipient}")
        print(f"   Mensaje: {message}")
        print(f"   Tipo: {test_type}")
        print(f"   Routing Key: {ROUTING_KEY}")

        connection.close()
        return True

    except Exception as e:
        print(f"❌ Error enviando mensaje de prueba: {e}")
        return False

def run_test_suite():
    """Ejecutar suite completa de pruebas"""
    print("🧪 Ejecutando suite de pruebas SMS...")

    # Pruebas unitarias
    print("\n📋 Ejecutando pruebas unitarias...")
    os.system("python -m pytest test_consumer.py -v")

    # Pruebas de cobertura
    print("\n📊 Generando reporte de cobertura...")
    os.system("python -m pytest test_consumer.py --cov=consumer --cov-report=xml --cov-report=html")

    # Pruebas de integración (si RabbitMQ está disponible)
    print("\n🔗 Ejecutando pruebas de integración...")
    if send_test_sms("+573001234567", "Mensaje de prueba de integración", "integration_test"):
        print("✅ Prueba de integración completada")
    else:
        print("❌ Prueba de integración fallida")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Uso:")
        print("  python test_sms.py <telefono> <mensaje>    # Enviar SMS de prueba")
        print("  python test_sms.py --run-tests              # Ejecutar suite completa")
        print("  python test_sms.py --sonar                  # Ejecutar para SonarQube")
        sys.exit(1)

    if sys.argv[1] == '--run-tests':
        run_test_suite()
    elif sys.argv[1] == '--sonar':
        # Configuración especial para SonarQube
        print("🎯 Ejecutando pruebas para SonarQube...")
        os.system("python -m pytest test_consumer.py --cov=consumer --cov-report=xml:coverage.xml --junitxml=test-results.xml -v")
    else:
        # Enviar SMS de prueba manual
        recipient = sys.argv[1]
        message = ' '.join(sys.argv[2:])
        send_test_sms(recipient, message, "manual_test")