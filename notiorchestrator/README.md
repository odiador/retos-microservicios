# Notification Orchestrator - Java/Spring Boot

Este proyecto implementa el Orquestador de Notificaciones para el sistema de microservicios.

## Arquitectura
- **Lenguaje**: Java 17
- **Framework**: Spring Boot 3.x
- **Message Broker**: RabbitMQ
- **Build Tool**: Gradle

## Responsabilidades
1. Escuchar eventos de autenticación desde `auth.events` exchange
2. Aplicar reglas de negocio para determinar qué notificaciones enviar
3. Publicar eventos de notificación (`send.email`, `send.sms`) hacia los servicios de messaging

## Estructura del Proyecto
```
notiorchestrator/
├── src/main/java/com/microservicios/orchestrator/
│   ├── OrchestratorApplication.java
│   ├── config/
│   │   └── RabbitConfig.java
│   ├── service/
│   │   ├── OrchestrationService.java
│   │   └── NotificationPublisher.java
│   ├── model/
│   │   ├── UserEvent.java
│   │   └── NotificationRequest.java
│   └── listener/
│       └── AuthEventListener.java
├── src/main/resources/
│   └── application.yml
├── build.gradle
└── README.md
```

## Comandos de Gradle

### Crear el proyecto
```bash
# Desde la carpeta raíz del workspace
mkdir notiorchestrator && cd notiorchestrator

# Inicializar proyecto Gradle
gradle init --type java-application --dsl groovy --package com.microservicios.orchestrator

# O usar Spring Initializr
curl https://start.spring.io/starter.zip \
  -d type=gradle-project \
  -d language=java \
  -d bootVersion=3.1.0 \
  -d baseDir=notiorchestrator \
  -d groupId=com.microservicios \
  -d artifactId=orchestrator \
  -d name=notification-orchestrator \
  -d packageName=com.microservicios.orchestrator \
  -d dependencies=amqp,web,actuator \
  -o notiorchestrator.zip && unzip notiorchestrator.zip
```

### Desarrollo
```bash
# Compilar
./gradlew build

# Ejecutar
./gradlew bootRun

# Ejecutar tests
./gradlew test

# Crear JAR
./gradlew bootJar
```

## Configuración build.gradle
```gradle
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.1.0'
    id 'io.spring.dependency-management' version '1.1.0'
}

group = 'com.microservicios'
version = '1.0.0'
sourceCompatibility = '17'

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-amqp'
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'com.fasterxml.jackson.core:jackson-databind'
    
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.amqp:spring-rabbit-test'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

## Configuración application.yml
```yaml
spring:
  application:
    name: notification-orchestrator
  rabbitmq:
    host: rabbitmq
    port: 5672
    username: admin
    password: securepass
    virtual-host: /
    
server:
  port: 8080

orchestrator:
  exchange: auth.events
  queues:
    input: orchestrator.queue
  routing-keys:
    user: "user.*"
    password: "password.*"
    send-email: "send.email"
    send-sms: "send.sms"

logging:
  level:
    com.microservicios.orchestrator: DEBUG
    org.springframework.amqp: DEBUG
```

## Docker
```dockerfile
FROM openjdk:17-jdk-alpine
VOLUME /tmp
COPY build/libs/*.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
```

## Eventos que Maneja
- `user.created` → Email de confirmación
- `user.login` → Alertas de seguridad (email + SMS)
- `password.reset.requested` → Email de recuperación
- `password.updated` → Notificaciones de seguridad (email + SMS)

## Eventos que Publica
- `send.email` → Para servicio de email
- `send.sms` → Para servicio de SMS

## Reglas de Negocio Implementadas
1. **Registro**: Email de confirmación obligatorio
2. **Login**: Alertas de seguridad por email y SMS
3. **Reset de contraseña**: Email con link de recuperación
4. **Cambio de contraseña**: Notificaciones de seguridad por ambos canales

## Integración con Docker Compose
```yaml
notiorchestrator:
  build: ./notiorchestrator
  ports:
    - "8080:8080"
  env_file:
    - ./.env
  depends_on:
    rabbitmq:
      condition: service_healthy
  restart: unless-stopped
```

## Próximos Pasos
1. Implementar las clases Java mencionadas
2. Configurar listeners de RabbitMQ
3. Implementar lógica de reglas de negocio
4. Agregar tests unitarios e integración
5. Configurar métricas y health checks
