Feature: Autenticación de usuarios
  Como usuario del sistema
  Quiero registrarme e iniciar sesión
  Para acceder a mis recursos de forma segura

  Background:
    Given el sistema de autenticación está en ejecución
    And existe un usuario registrado con email "admin@gmail.com" y contraseña "admin"

  Scenario: Inicio de sesión exitoso
    When el cliente envía una solicitud de login con email "admin@gmail.com" y contraseña "admin"
    Then el sistema debe responder con código 200
    And debe retornar un token JWT válido
    And el token debe incluir el rol del usuario

  Scenario: Inicio de sesión fallido por credenciales incorrectas
    When el cliente envía una solicitud de login con email "admin@gmail.com" y contraseña "admin111"
    Then el sistema debe responder con código 401
    And debe mostrar un mensaje de error "Credenciales inválidas"

  Scenario: Inicio de sesión fallido por usuario inexistente
    When el cliente envía una solicitud de login con email "admin111@gmail.com" y contraseña "admin"
    Then el sistema debe responder con código 404
    And debe mostrar un mensaje de error "Usuario no encontrado"

  Scenario: Validación de token válido
    Given el cliente posee un token JWT válido
    When solicita acceso a un recurso protegido
    Then el sistema debe responder con código 200
    And debe permitir el acceso al recurso

  Scenario: Validación de token inválido o expirado
    Given el cliente posee un token JWT inválido o expirado
    When solicita acceso a un recurso protegido
    Then el sistema debe responder con código 403
    And debe mostrar un mensaje de error "Token inválido o expirado"

  Scenario: Registro exitoso de un nuevo usuario
    Given no existe un usuario con email "ana@gmail.com"
    When intento registrar un nuevo usuario con:
      | username  | ana123            |
      | email     | ana@example.com   |
      | password  | contraseña123     |
      | firstName | Ana               |
      | lastName  | Cuéllar           |
      | phone     | +573234030048     |
    Then el sistema debe devolver un mensaje "Usuario registrado exitosamente"
    And la respuesta debe incluir un "access_token" válido
    And el "token_type" debe ser "Bearer"


