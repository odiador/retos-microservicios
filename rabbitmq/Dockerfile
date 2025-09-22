# Dockerfile para RabbitMQ con configuración dinámica
FROM rabbitmq:3-management

# Instalar envsubst para reemplazar variables de entorno
RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/*

# Copiar archivos de configuración
COPY rabbitmq/rabbitmq.conf /etc/rabbitmq/rabbitmq.conf
COPY rabbitmq/definitions.template.json /etc/rabbitmq/definitions.template.json
COPY .env /etc/rabbitmq/.env
COPY rabbitmq/generate-definitions.sh /usr/local/bin/generate-definitions.sh

# Hacer ejecutable el script
RUN chmod +x /usr/local/bin/generate-definitions.sh

# Usar el script personalizado como entrypoint
ENTRYPOINT ["/usr/local/bin/generate-definitions.sh"]
