"""
Environment configuration for Behave BDD tests
Configura hooks y setup para los tests BDD
"""

import os
import sys

def before_all(context):
    """Setup antes de ejecutar todos los tests"""
    # Configurar variables de ambiente si no existen
    os.environ.setdefault('SMS_SERVICE_URL', 'http://localhost:6379')
    os.environ.setdefault('AUTH_URL', 'http://localhost:3500')
    os.environ.setdefault('ORCHESTRATOR_URL', 'http://localhost:8080')
    os.environ.setdefault('MONITOR_URL', 'http://localhost:8085')
    os.environ.setdefault('RABBITMQ_URL', 'amqp://admin:securepass@localhost:5672')
    os.environ.setdefault('LOKI_URL', 'http://localhost:3100')
    os.environ.setdefault('GRAFANA_URL', 'http://localhost:3000')
    
    print("=" * 80)
    print("🧪 Iniciando tests BDD")
    print("=" * 80)
    print(f"SMS Service: {os.environ['SMS_SERVICE_URL']}")
    print(f"Auth Service: {os.environ['AUTH_URL']}")
    print(f"Orchestrator: {os.environ['ORCHESTRATOR_URL']}")
    print(f"Monitor: {os.environ['MONITOR_URL']}")
    print(f"RabbitMQ: {os.environ['RABBITMQ_URL']}")
    print(f"Loki: {os.environ['LOKI_URL']}")
    print(f"Grafana: {os.environ['GRAFANA_URL']}")
    print("=" * 80)

def before_feature(context, feature):
    """Setup antes de cada feature"""
    print(f"\n🎯 Feature: {feature.name}")

def before_scenario(context, scenario):
    """Setup antes de cada escenario"""
    print(f"  📋 Scenario: {scenario.name}")

def after_scenario(context, scenario):
    """Cleanup después de cada escenario"""
    # Cerrar conexiones si existen
    if hasattr(context, 'rabbitmq_connection'):
        try:
            context.rabbitmq_connection.close()
        except:
            pass
    
    # Mostrar resultado
    if scenario.status == 'passed':
        print(f"  ✅ PASSED")
    elif scenario.status == 'failed':
        print(f"  ❌ FAILED: {scenario.error_message if hasattr(scenario, 'error_message') else ''}")
    elif scenario.status == 'skipped':
        print(f"  ⏭️  SKIPPED")

def after_feature(context, feature):
    """Cleanup después de cada feature"""
    pass

def after_all(context):
    """Cleanup después de todos los tests"""
    print("\n" + "=" * 80)
    print("🏁 Tests BDD completados")
    print("=" * 80)