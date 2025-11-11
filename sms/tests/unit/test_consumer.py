import pytest
import json
import pika
import time
from unittest.mock import Mock, patch
from consumer import handle_sms_message, log_json

class TestSMSConsumer:
    """Test suite for SMS consumer functionality"""

    def test_handle_sms_message_success(self):
        """Test successful SMS processing"""
        with patch('consumer.twilio_client') as mock_twilio:
            mock_message = Mock()
            mock_message.sid = 'SM123456789'
            mock_message.status = 'queued'
            mock_twilio.messages.create.return_value = mock_message

            test_data = {
                'recipient': '+573001234567',
                'message': 'Test SMS message',
                'type': 'notification'
            }

            handle_sms_message(json.dumps(test_data))

            # Verify Twilio was called correctly
            mock_twilio.messages.create.assert_called_once_with(
                body='Test SMS message',
                from_=None,  # Will be set from env
                to='+573001234567'
            )

    def test_handle_sms_message_missing_data(self):
        """Test handling of incomplete message data"""
        with patch('consumer.log_json') as mock_log:
            # Test missing recipient
            incomplete_data = {
                'message': 'Test message'
            }

            handle_sms_message(json.dumps(incomplete_data))

            # Verify error was logged
            mock_log.assert_called_with(
                'ERROR',
                'Datos incompletos',
                payload={'recipient': None, 'message': 'Test message'}
            )

    def test_handle_sms_message_phone_formatting(self):
        """Test automatic phone number formatting"""
        with patch('consumer.twilio_client') as mock_twilio, \
             patch('consumer.log_json') as mock_log:

            mock_message = Mock()
            mock_message.sid = 'SM123456789'
            mock_twilio.messages.create.return_value = mock_message

            # Test Colombian number without +57
            test_data = {
                'recipient': '3001234567',
                'message': 'Test message'
            }

            handle_sms_message(json.dumps(test_data))

            # Verify phone was formatted and warning logged
            mock_log.assert_any_call(
                'WARN',
                'Número sin formato internacional',
                payload={'recipient': '3001234567'}
            )

            # Verify Twilio called with formatted number
            mock_twilio.messages.create.assert_called_once()
            call_args = mock_twilio.messages.create.call_args[1]
            assert call_args['to'] == '+573001234567'

    def test_handle_sms_message_twilio_error(self):
        """Test handling of Twilio API errors"""
        from twilio.base.exceptions import TwilioException

        with patch('consumer.twilio_client') as mock_twilio, \
             patch('consumer.log_json') as mock_log:

            mock_twilio.messages.create.side_effect = TwilioException('API Error')

            test_data = {
                'recipient': '+573001234567',
                'message': 'Test message'
            }

            handle_sms_message(json.dumps(test_data))

            # Verify error was logged
            mock_log.assert_called_with(
                'ERROR',
                'Error de Twilio enviando SMS',
                payload={'to': '+573001234567', 'error': 'API Error'}
            )

    def test_handle_sms_message_invalid_json(self):
        """Test handling of malformed JSON"""
        with patch('consumer.log_json') as mock_log:
            invalid_json = '{"recipient": "+573001234567", "message": "test"'  # Missing closing brace

            handle_sms_message(invalid_json)

            # Verify JSON parse error was logged
            mock_log.assert_called_with(
                'ERROR',
                'Error parseando JSON',
                payload={'error': mock_log.call_args[1]['payload']['error'], 'body': invalid_json}
            )

    @pytest.mark.integration
    def test_rabbitmq_integration(self):
        """Integration test with actual RabbitMQ"""
        # This test requires a running RabbitMQ instance
        connection = pika.BlockingConnection(pika.URLParameters('amqp://admin:securepass@rabbitmq:5672'))
        channel = connection.channel()

        # Declare test exchange and queue
        test_exchange = 'test.sms.exchange'
        test_queue = 'test.sms.queue'
        test_routing_key = 'test.sms'

        channel.exchange_declare(exchange=test_exchange, exchange_type='topic')
        channel.queue_declare(queue=test_queue)
        channel.queue_bind(exchange=test_exchange, queue=test_queue, routing_key=test_routing_key)

        # Send test message
        test_message = {
            'recipient': '+573001234567',
            'message': 'Integration test SMS',
            'type': 'test'
        }

        channel.basic_publish(
            exchange=test_exchange,
            routing_key=test_routing_key,
            body=json.dumps(test_message)
        )

        # Clean up
        channel.queue_delete(queue=test_queue)
        channel.exchange_delete(exchange=test_exchange)
        connection.close()
