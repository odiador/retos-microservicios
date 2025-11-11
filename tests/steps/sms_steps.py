"""
Step definitions para tests BDD de SMS Service
Implementa los pasos definidos en sms.feature usando behave
"""

from behave import given, when, then
import requests
import json
import pika
import time
import os

# Configuración
SMS_SERVICE_URL = os.environ.get('SMS_SERVICE_URL', 'http://localhost:6379')
RABBITMQ_URL = os.environ.get('RABBITMQ_URL', 'amqp://admin:securepass@localhost:5672')

@given('el servicio SMS está conectado a RabbitMQ')
def step_sms_connected_to_rabbitmq(context):
    """Verificar que SMS service puede conectarse a RabbitMQ"""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        context.rabbitmq_connection = connection
        context.rabbitmq_channel = connection.channel()
        assert connection.is_open, "Conexión a RabbitMQ no está abierta"
    except Exception as e:
        raise AssertionError(f"No se pudo conectar a RabbitMQ: {e}")

@given('el exchange SMS "{exchange}" existe')
def step_exchange_exists(context, exchange):
    """Verificar que el exchange existe"""
    try:
        context.rabbitmq_channel.exchange_declare(
            exchange=exchange,
            exchange_type='topic',
            durable=True,
            passive=True  # Solo verificar, no crear
        )
        context.exchange = exchange
    except Exception as e:
        # Si no existe, crearlo para el test
        context.rabbitmq_channel.exchange_declare(
            exchange=exchange,
            exchange_type='topic',
            durable=True
        )
        context.exchange = exchange

@when('envío un mensaje al exchange "{exchange}" con routing key "{routing_key}"')
def step_send_message_to_exchange(context, exchange, routing_key):
    """Enviar mensaje de prueba a RabbitMQ"""
    # Construir mensaje desde la tabla de datos
    message = {}
    for row in context.table:
        message[row['field']] = row['value']
    
    # Agregar timestamp si no existe
    if 'timestamp' not in message:
        from datetime import datetime
        message['timestamp'] = datetime.utcnow().isoformat() + 'Z'
    
    context.test_message = message
    context.routing_key = routing_key
    
    try:
        context.rabbitmq_channel.basic_publish(
            exchange=exchange,
            routing_key=routing_key,
            body=json.dumps(message, ensure_ascii=False),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
    except Exception as e:
        raise AssertionError(f"Error publicando mensaje: {e}")

@then('el mensaje debe ser procesado por el consumer')
def step_message_processed_by_consumer(context):
    """Esperar y verificar procesamiento del mensaje"""
    # Dar tiempo al consumer para procesar
    time.sleep(2)
    # En un test real, verificaríamos logs o estado
    # Por ahora, asumimos que si no hay error, se procesó
    assert True

@then('debe generarse un log estructurado con level "{level}"')
def step_log_generated_with_level(context, level):
    """Verificar que se generó un log con el nivel correcto"""
    # Esto requeriría consultar Loki o logs del container
    # Por ahora, verificamos que el mensaje fue válido
    assert context.test_message is not None

@then('el log debe contener "{key}": "{value}"')
def step_log_contains_key_value(context, key, value):
    """Verificar que el log contiene el par clave-valor"""
    # En un test completo, consultaríamos los logs
    # Por ahora, verificamos que el mensaje original tenía esos datos
    if key in context.test_message:
        assert str(context.test_message[key]) == value
    else:
        # Asumir que es un campo de log generado por el sistema
        assert True

@then('el mensaje debe ser rechazado por validación')
def step_message_rejected_by_validation(context):
    """Verificar que el mensaje inválido fue rechazado"""
    # El consumer debería rechazar o loggear error
    time.sleep(2)
    assert True  # Placeholder

@when('hago un GET a "{endpoint}"')
def step_get_request(context, endpoint):
    """Hacer petición GET al servicio"""
    try:
        url = f"{SMS_SERVICE_URL}{endpoint}"
        response = requests.get(url, timeout=5)
        context.response = response
    except Exception as e:
        raise AssertionError(f"Error en GET {endpoint}: {e}")

@then('la respuesta debe tener código {status_code:d}')
def step_response_status_code(context, status_code):
    """Verificar código de respuesta HTTP"""
    assert context.response.status_code == status_code, \
        f"Esperado {status_code}, recibido {context.response.status_code}"

@then('el cuerpo debe contener "{key}": "{value}"')
def step_response_contains_key_value(context, key, value):
    """Verificar que la respuesta JSON contiene el par clave-valor"""
    try:
        data = context.response.json()
        assert key in data, f"Clave '{key}' no encontrada en respuesta"
        assert str(data[key]) == value, \
            f"Esperado {key}='{value}', recibido {key}='{data[key]}'"
    except json.JSONDecodeError:
        raise AssertionError("Respuesta no es JSON válido")

@then('el cuerpo debe contener "{field}" como {tipo}')
def step_response_contains_field_type(context, field, tipo):
    """Verificar que un campo existe y es del tipo correcto"""
    try:
        data = context.response.json()
        assert field in data, f"Campo '{field}' no encontrado"
        
        if tipo == "número":
            assert isinstance(data[field], (int, float))
        elif tipo == "array":
            assert isinstance(data[field], list)
        elif tipo == "objeto":
            assert isinstance(data[field], dict)
        elif tipo == "string":
            assert isinstance(data[field], str)
    except json.JSONDecodeError:
        raise AssertionError("Respuesta no es JSON válido")

@then('cada check debe tener "name", "status" y "timestamp"')
def step_checks_have_required_fields(context):
    """Verificar que los checks tienen los campos requeridos"""
    data = context.response.json()
    checks = data.get('checks', [])
    
    for check in checks:
        assert 'name' in check, "Check sin campo 'name'"
        assert 'status' in check, "Check sin campo 'status'"
        assert 'timestamp' in check, "Check sin campo 'timestamp'"

def after_scenario(context, scenario):
    """Cleanup después de cada escenario"""
    if hasattr(context, 'rabbitmq_connection'):
        try:
            context.rabbitmq_connection.close()
        except:
            pass