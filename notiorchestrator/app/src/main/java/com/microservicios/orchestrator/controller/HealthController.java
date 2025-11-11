package com.microservicios.orchestrator.controller;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/actuator/health")
public class HealthController {
    
    private static final LocalDateTime START_TIME = LocalDateTime.now();
    private static final String VERSION = "1.0.0";
    
    @Autowired
    private RabbitTemplate rabbitTemplate;
    
    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        List<Map<String, Object>> checks = new ArrayList<>();
        
        // Readiness check
        Map<String, Object> readinessCheck = new HashMap<>();
        readinessCheck.put("name", "Readiness check");
        readinessCheck.put("status", isReady() ? "UP" : "DOWN");
        Map<String, Object> readinessData = new HashMap<>();
        readinessData.put("from", START_TIME.toString());
        readinessData.put("status", isReady() ? "READY" : "NOT_READY");
        readinessData.put("version", VERSION);
        readinessData.put("uptime", getUptime());
        readinessCheck.put("data", readinessData);
        checks.add(readinessCheck);
        
        // Liveness check
        Map<String, Object> livenessCheck = new HashMap<>();
        livenessCheck.put("name", "Liveness check");
        livenessCheck.put("status", "UP");
        Map<String, Object> livenessData = new HashMap<>();
        livenessData.put("from", START_TIME.toString());
        livenessData.put("status", "ALIVE");
        livenessData.put("version", VERSION);
        livenessData.put("uptime", getUptime());
        livenessCheck.put("data", livenessData);
        checks.add(livenessCheck);
        
        // RabbitMQ check
        Map<String, Object> rabbitCheck = new HashMap<>();
        rabbitCheck.put("name", "RabbitMQ check");
        boolean rabbitHealthy = checkRabbitMQ();
        rabbitCheck.put("status", rabbitHealthy ? "UP" : "DOWN");
        Map<String, Object> rabbitData = new HashMap<>();
        rabbitData.put("status", rabbitHealthy ? "connected" : "disconnected");
        rabbitCheck.put("data", rabbitData);
        checks.add(rabbitCheck);
        
        health.put("status", areAllChecksUp(checks) ? "UP" : "DOWN");
        health.put("checks", checks);
        
        return ResponseEntity.ok(health);
    }
    
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> checks = new ArrayList<>();
        
        Map<String, Object> check = new HashMap<>();
        check.put("name", "Readiness check");
        boolean ready = isReady();
        check.put("status", ready ? "UP" : "DOWN");
        
        Map<String, Object> data = new HashMap<>();
        data.put("from", START_TIME.toString());
        data.put("status", ready ? "READY" : "NOT_READY");
        data.put("version", VERSION);
        data.put("uptime", getUptime());
        data.put("rabbitmq", checkRabbitMQ() ? "connected" : "disconnected");
        check.put("data", data);
        
        checks.add(check);
        response.put("status", ready ? "UP" : "DOWN");
        response.put("checks", checks);
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/live")
    public ResponseEntity<Map<String, Object>> live() {
        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> checks = new ArrayList<>();
        
        Map<String, Object> check = new HashMap<>();
        check.put("name", "Liveness check");
        check.put("status", "UP");
        
        Map<String, Object> data = new HashMap<>();
        data.put("from", START_TIME.toString());
        data.put("status", "ALIVE");
        data.put("version", VERSION);
        data.put("uptime", getUptime());
        data.put("memory", getMemoryInfo());
        check.put("data", data);
        
        checks.add(check);
        response.put("status", "UP");
        response.put("checks", checks);
        
        return ResponseEntity.ok(response);
    }
    
    private boolean isReady() {
        // Check if service is ready to accept traffic
        return checkRabbitMQ();
    }
    
    private boolean checkRabbitMQ() {
        try {
            rabbitTemplate.getConnectionFactory().createConnection().close();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    private String getUptime() {
        Duration duration = Duration.between(START_TIME, LocalDateTime.now());
        long days = duration.toDays();
        long hours = duration.toHoursPart();
        long minutes = duration.toMinutesPart();
        long seconds = duration.toSecondsPart();
        
        return String.format("%dd %dh %dm %ds", days, hours, minutes, seconds);
    }
    
    private Map<String, String> getMemoryInfo() {
        Runtime runtime = Runtime.getRuntime();
        long maxMemory = runtime.maxMemory();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;
        
        Map<String, String> memoryInfo = new HashMap<>();
        memoryInfo.put("max", formatBytes(maxMemory));
        memoryInfo.put("total", formatBytes(totalMemory));
        memoryInfo.put("used", formatBytes(usedMemory));
        memoryInfo.put("free", formatBytes(freeMemory));
        
        return memoryInfo;
    }
    
    private String formatBytes(long bytes) {
        long mb = bytes / (1024 * 1024);
        return mb + " MB";
    }
    
    private boolean areAllChecksUp(List<Map<String, Object>> checks) {
        return checks.stream().allMatch(check -> "UP".equals(check.get("status")));
    }
}