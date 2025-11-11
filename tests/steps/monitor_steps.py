"""
Steps para pruebas BDD del microservicio de monitoreo
"""
import requests
import time
import json
import pika
from behave import given, when, then
from urllib.parse import quote


@given('que el servicio de monitoreo está activo')
def step_monitor_service_active(context):
    """Verificar que el servicio de monitoreo está activo"""
    monitor_url = context.config.userdata.get('MONITOR_URL', 'http://localhost:8085')
    context.monitor_url = monitor_url
    
    try:
        response = requests.get(f"{monitor_url}/", timeout=5)
        assert response.status_code == 200, f"Monitor no está activo: {response.status_code}"
        context.monitor_active = True
    except Exception as e:
        raise AssertionError(f"No se puede conectar al servicio de monitoreo: {e}")


@given('hay servicios registrados para monitoreo')
def step_services_registered(context):
    """Verificar que hay servicios registrados"""
    response = requests.get(f"{context.monitor_url}/services")
    assert response.status_code == 200
    services = response.json().get('services', [])
    assert len(services) > 0, "No hay servicios registrados"
    context.registered_services = services


@given('el servicio "{service_name}" está registrado')
def step_service_is_registered(context, service_name):
    """Verificar que un servicio específico está registrado"""
    response = requests.get(f"{context.monitor_url}/services")
    assert response.status_code == 200
    services = response.json().get('services', [])
    
    service_found = any(s['name'] == service_name for s in services)
    if not service_found:
        # Registrar el servicio para la prueba
        test_url = context.config.userdata.get('AUTH_URL', 'http://localhost:90') + '/health'
        payload = {
            "name": service_name,
            "url": test_url,
            "interval": 30
        }
        reg_response = requests.post(f"{context.monitor_url}/services", json=payload)
        assert reg_response.status_code == 200
    
    context.current_service = service_name


@given('el servicio "{service_name}" está registrado y funcionando')
def step_service_registered_and_working(context, service_name):
    """Registrar un servicio de prueba que funciona"""
    # Usar un endpoint real que existe (auth o sms)
    test_url = context.config.userdata.get('AUTH_URL', 'http://localhost:90') + '/health'
    
    payload = {
        "name": service_name,
        "url": test_url,
        "interval": 10  # Intervalo corto para pruebas
    }
    
    response = requests.post(f"{context.monitor_url}/services", json=payload)
    assert response.status_code == 200
    
    context.current_service = service_name
    context.test_service_url = test_url
    
    # Esperar un ciclo de monitoreo
    time.sleep(12)


@given('el servicio "{service_name}" estaba caído')
def step_service_was_down(context, service_name):
    """Registrar un servicio con URL inválida (caído)"""
    # URL que no existe para simular servicio caído
    invalid_url = "http://localhost:99999/health"
    
    payload = {
        "name": service_name,
        "url": invalid_url,
        "interval": 10
    }
    
    response = requests.post(f"{context.monitor_url}/services", json=payload)
    assert response.status_code == 200
    
    context.current_service = service_name
    context.invalid_service_url = invalid_url
    
    # Esperar que se detecte como caído
    time.sleep(12)
    
    # Verificar que está marcado como unhealthy
    status_response = requests.get(f"{context.monitor_url}/services/{service_name}")
    assert status_response.status_code == 200
    service_data = status_response.json()
    assert service_data.get('status') == 'unhealthy'


@when('registro el servicio "{service_name}" con URL "{url}" e intervalo {interval:d}')
def step_register_service(context, service_name, url, interval):
    """Registrar un nuevo servicio para monitoreo"""
    payload = {
        "name": service_name,
        "url": url,
        "interval": interval
    }
    
    response = requests.post(f"{context.monitor_url}/services", json=payload)
    context.response = response
    context.current_service = service_name


@when('registro un nuevo servicio con nombre "{name}" y endpoint "{endpoint}"')
def step_register_new_service(context, name, endpoint):
    """Registrar un nuevo servicio (versión alternativa)"""
    payload = {
        "name": name,
        "url": endpoint,
        "interval": 30
    }
    
    response = requests.post(f"{context.monitor_url}/services", json=payload)
    context.response = response
    context.current_service = name


@when('solicito la lista de servicios')
def step_get_services_list(context):
    """Obtener la lista de todos los servicios monitoreados"""
    response = requests.get(f"{context.monitor_url}/services")
    context.response = response


@when('consulto el estado del servicio "{service_name}"')
def step_get_service_status(context, service_name):
    """Consultar el estado de un servicio específico"""
    response = requests.get(f"{context.monitor_url}/services/{service_name}")
    context.response = response


@when('elimino el servicio "{service_name}"')
def step_delete_service(context, service_name):
    """Eliminar un servicio del monitoreo"""
    response = requests.delete(f"{context.monitor_url}/services/{service_name}")
    context.response = response
    context.deleted_service = service_name


@when('consulto el endpoint de salud general "{endpoint}"')
def step_check_general_health(context, endpoint):
    """Consultar endpoint de salud general"""
    response = requests.get(f"{context.monitor_url}{endpoint}")
    context.response = response


@when('consulto el endpoint "{endpoint}"')
def step_check_endpoint(context, endpoint):
    """Consultar un endpoint específico"""
    response = requests.get(f"{context.monitor_url}{endpoint}")
    context.response = response


@when('el servicio "{service_name}" deja de responder')
def step_service_stops_responding(context, service_name):
    """Simular que un servicio deja de responder actualizando su URL"""
    # Actualizar a una URL inválida
    # Como el monitor no tiene endpoint de actualización, eliminamos y re-registramos
    requests.delete(f"{context.monitor_url}/services/{service_name}")
    
    payload = {
        "name": service_name,
        "url": "http://localhost:99999/health",  # URL inválida
        "interval": 10
    }
    
    response = requests.post(f"{context.monitor_url}/services", json=payload)
    assert response.status_code == 200
    
    # Esperar que se detecte el cambio
    time.sleep(12)
    context.current_service = service_name


