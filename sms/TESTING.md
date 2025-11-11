# SMS Service Testing Strategy
# Integración con SonarQube y CI/CD

## 🏗️ Arquitectura de Testing

### Microservicio SMS (Producción)
- **`consumer.py`**: Solo procesa eventos del bus RabbitMQ
- **`message.py`**: Solo health checks (`/health`, `/health/ready`, `/health/live`)
- **NO expone APIs REST públicas** (endpoints eliminados por seguridad)

### Microservicio de Testing (Recomendado)
Un microservicio separado `sms-testing` que:
- ✅ Envía mensajes de prueba al bus
- ✅ Verifica procesamiento correcto
- ✅ Genera reportes para SonarQube
- ✅ Se ejecuta solo en entornos de testing/CI
- ✅ No contamina código de producción

## 📋 Formato de Mensajes de Testing

Los mensajes de testing se envían al bus RabbitMQ con el siguiente formato JSON:

```json
{
  "recipient": "+573001234567",
  "message": "Mensaje de prueba para testing",
  "type": "test",
  "timestamp": "2025-11-10T15:30:00.000Z",
  "test_id": "test_1731250200"
}
```

## 🧪 Estrategia de Testing Recomendada

### Opción A: Testing como Microservicio Separado (Recomendado)

**Ventajas:**
- ✅ Separación clara de responsabilidades
- ✅ Testing no afecta código de producción
- ✅ Fácil deployment condicional (solo en testing)
- ✅ Escalabilidad independiente
- ✅ Mejor integración con CI/CD pipelines

**Arquitectura:**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   sms-testing   │───▶│   RabbitMQ Bus   │───▶│   sms-consumer  │
│ (pytest + API)  │    │                  │    │ (producción)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Opción B: Testing Integrado (Actual)

**Ventajas:**
- ✅ Más simple de implementar
- ✅ Menos servicios para mantener
- ✅ Testing directo en el mismo contenedor

**Desventajas:**
- ❌ Código de testing en producción
- ❌ Mayor superficie de ataque
- ❌ Más difícil de mantener

## 🚀 Implementación del Testing

### Testing con Microservicio Separado

1. **Crear `sms-testing/` con:**
   - `Dockerfile`
   - `requirements.txt` (pytest, pika, requests)
   - `test_runner.py` (API REST para ejecutar tests)
   - `test_scenarios.py` (casos de testing)

2. **API del microservicio de testing:**
   ```bash
   # Ejecutar tests
   curl -X POST http://sms-testing:8080/run-tests

   # Enviar mensaje de prueba
   curl -X POST http://sms-testing:8080/send-test \
     -d '{"phone": "+573001234567", "message": "Test"}'
   ```

3. **Configuración condicional:**
   ```yaml
   # docker-compose.testing.yml
   services:
     sms-testing:
       build: ./sms-testing
       profiles: ["testing"]
   ```

### Testing Integrado (Actual)

```bash
# Ejecutar tests dentro del contenedor SMS
docker compose exec notifications python test_sms.py --run-tests

# O desde el host (si está expuesto)
curl http://localhost:6379/health  # Solo health checks
```

## 📊 Métricas de Calidad

SonarQube analizará:
- ✅ Cobertura de código (>80%)
- ✅ Complejidad ciclomática
- ✅ Code smells
- ✅ Vulnerabilidades de seguridad
- ✅ Duplicación de código

## 🔄 Flujo de CI/CD Recomendado

1. **Build**: Compilar sms-consumer
2. **Unit Tests**: Ejecutar tests unitarios
3. **Integration Tests**: Desplegar sms-testing → enviar mensajes → verificar logs
4. **Quality Gate**: SonarQube verifica métricas
5. **Deploy**: Solo sms-consumer a producción

## 📈 Beneficios del Testing como Microservicio

- **Seguridad**: No expone APIs en producción
- **Performance**: Testing no afecta rendimiento de producción
- **Mantenibilidad**: Código de testing separado
- **Escalabilidad**: Testing puede escalar independientemente
- **Reutilización**: Mismo microservicio para diferentes entornos

## 🎯 Recomendación Final

**Para producción**: Implementar testing como microservicio separado es **ALTAMENTE RECOMENDABLE** y una buena práctica de arquitectura. Es viable, escalable y mantiene la separación de responsabilidades.

**Para desarrollo**: La implementación actual es suficiente mientras no se expongan endpoints REST sensibles.

## 🧪 Tipos de Testing

### 1. Unit Testing (`test_consumer.py`)
- Pruebas de funciones individuales
- Mock de Twilio y RabbitMQ
- Verificación de logs estructurados

### 2. Integration Testing
- Conexión real a RabbitMQ
- Envío de mensajes de prueba al bus
- Verificación de procesamiento completo

### 3. SonarQube Integration
- Cobertura de código con `pytest-cov`
- Reportes XML para SonarQube
- Análisis de calidad de código

## 🚀 Cómo Ejecutar Testing

### Testing Manual
```bash
# Enviar SMS de prueba
python test_sms.py "+573001234567" "Mensaje de prueba"

# Ejecutar suite completa
python test_sms.py --run-tests
```

### Testing para SonarQube
```bash
# Ejecutar con cobertura para SonarQube
python test_sms.py --sonar

# O directamente con pytest
pytest test_consumer.py --cov=consumer --cov-report=xml --junitxml=test-results.xml
```

### Testing en Docker
```bash
# Ejecutar tests dentro del contenedor
docker compose exec notifications python test_sms.py --run-tests

# Ejecutar tests para SonarQube
docker compose exec notifications python test_sms.py --sonar
```

## 📊 Métricas de Calidad

SonarQube analizará:
- ✅ Cobertura de código (>80%)
- ✅ Complejidad ciclomática
- ✅ Deuda técnica
- ✅ Code smells
- ✅ Vulnerabilidades de seguridad
- ✅ Duplicación de código

## 🔄 Flujo de CI/CD

1. **Build**: Compilar y ejecutar tests unitarios
2. **Test**: Ejecutar tests de integración
3. **Quality Gate**: SonarQube verifica métricas
4. **Deploy**: Solo si quality gate pasa

## 📈 Ejemplo de Reporte de Cobertura

```
Name          Stmts   Miss  Cover
---------------------------------
consumer.py      120     12    90%
test_consumer.py  80      0   100%
---------------------------------
TOTAL            200     12    94%
```

## 🎯 Casos de Testing Cubiertos

- ✅ Procesamiento exitoso de SMS
- ✅ Validación de datos incompletos
- ✅ Formateo automático de números
- ✅ Manejo de errores de Twilio
- ✅ Parsing de JSON inválido
- ✅ Conexión a RabbitMQ
- ✅ Logs estructurados JSON
- ✅ Health checks (si se mantiene message.py)