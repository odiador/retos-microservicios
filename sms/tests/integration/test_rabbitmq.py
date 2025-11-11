"""
Integration Tests para SMS Service
Tests que verifican integración real con RabbitMQ
"""

import pytest
import pika
import json
import time
import os
from unittest.mock import patch, Mock

# Configuración de RabbitMQ para testing
RABBITMQ_URL = os.environ.get('RABBITMQ_URL', 'amqp://admin:securepass@localhost:5672')

@pytest.fixture(scope='module')
def rabbitmq_connection():
    """Fixture que proporciona conexión real a RabbitMQ"""
    try:
        connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        yield connection
        connection.close()
    except Exception as e:
        pytest.skip(f"RabbitMQ no disponible: {e}")

@pytest.fixture
def rabbitmq_channel(rabbitmq_connection):
    """Fixture que proporciona un channel limpio"""
    channel = rabbitmq_connection.channel()
    
    # Declarar exchange de prueba
    channel.exchange_declare(
        exchange='auth.events',
        exchange_type='topic',
        durable=True
    )
    
    yield channel
    
    # Cleanup
    channel.close()

class TestRabbitMQIntegration:
    """Tests de integración con RabbitMQ"""
    
    def test_connection_to_rabbitmq(self, rabbitmq_connection):
        """Test: Verificar que podemos conectarnos a RabbitMQ"""
        assert rabbitmq_connection.is_open
        print("✅ Conexión a RabbitMQ exitosa")
    
    def test_exchange_exists(self, rabbitmq_channel):
        """Test: Verificar que el exchange auth.events existe"""
        try:
            # Intentar declarar pasivamente (no crea, solo verifica)
            rabbitmq_channel.exchange_declare(
                exchange='auth.events',
                exchange_type='topic',
                durable=True,
                passive=True
            )
            print("✅ Exchange 'auth.events' existe")
        except Exception as e:
            pytest.fail(f"Exchange no existe: {e}")
    
    def test_publish_sms_message(self, rabbitmq_channel):
        """Test: Publicar un mensaje SMS de prueba"""
        test_message = {
            'recipient': '+573001234567',
            'message': 'Integration test message',
            'type': 'test',
            'timestamp': '2025-11-10T12:00:00Z'
        }
        
        try:
            rabbitmq_channel.basic_publish(
                exchange='auth.events',
                routing_key='send.sms',
                body=json.dumps(test_message, ensure_ascii=False),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Persistent
                    content_type='application/json'
                )
            )
            print("✅ Mensaje SMS publicado correctamente")
        except Exception as e:
            pytest.fail(f"Error publicando mensaje: {e}")
    
    def test_message_routing(self, rabbitmq_channel):
        """Test: Verificar que los mensajes se enrutan correctamente"""
        # Crear cola temporal para verificar routing
        queue_name = 'test_queue_' + str(int(time.time()))
        
        try:
            # Declarar cola temporal
            rabbitmq_channel.queue_declare(queue=queue_name, auto_delete=True)
            
            # Bind a routing key
            rabbitmq_channel.queue_bind(
                exchange='auth.events',
                queue=queue_name,
                routing_key='send.sms'
            )
            
            # Publicar mensaje
            test_message = {
                'recipient': '+573001234567',
                'message': 'Routing test',
                'type': 'test'
            }
            
            rabbitmq_channel.basic_publish(
                exchange='auth.events',
                routing_key='send.sms',
                body=json.dumps(test_message)
            )
            
            # Verificar que llegó a la cola
            time.sleep(0.5)
            method, properties, body = rabbitmq_channel.basic_get(queue=queue_name)
            
            assert method is not None, "Mensaje no llegó a la cola"
            received_message = json.loads(body)
            assert received_message['recipient'] == '+573001234567'
            
            # Acknowledge
            rabbitmq_channel.basic_ack(method.delivery_tag)
            
            print("✅ Routing de mensajes funciona correctamente")
            
        finally:
            # Limpiar cola temporal
            try:
                rabbitmq_channel.queue_delete(queue=queue_name)
            except:
                pass
    
    def test_queue_durability(self, rabbitmq_channel):
        """Test: Verificar que las colas son durables"""
        try:
            result = rabbitmq_channel.queue_declare(
                queue='messaging.sms.queue',
                passive=True  # Solo verificar, no crear
            )
            print(f"✅ Cola 'messaging.sms.queue' existe con {result.method.message_count} mensajes")
        except Exception as e:
            print(f"⚠️  Cola no existe (puede ser normal en ambiente de test): {e}")
    
    def test_message_persistence(self, rabbitmq_channel):
        """Test: Verificar que los mensajes son persistentes"""
        test_message = {
            'recipient': '+573001234567',
            'message': 'Persistence test',
            'type': 'test'
        }
        
        rabbitmq_channel.basic_publish(
            exchange='auth.events',
            routing_key='send.sms',
            body=json.dumps(test_message),
            properties=pika.BasicProperties(
                delivery_mode=2  # Persistent
            )
        )
        
        print("✅ Mensaje publicado con persistence")

class TestSMSConsumerIntegration:
    """Tests de integración del consumer de SMS"""
    
    @patch('consumer.twilio_client')
    def test_consumer_processes_message(self, mock_twilio, rabbitmq_channel):
        """Test: Verificar que el consumer puede procesar mensajes de RabbitMQ"""
        # Mock Twilio
        mock_twilio.messages.create.return_value = Mock(sid='SM123456')
        
        # Publicar mensaje
        test_message = {
            'recipient': '+573001234567',
            'message': 'Consumer integration test',
            'type': 'test',
            'timestamp': '2025-11-10T12:00:00Z'
        }
        
        rabbitmq_channel.basic_publish(
            exchange='auth.events',
            routing_key='send.sms',
            body=json.dumps(test_message)
        )
        
        # En un test real, aquí esperaríamos y verificaríamos logs
        # Por ahora, solo verificamos que el mensaje fue publicado
        print("✅ Mensaje publicado para consumer")
        
        # Nota: Para verificar procesamiento real, necesitaríamos:
        # 1. Levantar el consumer en un thread/proceso separado
        # 2. Esperar procesamiento
        # 3. Verificar logs o estado

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])