# Multi-stage build para Java/Spring Boot
FROM gradle:8.4-jdk21 AS build

WORKDIR /app

# Copiar todo el proyecto (incluyendo subproyectos)
COPY . .

# Construir la aplicación
RUN gradle build --no-daemon

# Stage de runtime
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Crear usuario no-root
RUN addgroup -g 1001 -S orchestrator && \
    adduser -u 1001 -S orchestrator -G orchestrator

# Copiar el JAR construido desde el subproyecto app
COPY --from=build /app/app/build/libs/*.jar app.jar

# Cambiar propietario
RUN chown orchestrator:orchestrator app.jar

USER orchestrator

# Exponer puerto
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Comando por defecto
CMD ["java", "-jar", "app.jar"]
