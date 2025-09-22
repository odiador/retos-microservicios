package com.microservicios.orchestrator.service;

import com.microservicios.orchestrator.model.AuthEvent;
import com.microservicios.orchestrator.model.NotificationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationOrchestratorServiceTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    private NotificationOrchestratorService orchestratorService;

    private final String authEventsExchange = "auth.events";
    private final String sendEmailRoutingKey = "send.email";
    private final String sendSmsRoutingKey = "send.sms";

    @BeforeEach
    void setUp() {
        orchestratorService = new NotificationOrchestratorService(
                rabbitTemplate, authEventsExchange, sendEmailRoutingKey, sendSmsRoutingKey);
    }

    @Test
    void testHandleUserCreated() {
        // Given
        Map<String, Object> data = new HashMap<>();
        data.put("id", "user123");
        data.put("username", "testuser");
        data.put("email", "test@example.com");

        AuthEvent event = new AuthEvent("user.created", data, new HashMap<>());

        // When
        orchestratorService.handleUserCreated(event);

        // Then
        ArgumentCaptor<NotificationRequest> captor = ArgumentCaptor.forClass(NotificationRequest.class);
        verify(rabbitTemplate).convertAndSend(eq(authEventsExchange), eq(sendEmailRoutingKey), captor.capture());

        NotificationRequest notification = captor.getValue();
        assertEquals("account.confirmation", notification.getType());
        assertEquals("test@example.com", notification.getRecipient());
        assertEquals("welcome", notification.getTemplate());
        assertTrue(notification.getData().containsKey("confirmationUrl"));
    }

    @Test
    void testHandleUserLogin() {
        // Given
        Map<String, Object> data = new HashMap<>();
        data.put("username", "testuser");
        data.put("email", "test@example.com");
        data.put("phone", "+1234567890");

        Map<String, Object> meta = new HashMap<>();
        meta.put("ip", "192.168.1.1");
        meta.put("timestamp", "2023-12-01T10:30:00");

        AuthEvent event = new AuthEvent("user.login", data, meta);

        // When
        orchestratorService.handleUserLogin(event);

        // Then
        verify(rabbitTemplate, times(2)).convertAndSend(eq(authEventsExchange), anyString(), any(NotificationRequest.class));
    }

    @Test
    void testHandleUserLoginWithoutPhone() {
        // Given
        Map<String, Object> data = new HashMap<>();
        data.put("username", "testuser");
        data.put("email", "test@example.com");

        Map<String, Object> meta = new HashMap<>();
        meta.put("ip", "192.168.1.1");

        AuthEvent event = new AuthEvent("user.login", data, meta);

        // When
        orchestratorService.handleUserLogin(event);

        // Then
        // Solo debe enviar email, no SMS
        verify(rabbitTemplate, times(1)).convertAndSend(eq(authEventsExchange), eq(sendEmailRoutingKey), any(NotificationRequest.class));
        verify(rabbitTemplate, never()).convertAndSend(eq(authEventsExchange), eq(sendSmsRoutingKey), any(NotificationRequest.class));
    }

    @Test
    void testHandlePasswordResetRequested() {
        // Given
        Map<String, Object> data = new HashMap<>();
        data.put("email", "test@example.com");
        data.put("token", "reset-token-123");

        AuthEvent event = new AuthEvent("password.reset.requested", data, new HashMap<>());

        // When
        orchestratorService.handlePasswordResetRequested(event);

        // Then
        ArgumentCaptor<NotificationRequest> captor = ArgumentCaptor.forClass(NotificationRequest.class);
        verify(rabbitTemplate).convertAndSend(eq(authEventsExchange), eq(sendEmailRoutingKey), captor.capture());

        NotificationRequest notification = captor.getValue();
        assertEquals("password.reset", notification.getType());
        assertEquals("test@example.com", notification.getRecipient());
        assertEquals("password-reset", notification.getTemplate());
    }

    @Test
    void testHandlePasswordUpdated() {
        // Given
        Map<String, Object> data = new HashMap<>();
        data.put("username", "testuser");
        data.put("email", "test@example.com");
        data.put("phone", "+1234567890");

        Map<String, Object> meta = new HashMap<>();
        meta.put("timestamp", "2023-12-01T10:30:00");

        AuthEvent event = new AuthEvent("password.updated", data, meta);

        // When
        orchestratorService.handlePasswordUpdated(event);

        // Then
        verify(rabbitTemplate, times(2)).convertAndSend(eq(authEventsExchange), anyString(), any(NotificationRequest.class));
    }
}
