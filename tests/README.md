# Tests BDD para Microservicios

Tests de aceptación usando **Behave (BDD)** para validar el comportamiento de los microservicios.

## 📁 Estructura

```
tests/
├── feature/                    # Archivos .feature en Gherkin
│   ├── sms.feature            # Tests del servicio SMS
│   ├── auth.feature           # Tests del servicio Auth
│   ├── observability.feature  # Tests de observabilidad
│   └── ...
├── steps/                      # Implementación de los steps
│   ├── sms_steps.py
│   ├── observability_steps.py
│   └── ...
├── environment.py              # Configuración de Behave
├── requirements.txt            # Dependencias Python
├── Jenkinsfile                # Pipeline CI/CD
└── README.md                  # Esta documentación
```

## 🚀 Ejecución Local

### Prerequisitos

```bash
# Instalar dependencias
cd tests
pip install -r requirements.txt
```

### Ejecutar Tests

```bash
# Todos los tests
behave feature/

# Test específico
behave feature/sms.feature

# Con output detallado
behave feature/sms.feature --no-capture --format pretty

# Generar reporte HTML
behave feature/ --format html --outfile reports/bdd-report.html

# Generar reporte JSON
behave feature/ --format json --outfile reports/bdd-report.json

# Generar reporte JUnit (para Jenkins)
behave feature/ --junit --junit-directory reports/junit/
```

### Variables de Ambiente

```bash
export SMS_SERVICE_URL=http://localhost:6379
export AUTH_URL=http://localhost:3500
export ORCHESTRATOR_URL=http://localhost:8080
export MONITOR_URL=http://localhost:8085
export RABBITMQ_URL=amqp://admin:securepass@localhost:5672
export LOKI_URL=http://localhost:3100
export GRAFANA_URL=http://localhost:3000

# Ejecutar tests
behave feature/
```

## 🎯 Tests Implementados

### SMS Service (`sms.feature`)

- ✅ Procesar evento de envío de SMS exitosamente
- ✅ Validación de número de teléfono inválido
- ✅ Health check básico
- ✅ Health check de readiness
- ✅ Health check de liveness

### Observabilidad (`observability.feature`)

- ✅ Logs estructurados en formato JSON
- ✅ Loki recibe logs de todos los servicios
- ✅ Promtail recolecta y etiqueta logs
- ✅ Monitor verifica salud de servicios
- ✅ Grafana consulta logs de Loki
- ✅ Sistema completo de observabilidad funcionando

## 🔧 Integración con Jenkins

### Pipeline Automático

El archivo `Jenkinsfile` define un pipeline que:

1. **Verifica servicios**: Espera a que los microservicios estén disponibles
2. **Instala dependencias**: Instala Behave y librerías necesarias
3. **Ejecuta tests BDD**: Por servicio y todos juntos
4. **Genera reportes**: HTML, JSON y JUnit
5. **Publica resultados**: En Jenkins UI

### Configurar en Jenkins

```groovy
// En Jenkins, crear un pipeline job:
pipeline {
    agent any
    stages {
        stage('BDD Tests') {
            steps {
                // Referencia al Jenkinsfile de tests
                dir('tests') {
                    sh 'behave feature/ --junit --junit-directory results/'
                }
            }
        }
    }
    post {
        always {
            junit 'tests/results/*.xml'
        }
    }
}
```

## 📊 Reportes

Los tests generan varios tipos de reportes:

### JUnit XML (para Jenkins)
```bash
behave --junit --junit-directory reports/junit/
```

### HTML (para visualización)
```bash
behave --format html --outfile reports/bdd-report.html
```

### JSON (para procesamiento)
```bash
behave --format json --outfile reports/bdd-report.json
```

### Pretty Console
```bash
behave --format pretty --no-capture
```

## 🎨 Escribir Nuevos Tests

### 1. Crear Feature File

```gherkin
# feature/mi_servicio.feature
# language: es
Característica: Mi Nuevo Servicio
  Como usuario del sistema
  Quiero que mi servicio funcione correctamente
  Para lograr mis objetivos

  Escenario: Funcionalidad básica
    Dado que el servicio está disponible
    Cuando envío una petición
    Entonces debe responder correctamente
```

### 2. Implementar Steps

```python
# steps/mi_servicio_steps.py
from behave import given, when, then
import requests

@given('que el servicio está disponible')
def step_service_available(context):
    response = requests.get('http://mi-servicio/health')
    assert response.status_code == 200

@when('envío una petición')
def step_send_request(context):
    context.response = requests.post('http://mi-servicio/api')

@then('debe responder correctamente')
def step_check_response(context):
    assert context.response.status_code == 200
```

## 🐛 Debugging

### Modo Verbose

```bash
behave feature/ -v --no-capture
```

### Ejecutar Escenario Específico

```bash
behave feature/sms.feature:10  # Línea 10 del archivo
```

### Detener en Primer Fallo

```bash
behave feature/ --stop
```

### Tags para Filtrar

```gherkin
@smoke @critical
Escenario: Test crítico de smoke
```

```bash
# Solo tests con tag @smoke
behave --tags=smoke

# Excluir tests con tag @slow
behave --tags=-slow
```

## 📈 Mejores Prácticas

1. **Tests Independientes**: Cada escenario debe ser independiente
2. **Cleanup**: Limpiar estado en `after_scenario`
3. **Reusabilidad**: Usar steps genéricos y reutilizables
4. **Nombres Claros**: Nombres descriptivos en Gherkin
5. **Datos de Test**: Usar tablas en Gherkin para múltiples datos
6. **Timeouts**: Configurar timeouts apropiados para requests
7. **Assertions**: Usar assertions claros y específicos

## 🔗 Referencias

- [Behave Documentation](https://behave.readthedocs.io/)
- [Gherkin Syntax](https://cucumber.io/docs/gherkin/)
- [BDD Best Practices](https://cucumber.io/docs/bdd/)