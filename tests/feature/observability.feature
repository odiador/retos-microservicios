# language: es
Característica: Integración del Sistema de Logs y Monitoreo
  Como administrador del sistema
  Quiero que todos los servicios estén integrados con el sistema de logs centralizado
  Para tener visibilidad completa del sistema

  Escenario: Los servicios generan logs estructurados en formato JSON
    Dado que todos los microservicios están en ejecución
    Cuando los servicios procesan requests
    Entonces los logs deben estar en formato JSON
    Y deben incluir timestamp, level, service, logger y message

  Escenario: Loki recibe logs de todos los servicios
    Dado que Loki está en ejecución
    Y todos los microservicios están generando logs
    Cuando consulto Loki por logs de cada servicio
    Entonces debo encontrar logs del servicio auth
    Y debo encontrar logs del servicio orchestrator
    Y debo encontrar logs del servicio sms
    Y debo encontrar logs del servicio monitor

  Escenario: Promtail recolecta y etiqueta logs correctamente
    Dado que Promtail está configurado
    Cuando los contenedores Docker generan logs
    Entonces Promtail debe agregarles labels de servicio
    Y debe parsear correctamente los logs JSON
    Y debe enviarlos a Loki

  Escenario: El monitor verifica la salud de auth
    Dado que el servicio auth está registrado en el monitor
    Cuando el monitor ejecuta un health check
    Entonces debe consultar el endpoint "/health" de auth
    Y debe recibir un status UP con checks de readiness y liveness
    Y debe registrar el resultado en su historial

  Escenario: El monitor verifica la salud de orchestrator
    Dado que el servicio orchestrator está registrado en el monitor
    Cuando el monitor ejecuta un health check
    Entonces debe consultar el endpoint "/actuator/health" de orchestrator
    Y debe recibir un status UP
    Y debe registrar el resultado en su historial

  Escenario: Grafana puede consultar logs de Loki
    Dado que Grafana está configurado con Loki como datasource
    Cuando consulto logs desde Grafana
    Entonces debo poder filtrar por servicio
    Y debo poder filtrar por nivel de log
    Y debo poder ver los logs en tiempo real

  Escenario: Sistema completo de observabilidad funcionando
    Dado que todos los componentes están desplegados
    Cuando genero actividad en el sistema
    Entonces los logs deben fluir de servicios → Docker → Promtail → Loki
    Y el monitor debe estar verificando la salud periódicamente
    Y Grafana debe mostrar los logs y métricas
    Y las alertas deben funcionar cuando un servicio cae
