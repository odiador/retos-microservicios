# language: es
Característica: Microservicio de Monitoreo
  Como administrador del sistema
  Quiero monitorear la salud de los microservicios
  Para detectar y responder a problemas rápidamente

  Escenario: Registrar un microservicio para monitoreo
    Dado que el servicio de monitoreo está activo
    Cuando registro un nuevo servicio con nombre "test-service" y endpoint "http://test:8080/health"
    Entonces el servicio debe ser registrado exitosamente
    Y debe aparecer en la lista de servicios monitoreados

  Escenario: Consultar el estado de salud general
    Dado que hay servicios registrados para monitoreo
    Cuando consulto el endpoint "/health"
    Entonces debo recibir el estado de todos los servicios
    Y cada servicio debe tener información de su último chequeo

  Escenario: Consultar el estado de un servicio específico
    Dado que el servicio "auth" está registrado
    Cuando consulto el endpoint "/health/auth"
    Entonces debo recibir información detallada del servicio
    Y debe incluir el historial de los últimos chequeos

  Escenario: El monitor detecta cuando un servicio cae
    Dado que un servicio está registrado y funcionando
    Cuando el servicio deja de responder
    Entonces el monitor debe detectar el cambio de estado
    Y debe enviar una notificación por email

  Escenario: El monitor detecta cuando un servicio se recupera
    Dado que un servicio está marcado como caído
    Cuando el servicio vuelve a responder correctamente
    Entonces el monitor debe detectar la recuperación
    Y debe enviar una notificación de recuperación por email

  Escenario: Eliminar un servicio del monitoreo
    Dado que un servicio está registrado para monitoreo
    Cuando elimino el servicio del registro
    Entonces el servicio debe ser removido exitosamente
    Y no debe aparecer más en la lista de servicios monitoreados

  Escenario: Health check del propio servicio de monitoreo
    Dado que el servicio de monitoreo está activo
    Cuando consulto el endpoint "/health-check"
    Entonces debe responder con estado UP
    Y debe incluir checks de readiness y liveness
