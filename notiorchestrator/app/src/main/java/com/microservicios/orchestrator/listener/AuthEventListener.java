package com.microservicios.orchestrator.listener;

import com.microservicios.orchestrator.model.AuthEvent;
import com.microservicios.orchestrator.service.NotificationOrchestratorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

@Component
public class AuthEventListener {
    
    private static final Logger logger = LoggerFactory.getLogger(AuthEventListener.class);
    
    private final NotificationOrchestratorService orchestratorService;
    
    public AuthEventListener(NotificationOrchestratorService orchestratorService) {
        this.orchestratorService = orchestratorService;
    }
    
    @RabbitListener(queues = "${orchestrator.queues.input}")
    public void handleAuthEvent(@Payload AuthEvent event, @Header(AmqpHeaders.RECEIVED_ROUTING_KEY) String routingKey) {
        try {
            logger.debug("Mensaje recibido: {} - {}", routingKey, event);
            
            switch (routingKey) {
                case "user.created":
                    orchestratorService.handleUserCreated(event);
                    break;
                case "user.login":
                    orchestratorService.handleUserLogin(event);
                    break;
                case "password.reset.requested":
                    orchestratorService.handlePasswordResetRequested(event);
                    break;
                case "password.updated":
                    orchestratorService.handlePasswordUpdated(event);
                    break;
                default:
                    logger.warn("Evento no manejado: {}", routingKey);
            }
            
        } catch (Exception e) {
            logger.error("Error procesando evento {}: {}", routingKey, e.getMessage(), e);
            throw e; // Re-throw para que RabbitMQ pueda manejar el requeue/dead letter
        }
    }
}
