import requests
from behave import given, when, then

BASE_URL = None
response = None

@given('el servicio de notificaciones está disponible en "{url}"')
def step_impl(context, url):
    global BASE_URL
    BASE_URL = url
    health = requests.get(f"{BASE_URL}/health")
    assert health.status_code == 200, f"Servicio no disponible: {health.text}"

@when('hago un POST a "{endpoint}" con:')
def step_impl(context, endpoint):
    global response
    data = {k: v for row in context.table for k, v in row.items()}
    response = requests.post(f"{BASE_URL}{endpoint}", json=data)

@when('hago un GET a "{endpoint}"')
def step_impl(context, endpoint):
    global response
    response = requests.get(f"{BASE_URL}{endpoint}")

@then('la respuesta debe tener código {status_code:d}')
def step_impl(context, status_code):
    assert response.status_code == status_code, \
        f"Esperado {status_code}, obtenido {response.status_code}. Respuesta: {response.text}"

@then('el cuerpo debe contener "{field}" con valor true')
def step_impl(context, field):
    body = response.json()
    assert body.get(field) is True, f"Esperado {field}=true, obtenido {body}"

@then('el cuerpo debe contener el mensaje "{mensaje}"')
def step_impl(context, mensaje):
    body = response.json()
    assert mensaje in str(body), f"Mensaje esperado '{mensaje}' no encontrado en {body}"

@then('el cuerpo debe incluir el campo "{campo}"')
def step_impl(context, campo):
    body = response.json()
    assert campo in str(body), f"Campo {campo} no encontrado en {body}"

@given('he enviado un SMS con SID "{sid}"')
def step_impl(context, sid):
    context.sid = sid
