package com.microservicios.orchestrator.model;

import java.util.Map;

public class NotificationRequest {
    private String type;
    private String recipient;
    private String template;
    private String message;
    private Map<String, Object> data;

    public NotificationRequest() {}

    public NotificationRequest(String type, String recipient) {
        this.type = type;
        this.recipient = recipient;
    }

    // Static factory methods para diferentes tipos de notificación
    public static NotificationRequest emailNotification(String type, String recipient, String template, Map<String, Object> data) {
        NotificationRequest request = new NotificationRequest(type, recipient);
        request.setTemplate(template);
        request.setData(data);
        return request;
    }

    public static NotificationRequest smsNotification(String type, String recipient, String message) {
        NotificationRequest request = new NotificationRequest(type, recipient);
        request.setMessage(message);
        return request;
    }

    // Getters and Setters
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getRecipient() {
        return recipient;
    }

    public void setRecipient(String recipient) {
        this.recipient = recipient;
    }

    public String getTemplate() {
        return template;
    }

    public void setTemplate(String template) {
        this.template = template;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Map<String, Object> getData() {
        return data;
    }

    public void setData(Map<String, Object> data) {
        this.data = data;
    }

    @Override
    public String toString() {
        return "NotificationRequest{" +
                "type='" + type + '\'' +
                ", recipient='" + recipient + '\'' +
                ", template='" + template + '\'' +
                ", message='" + message + '\'' +
                ", data=" + data +
                '}';
    }
}
