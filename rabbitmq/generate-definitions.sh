#!/bin/bash
# generate-definitions.sh - Genera definitions.json dinámicamente desde template

set -e

# Función de logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Iniciando generación de definitions.json"

# Cargar variables de entorno desde .env si existe
if [ -f /etc/rabbitmq/.env ]; then
    log "Cargando variables de entorno desde /etc/rabbitmq/.env"
    # Método más robusto para cargar variables
    while IFS= read -r line; do
        # Ignorar líneas vacías y comentarios
        if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            # Exportar la variable
            export "$line"
        fi
    done < /etc/rabbitmq/.env
    
    # Mostrar variables cargadas para debug
    log "Variables de RabbitMQ cargadas:"
    env | grep -E "(RABBITMQ|AUTH|MESSAGING|ORCHESTRATOR|USER|PASSWORD|SEND)" | sort
fi

# Verificar que las variables críticas estén definidas
required_vars=("RABBITMQ_USER" "RABBITMQ_PASSWORD" "RABBITMQ_VHOST" "AUTH_EVENTS_EXCHANGE")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log "ERROR: Variable de entorno $var no está definida"
        exit 1
    fi
done

# Establecer valores por defecto para variables opcionales
export ORCHESTRATOR_QUEUE="${ORCHESTRATOR_QUEUE:-orchestrator.queue}"
export MESSAGING_EMAIL_QUEUE="${MESSAGING_EMAIL_QUEUE:-messaging.email.queue}"
export MESSAGING_SMS_QUEUE="${MESSAGING_SMS_QUEUE:-messaging.sms.queue}"
export AUTH_AUDIT_QUEUE="${AUTH_AUDIT_QUEUE:-auth.audit.queue}"
export USER_ROUTING_KEY="${USER_ROUTING_KEY:-user.*}"
export PASSWORD_ROUTING_KEY="${PASSWORD_ROUTING_KEY:-password.*}"
export SEND_EMAIL_ROUTING_KEY="${SEND_EMAIL_ROUTING_KEY:-send.email}"
export SEND_SMS_ROUTING_KEY="${SEND_SMS_ROUTING_KEY:-send.sms}"

log "Generando definitions.json desde template"
envsubst < /etc/rabbitmq/definitions.template.json > /etc/rabbitmq/definitions.json

log "Validando JSON generado..."
if ! python3 -m json.tool /etc/rabbitmq/definitions.json > /dev/null 2>&1; then
    log "ERROR: JSON generado inválido. Contenido:"
    cat /etc/rabbitmq/definitions.json
    exit 1
fi

log "definitions.json generado exitosamente"
log "Primeras líneas del contenido generado:"
head -20 /etc/rabbitmq/definitions.json

# Iniciar RabbitMQ
log "Iniciando RabbitMQ..."
exec docker-entrypoint.sh rabbitmq-server
