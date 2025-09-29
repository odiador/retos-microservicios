Feature: Servicio de Mensajería SMS
  Como cliente del sistema
  Quiero poder enviar mensajes SMS y consultar su estado
  Para notificar a los usuarios correctamente

  Background:
    Given el servicio de notificaciones está disponible

  Scenario: Enviar un SMS exitosamente
    When hago un POST a "/notifications/sms" con:
      | phone       | +573001112233       |
      | message     | Hola, este es un test |
    Then la respuesta debe tener código 200
    And el cuerpo debe contener "success": true
    And el cuerpo debe contener "SMS sent successfully"

  Scenario: Enviar un SMS con número inválido
    When hago un POST a "/notifications/sms" con:
      | phone   | 12345          |
      | message | Hola prueba    |
    Then la respuesta debe tener código 400
    And el cuerpo debe contener "Invalid phone number format"

  Scenario: Enviar un SMS con mensaje demasiado largo
    When hago un POST a "/notifications/sms" con:
      | phone   | +573001112233 |
      | message | <un mensaje de más de 1600 caracteres> |
    Then la respuesta debe tener código 400
    And el cuerpo debe contener "Message too long"

  Scenario: Consultar estado de un SMS enviado
    Given he enviado un SMS con SID "SMXXXXXXXXXXXXXXXX"
    When hago un GET a "/notifications/sms/SMXXXXXXXXXXXXXXXX"
    Then la respuesta debe tener código 200
    And el cuerpo debe contener "success": true
    And el cuerpo debe incluir el campo "status"