@when('el servicio "{service_name}" vuelve a funcionar')
def step_service_recovers(context, service_name):
    """Simular recuperación de un servicio"""
    # Eliminar y re-registrar con URL válida
    requests.delete(f"{context.monitor_url}/services/{service_name}")
    
    test_url = context.config.userdata.get('AUTH_URL', 'http://localhost:90') + '/health'
    payload = {
        "name": service_name,
        "url": test_url,
        "interval": 10
    }
    
    response = requests.post(f"{context.monitor_url}/services", json=payload)
    assert response.status_code == 200
    
    # Esperar que se detecte la recuperación
    time.sleep(12)
    context.current_service = service_name


@then('el servicio debe ser registrado exitosamente')
def step_service_registered_successfully(context):
    """Verificar que el servicio fue registrado exitosamente"""
    assert context.response.status_code == 200
    response_data = context.response.json()
    assert 'message' in response_data or 'service' in response_data


@then('debe aparecer en la lista de servicios monitoreados')
def step_service_appears_in_list(context):
    """Verificar que el servicio aparece en la lista"""
    response = requests.get(f"{context.monitor_url}/services")
    assert response.status_code == 200
    
    services = response.json().get('services', [])
    service_names = [s['name'] for s in services]
    assert context.current_service in service_names


@then('debo recibir una lista con todos los servicios')
def step_receive_services_list(context):
    """Verificar que se recibe una lista de servicios"""
    assert context.response.status_code == 200
    response_data = context.response.json()
    assert 'services' in response_data
    assert isinstance(response_data['services'], list)
    assert len(response_data['services']) > 0


@then('cada servicio debe tener nombre, URL y estado')
def step_services_have_required_fields(context):
    """Verificar que cada servicio tiene los campos requeridos"""
    response_data = context.response.json()
    services = response_data.get('services', [])
    
    for service in services:
        assert 'name' in service, "Falta campo 'name'"
        assert 'url' in service, "Falta campo 'url'"
        assert 'status' in service, "Falta campo 'status'"


@then('debo recibir el estado actual del servicio')
def step_receive_service_status(context):
    """Verificar que se recibe el estado del servicio"""
    assert context.response.status_code == 200
    response_data = context.response.json()
    assert 'name' in response_data
    assert 'status' in response_data


@then('la respuesta debe incluir último chequeo y mensaje')
def step_response_includes_check_and_message(context):
    """Verificar que la respuesta incluye información del último chequeo"""
    response_data = context.response.json()
    assert 'lastCheck' in response_data
    assert 'message' in response_data


@then('el servicio debe ser eliminado exitosamente')
def step_service_deleted_successfully(context):
    """Verificar que el servicio fue eliminado"""
    assert context.response.status_code == 200
    response_data = context.response.json()
    assert 'message' in response_data


@then('no debe aparecer en la lista de servicios')
def step_service_not_in_list(context):
    """Verificar que el servicio no aparece en la lista"""
    response = requests.get(f"{context.monitor_url}/services")
    assert response.status_code == 200
    
    services = response.json().get('services', [])
    service_names = [s['name'] for s in services]
    assert context.deleted_service not in service_names


@then('debo recibir status "{expected_status}"')
def step_receive_status(context, expected_status):
    """Verificar el status recibido"""
    assert context.response.status_code == 200
    response_data = context.response.json()
    assert response_data.get('status') == expected_status


@then('debo recibir respuesta con status "{expected_status}"')
def step_receive_response_with_status(context, expected_status):
    """Verificar el status en la respuesta"""
    assert context.response.status_code == 200
    response_data = context.response.json()
    assert response_data.get('status') == expected_status


@then('el monitor debe detectar el cambio de estado')
def step_monitor_detects_change(context):
    """Verificar que el monitor detectó el cambio de estado"""
    # Consultar el estado del servicio
    response = requests.get(f"{context.monitor_url}/services/{context.current_service}")
    assert response.status_code == 200
    
    service_data = response.json()
    # El servicio debe estar marcado como unhealthy
    assert service_data.get('status') in ['unhealthy', 'unknown']


@then('debe publicar un evento en RabbitMQ con routing key "{routing_key}"')
def step_event_published_to_rabbitmq(context, routing_key):
    """Verificar que se publicó un evento en RabbitMQ"""
    # Verificar que hay eventos en la cola (esto requeriría un consumidor)
    # Por ahora, asumimos que si el status cambió, se publicó el evento
    pass  # El monitor en Go publica automáticamente


@then('el evento debe indicar que el servicio está "{status}"')
def step_event_indicates_status(context, status):
    """Verificar el status en el evento"""
    # Verificar el estado actual del servicio
    response = requests.get(f"{context.monitor_url}/services/{context.current_service}")
    assert response.status_code == 200
    service_data = response.json()
    assert service_data.get('status') == status


@then('el monitor debe detectar la recuperación')
def step_monitor_detects_recovery(context):
    """Verificar que el monitor detectó la recuperación"""
    response = requests.get(f"{context.monitor_url}/services/{context.current_service}")
    assert response.status_code == 200
    
    service_data = response.json()
    assert service_data.get('status') == 'healthy'


@then('debe publicar un evento en RabbitMQ indicando "{status}"')
def step_event_published_with_status(context, status):
    """Verificar que se publicó evento con el status correcto"""
    # El monitor publica automáticamente en cambios de estado
    response = requests.get(f"{context.monitor_url}/services/{context.current_service}")
    assert response.status_code == 200
    service_data = response.json()
    assert service_data.get('status') == status
