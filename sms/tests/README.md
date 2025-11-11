# SMS Service Testing

## Estructura de Testing

```
sms/
├── consumer.py              # Código fuente
├── message.py              # Health checks
├── tests/
│   ├── unit/               # Tests unitarios (rápidos, sin dependencias)
│   │   ├── test_consumer.py
│   │   └── test_sms.py
│   └── integration/        # Tests de integración (con RabbitMQ real)
│       └── test_rabbitmq.py
├── pytest.ini
└── requirements.txt
```

## Running Tests

### Unit Tests (Rápidos)
```bash
cd sms
pytest tests/unit/ -v
```

### Integration Tests (Requieren RabbitMQ)
```bash
cd sms
RABBITMQ_URL=amqp://admin:securepass@localhost:5672 \
  pytest tests/integration/ -v
```

### Todos los Tests
```bash
cd sms
pytest tests/ -v
```

### Con Coverage
```bash
cd sms
pytest tests/ -v --cov=. --cov-report=term-missing --cov-report=xml
```

## Test Types

### Unit Tests
- No requieren servicios externos
- Usan mocks para Twilio y RabbitMQ
- Ejecutan en < 1 segundo
- Se ejecutan en cada commit

### Integration Tests
- Requieren RabbitMQ running
- Verifican integración real con message broker
- Ejecutan en < 10 segundos
- Se ejecutan en CI/CD

### E2E Tests
- Script en `scripts/e2e-tests.sh`
- Requieren todo el sistema levantado
- Verifican flujo completo de mensajes
- Se ejecutan en pre-deploy

## CI/CD Integration

Ver `Jenkinsfile` para pipeline completo que ejecuta:
1. Unit tests
2. Integration tests
3. Coverage analysis
4. SonarQube analysis