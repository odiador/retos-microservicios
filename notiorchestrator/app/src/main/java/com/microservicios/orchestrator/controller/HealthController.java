package com.microservicios.orchestrator.controller;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/health")
public class HealthController {
    
    @Autowired
    private RabbitTemplate rabbitTemplate;
    
    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "notification-orchestrator");
        health.put("timestamp", LocalDateTime.now());
        
        // Verificar conexión a RabbitMQ
        try {
            rabbitTemplate.getConnectionFactory().createConnection();
            health.put("rabbitmq", "UP");
        } catch (Exception e) {
            health.put("rabbitmq", "DOWN");
            health.put("rabbitmq_error", e.getMessage());
        }
        
        return ResponseEntity.ok(health);
    }
    
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        Map<String, Object> ready = new HashMap<>();
        ready.put("status", "READY");
        ready.put("service", "notification-orchestrator");
        ready.put("timestamp", LocalDateTime.now());
        return ResponseEntity.ok(ready);
    }
}
