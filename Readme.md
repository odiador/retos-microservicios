# Retos de Microservicios

## Testing

### Reto 1 ✅
- ✅ Pruebas Gherkin (BDD) en `/tests/feature/`
- ✅ Suite automatizada con Behave (Python)

### Reto 2 ✅
- ✅ Automatización con Behave + pytest
- ✅ Validación JSON en steps

### Reto 3 ✅
- ✅ Faker integrado en tests
- ✅ Reportes: HTML, JSON, JUnit (Behave)
- ✅ Código versionado en Git

### Reto 4 ✅
- ✅ Jenkins en `docker-compose.yml`
- ✅ SonarQube en `docker-compose.yml`

### Reto 5 ✅
- ✅ Pipeline integrado en `Jenkinsfile`
- ✅ Clonado automático de código
- ✅ Pruebas unitarias (SMS + Auth)
- ✅ Análisis de calidad (SonarQube)
- ✅ Ejecución de pruebas BDD
- ✅ Reportes integrados en Jenkins

## Observabilidad

### Reto 1 ✅
- ✅ Sistema de Logs: Loki 2.9.2
- ✅ Desplegado en docker-compose
- ✅ Registro síncrono y asíncrono

### Reto 2 ✅
- ✅ Logs integrados en Auth (Node.js)
- ✅ Logs integrados en SMS (Python)
- ✅ Logs JSON estructurados
- ✅ Promtail recolectando logs

### Reto 3 ✅
- ✅ Health checks implementados:
  - Auth: `/health`, `/health/ready`, `/health/live`
  - SMS: `/health`, `/health/ready`, `/health/live`
  - Orchestrator: `/actuator/health`

### Reto 4 ✅
- ✅ Microservicio Monitor (Go)
- ✅ Registro de servicios: `POST /services`
- ✅ Estado general: `GET /services`
- ✅ Estado específico: `GET /services/{name}`
- ✅ Health checks: `/`, `/live`, `/ready`
- ✅ Notificaciones vía RabbitMQ
- ✅ Monitoreo periódico con goroutines

### Reto 5 ✅
- ✅ Pruebas BDD del monitor: `/tests/feature/monitor.feature`
- ✅ Pruebas de integración completa: `/tests/feature/integration.feature`
- ✅ Steps implementados: `monitor_steps.py`, `integration_steps.py`
- ✅ Verificación de sistema completo end-to-end

## Ejecución

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ejecutar pruebas BDD
cd tests
pip install -r requirements.txt
behave feature/

# Ver logs en Grafana
# http://localhost:3000

# Jenkins CI/CD
# http://localhost:8081

# SonarQube
# http://localhost:9000
```

## Arquitectura

- **Auth**: Node.js + PostgreSQL + JWT
- **SMS**: Python + Twilio + RabbitMQ
- **Orchestrator**: Java Spring Boot + RabbitMQ
- **Monitor**: Go + RabbitMQ
- **Observability**: Loki + Promtail + Grafana
- **CI/CD**: Jenkins + SonarQube
- **Messaging**: RabbitMQ
- **Database**: PostgreSQL
