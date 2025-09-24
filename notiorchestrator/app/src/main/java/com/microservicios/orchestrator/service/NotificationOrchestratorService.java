package com.microservicios.orchestrator.service;

import com.microservicios.orchestrator.model.AuthEvent;
import com.microservicios.orchestrator.model.NotificationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
public class NotificationOrchestratorService {
    
    private static final Logger logger = LoggerFactory.getLogger(NotificationOrchestratorService.class);
    
    private final RabbitTemplate rabbitTemplate;
    private final String authEventsExchange;
    private final String sendEmailRoutingKey;
    private final String sendSmsRoutingKey;
    
    public NotificationOrchestratorService(
            RabbitTemplate rabbitTemplate,
            @Value("${orchestrator.exchange}") String authEventsExchange,
            @Value("${orchestrator.routing-keys.send-email}") String sendEmailRoutingKey,
            @Value("${orchestrator.routing-keys.send-sms}") String sendSmsRoutingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.authEventsExchange = authEventsExchange;
        this.sendEmailRoutingKey = sendEmailRoutingKey;
        this.sendSmsRoutingKey = sendSmsRoutingKey;
    }
    
    /**
     * Manejar evento de usuario creado
     */
    public void handleUserCreated(AuthEvent event) {
        String userId = event.getUserId();
        String username = event.getUsername();
        String email = event.getEmail();
        String phone = event.getPhone();
        
        logger.info("Usuario registrado: {} ({}) - Phone: {}", username, email, phone);
        
        // Enviar email de confirmación de cuenta
        Map<String, Object> emailData = new HashMap<>();
        emailData.put("username", username);
        emailData.put("confirmationUrl", "http://localhost:3500/confirm/" + userId);
        
        NotificationRequest emailNotification = NotificationRequest.emailNotification(
                "account.confirmation", email, "welcome", emailData);
        
        publishNotification(sendEmailRoutingKey, emailNotification);
        
        // Enviar SMS de bienvenida (solo si el usuario tiene teléfono)
        if (phone != null && !phone.trim().isEmpty()) {
            String welcomeSmsMessage = String.format("¡Bienvenido %s! Tu cuenta ha sido creada exitosamente. ¡Gracias por registrarte!", username);
            
            NotificationRequest smsNotification = NotificationRequest.smsNotification(
                    "account.created", phone, welcomeSmsMessage);
            
            publishNotification(sendSmsRoutingKey, smsNotification);
        } else {
            logger.warn("Usuario {} no tiene teléfono configurado para SMS de bienvenida", username);
        }
    }
    
    /**
     * Manejar evento de login de usuario
     */
    public void handleUserLogin(AuthEvent event) {
        String username = event.getUsername();
        String email = event.getEmail();
        String phone = event.getPhone();
        String ip = event.getIpAddress() != null ? event.getIpAddress() : "IP desconocida";
        String timestamp = event.getTimestamp() != null ? event.getTimestamp() : LocalDateTime.now().toString();
        
        logger.info("Login de usuario: {} desde IP: {}", username, ip);
        
        // Enviar email de alerta de seguridad
        Map<String, Object> emailData = new HashMap<>();
        emailData.put("username", username);
        emailData.put("ip", ip);
        emailData.put("timestamp", timestamp);
        
        NotificationRequest emailNotification = NotificationRequest.emailNotification(
                "security.login", email, "security-alert", emailData);
        
        publishNotification(sendEmailRoutingKey, emailNotification);
        
        // Enviar SMS de alerta de seguridad (solo si el usuario tiene teléfono)
        if (phone != null && !phone.trim().isEmpty()) {
            String formattedDateTime = formatTimestampForSms(timestamp);
            String smsMessage = String.format("Alerta: Nuevo acceso a tu cuenta desde %s el %s", ip, formattedDateTime);
            
            NotificationRequest smsNotification = NotificationRequest.smsNotification(
                    "security.login", phone, smsMessage);
            
            publishNotification(sendSmsRoutingKey, smsNotification);
        } else {
            logger.warn("Usuario {} no tiene teléfono configurado para SMS", username);
        }
    }
    
    /**
     * Manejar solicitud de reset de contraseña
     */
    public void handlePasswordResetRequested(AuthEvent event) {
        String email = event.getEmail();
        String token = event.getToken();
        
        logger.info("Reset de contraseña solicitado para: {}", email);
        
        // Enviar email con link de recuperación
        Map<String, Object> emailData = new HashMap<>();
        emailData.put("resetUrl", "http://localhost:3500/reset-password/" + token);
        
        NotificationRequest emailNotification = NotificationRequest.emailNotification(
                "password.reset", email, "password-reset", emailData);
        
        publishNotification(sendEmailRoutingKey, emailNotification);
    }
    
    /**
     * Manejar actualización de contraseña
     */
    public void handlePasswordUpdated(AuthEvent event) {
        String username = event.getUsername();
        String email = event.getEmail();
        String phone = event.getPhone();
        String timestamp = event.getTimestamp() != null ? event.getTimestamp() : LocalDateTime.now().toString();
        
        logger.info("Contraseña actualizada para: {}", username);
        
        // Enviar email de notificación de seguridad
        Map<String, Object> emailData = new HashMap<>();
        emailData.put("username", username);
        emailData.put("timestamp", timestamp);
        
        NotificationRequest emailNotification = NotificationRequest.emailNotification(
                "security.password_change", email, "password-changed", emailData);
        
        publishNotification(sendEmailRoutingKey, emailNotification);
        
        // Enviar SMS de notificación de seguridad
        if (phone != null && !phone.trim().isEmpty()) {
            String formattedDateTime = formatTimestampForSms(timestamp);
            String smsMessage = String.format("Tu contraseña ha sido cambiada exitosamente el %s", formattedDateTime);
            
            NotificationRequest smsNotification = NotificationRequest.smsNotification(
                    "security.password_change", phone, smsMessage);
            
            publishNotification(sendSmsRoutingKey, smsNotification);
        } else {
            logger.warn("Usuario {} no tiene teléfono para notificación SMS", username);
        }
    }
    
    /**
     * Publicar notificación en RabbitMQ
     */
    private void publishNotification(String routingKey, NotificationRequest notification) {
        try {
            rabbitTemplate.convertAndSend(authEventsExchange, routingKey, notification);
            logger.info("Publicado {}: {}", routingKey, notification);
        } catch (Exception e) {
            logger.error("Error publicando {}: {}", routingKey, e.getMessage(), e);
        }
    }
    
    /**
     * Formatear timestamp para SMS
     */
    private String formatTimestampForSms(String timestamp) {
        try {
            // Intentar parsear el timestamp y formatearlo para SMS
            LocalDateTime dateTime;
            if (timestamp.contains("T")) {
                dateTime = LocalDateTime.parse(timestamp.replace("Z", ""));
            } else {
                dateTime = LocalDateTime.parse(timestamp);
            }
            return dateTime.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        } catch (Exception e) {
            logger.warn("No se pudo formatear timestamp {}: {}", timestamp, e.getMessage());
            return LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        }
    }
}
