package com.microservicios.orchestrator.model;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

public class AuthEvent {
    private String type;
    private Map<String, Object> data;
    private Map<String, Object> meta;

    public AuthEvent() {
        data = new java.util.HashMap<>();
        meta = new java.util.HashMap<>();
    }

    @JsonCreator
    public AuthEvent(@JsonProperty("type") String type, @JsonProperty("data") Map<String, Object> data,
            @JsonProperty("meta") Map<String, Object> meta) {
        this.type = type;
        this.data = data;
        this.meta = meta;
    }

    // Getters and Setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }

    public Map<String, Object> getMeta() {
        return meta;
    }

    public void setMeta(Map<String, Object> meta) {
        this.meta = meta;
    }

    // Helper methods para extraer datos comunes
    public String getUserId() {
        return data != null ? (String) data.get("id") : null;
    }

    public String getUsername() {
        return data != null ? (String) data.get("username") : null;
    }

    public String getEmail() {
        return data != null ? (String) data.get("email") : null;
    }

    public String getPhone() {
        return data != null ? (String) data.get("phone") : null;
    }

    public String getIpAddress() {
        return meta != null ? (String) meta.get("ip") : null;
    }

    public String getTimestamp() {
        return meta != null ? (String) meta.get("timestamp") : null;
    }

    public String getToken() {
        return data != null ? (String) data.get("token") : null;
    }

    @Override
    public String toString() {
        return "AuthEvent{" +
                "type='" + type + '\'' +
                ", data=" + data +
                ", meta=" + meta +
                '}';
    }
}
