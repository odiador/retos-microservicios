Feature: Orquestación de notificaciones
  Como sistema orquestador
  Quiero enviar notificaciones a email y SMS según eventos de autenticación
  Para mantener informados y seguros a los usuarios

  Background:
    Given el orquestador está en ejecución
    And RabbitMQ está disponible

  Scenario: Usuario creado con email y teléfono
    When recibo un evento "user.created" con:
      | userId   | 12345                |
      | username | Cristian Candela     |
      | email    | cristian@gmail.com   |
      | phone    | +573234030048        |
    Then debo publicar una notificación de tipo "email" a "cristian@gmail.com"
    And debo publicar una notificación de tipo "sms" al número "+573234030048"

  Scenario: Usuario creado sin teléfono
    When recibo un evento "user.created" con:
      | userId   | 12346                |
      | username | Carlos               |
      | email    | carlos@gmail.com   |
      | phone    |                      |
    Then debo publicar una notificación de tipo "email" a "carlos@gmail.com"
    And no debo publicar ninguna notificación de tipo "sms"

  Scenario: Login de usuario con teléfono
    When recibo un evento "user.login" con:
      | username  | Juan Manuel          |
      | email     | juan@gmail.com      |
      | phone     | +573001112233        |
      | ipAddress | 190.24.50.10         |
      | timestamp | 2025-09-21T18:30:00Z |
    Then debo publicar una notificación de tipo "email" a "juan@gmail.com"
    And debo publicar una notificación de tipo "sms" al número "+573001112233"

  Scenario: Solicitud de reset de contraseña
    When recibo un evento "password.reset.requested" con:
      | email | cristian@gmail.com |
      | token | abc123          |
    Then debo publicar una notificación de tipo "email" a "cristian@gmail.com"
    And no debo publicar ninguna notificación de tipo "sms"

  Scenario: Cambio de contraseña
    When recibo un evento "password.updated" con:
      | username | Ana María       |
      | email    | ana@gmail.com   |
      | phone    | +573234030048   |
      | timestamp| 2025-09-21T19:00:00Z |
    Then debo publicar una notificación de tipo "email" a "ana@gmail.com"
    And debo publicar una notificación de tipo "sms" al número "+573234030048"
