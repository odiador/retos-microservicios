package com.microservicios.orchestrator.listener;

import com.microservicios.orchestrator.model.AuthEvent;
import com.microservicios.orchestrator.service.NotificationOrchestratorService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthEventListenerTest {

    @Mock
    private NotificationOrchestratorService orchestratorService;

    @InjectMocks
    private AuthEventListener authEventListener;

    @Test
    void testHandleUserCreatedEvent() {
        // Given
        AuthEvent event = new AuthEvent("user.created", new HashMap<>(), new HashMap<>());
        String routingKey = "user.created";

        // When
        authEventListener.handleAuthEvent(event, routingKey);

        // Then
        verify(orchestratorService).handleUserCreated(event);
    }

    @Test
    void testHandleUserLoginEvent() {
        // Given
        AuthEvent event = new AuthEvent("user.login", new HashMap<>(), new HashMap<>());
        String routingKey = "user.login";

        // When
        authEventListener.handleAuthEvent(event, routingKey);

        // Then
        verify(orchestratorService).handleUserLogin(event);
    }

    @Test
    void testHandlePasswordResetRequestedEvent() {
        // Given
        AuthEvent event = new AuthEvent("password.reset.requested", new HashMap<>(), new HashMap<>());
        String routingKey = "password.reset.requested";

        // When
        authEventListener.handleAuthEvent(event, routingKey);

        // Then
        verify(orchestratorService).handlePasswordResetRequested(event);
    }

    @Test
    void testHandlePasswordUpdatedEvent() {
        // Given
        AuthEvent event = new AuthEvent("password.updated", new HashMap<>(), new HashMap<>());
        String routingKey = "password.updated";

        // When
        authEventListener.handleAuthEvent(event, routingKey);

        // Then
        verify(orchestratorService).handlePasswordUpdated(event);
    }

    @Test
    void testHandleUnknownEvent() {
        // Given
        AuthEvent event = new AuthEvent("unknown.event", new HashMap<>(), new HashMap<>());
        String routingKey = "unknown.event";

        // When
        authEventListener.handleAuthEvent(event, routingKey);

        // Then
        // No debería llamar a ningún método del servicio
        verifyNoInteractions(orchestratorService);
    }
}
