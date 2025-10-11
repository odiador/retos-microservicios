package com.microservicios.orchestrator.controller;

import com.microservicios.orchestrator.model.AuthEvent;
import com.microservicios.orchestrator.service.NotificationOrchestratorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/orchestrator")
public class NotificationOrchestratorController {

    @Autowired
    private NotificationOrchestratorService orchestratorService;

    @PostMapping("/user-created")
    public void simulateUserCreated(@RequestBody AuthEvent event) {
        orchestratorService.handleUserCreated(event);
    }

    @PostMapping("/user-login")
    public void simulateUserLogin(@RequestBody AuthEvent event) {
        orchestratorService.handleUserLogin(event);
    }

    @PostMapping("/password-reset")
    public void simulatePasswordReset(@RequestBody AuthEvent event) {
        orchestratorService.handlePasswordResetRequested(event);
    }

    @PostMapping("/password-updated")
    public void simulatePasswordUpdated(@RequestBody AuthEvent event) {
        orchestratorService.handlePasswordUpdated(event);
    }
}