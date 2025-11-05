plugins {
    id("org.springframework.boot") version "3.3.4" // usa la última estable
    id("io.spring.dependency-management") version "1.1.6" // opcional si usas Boot 3.3+
    id("org.sonarqube") version "5.1.0.4882" // Plugin de SonarQube
    jacoco // Plugin de cobertura de código
    java
    application
}

group = "com.microservicios"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-amqp")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-validation")

    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.datatype:jackson-datatype-jsr310")
    // Loki logback appender for direct logging to Loki if desired
    implementation ("com.github.loki4j:loki-logback-appender:2.0.1")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.amqp:spring-rabbit-test")
    // RestAssured JSON Schema validator for response schema assertions
    testImplementation("io.rest-assured:json-schema-validator:5.3.0")
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

application {
    mainClass.set("com.microservicios.orchestrator.OrchestratorApplication")
}

// ============================================
// CONFIGURACIÓN DE JACOCO (Cobertura de Código)
// ============================================
jacoco {
    toolVersion = "0.8.12"
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required.set(true)
        html.required.set(true)
        csv.required.set(false)
    }
}

tasks.test {
    finalizedBy(tasks.jacocoTestReport)
}

// ============================================
// CONFIGURACIÓN DE SONARQUBE
// ============================================
sonar {
    properties {
        property("sonar.projectKey", "orchestrator-service")
        property("sonar.projectName", "Notification Orchestrator")
        property("sonar.host.url", System.getenv("SONAR_HOST_URL") ?: "http://localhost:9000")
        property("sonar.sources", "src/main/java")
        property("sonar.tests", "src/test/java")
        property("sonar.java.binaries", "build/classes/java/main")
        property("sonar.coverage.jacoco.xmlReportPaths", "build/reports/jacoco/test/jacocoTestReport.xml")
    }
}
