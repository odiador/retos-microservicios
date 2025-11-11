# language: es
Característica: Servicio de Mensajería SMS - Arquitectura Event-Driven
  Como sistema de microservicios
  Quiero procesar mensajes SMS a través de eventos
  Para mantener seguridad y acoplamiento bajo

  Antecedentes:
    Dado que RabbitMQ está configurado
    Y el exchange SMS "auth.events" existe

  Escenario: Procesar evento de envío de SMS exitosamente
    Cuando envío un mensaje al exchange "auth.events" con routing key "send.sms":
      | field     | value                      |
      | recipient | +573001112233              |
      | message   | Hola, este es un test      |
      | type      | notification               |
    Entonces el mensaje debe ser procesado por el consumer
    Y debe generarse un log estructurado con level "INFO"
    Y el log debe contener "event": "sms_sent"
    Y el log debe contener "recipient": "+573001112233"

  Escenario: Procesar evento con número de teléfono inválido
    Cuando envío un mensaje al exchange "auth.events" con routing key "send.sms":
      | field     | value                      |
      | recipient | 12345                      |
      | message   | Mensaje de prueba          |
      | type      | test                       |
    Entonces el mensaje debe ser rechazado por validación
    Y debe generarse un log estructurado con level "ERROR"
    Y el log debe contener "event": "sms_validation_error"

  Escenario: Health check del servicio SMS
    Cuando hago un GET a "/health"
    Entonces la respuesta debe tener código 200
    Y el cuerpo debe contener "status": "UP"
    Y el cuerpo debe contener "service": "sms"

  Escenario: Health check de readiness del servicio SMS
    Cuando hago un GET a "/health/ready"
    Entonces la respuesta debe tener código 200
    Y el cuerpo debe contener "status": "READY"
    Y el cuerpo debe contener "checks" como array
    Y cada check debe tener "name", "status" y "timestamp"

  Escenario: Health check de liveness del servicio SMS
    Cuando hago un GET a "/health/live"
    Entonces la respuesta debe tener código 200
    Y el cuerpo debe contener "status": "ALIVE"
    Y el cuerpo debe contener "uptime" como número
