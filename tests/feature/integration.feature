# language: es
Característica: Integración del Sistema Completo
  Como usuario del sistema
  Quiero que todos los microservicios trabajen juntos correctamente
  Para tener un sistema funcional de principio a fin

  Escenario: Flujo completo de registro y notificación SMS
    Dado que todos los servicios están activos
    Cuando un usuario se registra en el sistema de autenticación
    Entonces el evento debe publicarse en RabbitMQ
    Y el orchestrator debe procesar el evento
    Y el servicio SMS debe recibir la solicitud de envío
    Y los logs deben registrarse en Loki
    Y el monitor debe reportar todos los servicios como "healthy"

  Escenario: Health checks de todos los microservicios
    Dado que el sistema está desplegado
    Cuando consulto el health check de cada microservicio
    Entonces el servicio "auth" debe responder en "/health"
    Y el servicio "orchestrator" debe responder en "/actuator/health"
    Y el servicio "sms" debe responder en "/health"
    Y el servicio "monitor" debe responder en "/"

  Escenario: Observabilidad del sistema completo
    Dado que el stack de observabilidad está activo
    Cuando los servicios generan logs
    Entonces Promtail debe recolectar los logs
    Y Loki debe almacenar los logs
    Y Grafana debe poder consultar los logs
    Y el monitor debe estar monitoreando todos los servicios

  Escenario: Verificación de servicios de infraestructura
    Dado que el sistema está completamente desplegado
    Entonces RabbitMQ debe estar accesible
    Y PostgreSQL debe estar accesible
    Y Loki debe estar accesible
    Y Grafana debe estar accesible
    Y Jenkins debe estar accesible
    Y SonarQube debe estar accesible

  Escenario: Mensajería entre microservicios
    Dado que RabbitMQ está configurado
    Y el exchange "auth.events" existe
    Y el exchange "monitor.events" existe
    Cuando publico un mensaje de prueba en "auth.events"
    Entonces el orchestrator debe recibir el mensaje
    Y el mensaje debe enrutarse correctamente según el routing key

  Escenario: Resiliencia del sistema ante fallos
    Dado que todos los servicios están funcionando
    Cuando un microservicio no responde temporalmente
    Entonces el monitor debe detectar el fallo
    Y debe publicar una notificación en RabbitMQ
    Y el resto del sistema debe continuar funcionando
    Y cuando el servicio se recupera debe notificarlo

  Escenario: Logs centralizados funcionando
    Dado que Loki está activo
    Y los servicios están generando logs
    Cuando consulto Loki por logs recientes
    Entonces debo encontrar logs de "auth"
    Y debo encontrar logs de "sms"
    Y debo encontrar logs de "monitor"
    Y los logs deben tener el formato JSON correcto

  Escenario: Monitoreo activo de todos los servicios
    Dado que el monitor está activo
    Y todos los servicios están registrados
    Cuando consulto el estado general del sistema
    Entonces debo ver el estado de "auth"
    Y debo ver el estado de "orchestrator"
    Y debo ver el estado de "sms"
    Y todos deben estar en estado "healthy"
