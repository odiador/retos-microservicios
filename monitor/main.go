package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/streadway/amqp"
)

// Service representa un servicio a monitorear
type Service struct {
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	Frequency int       `json:"frequency"` // en segundos
	Emails    []string  `json:"emails"`
	Status    string    `json:"status"`
	LastCheck time.Time `json:"last_check"`
	Started   time.Time `json:"started"`
	Uptime    string    `json:"uptime"`
}

// HealthCheck representa el estado de salud del monitor
type HealthCheck struct {
	Status   string                 `json:"status"`
	Service  string                 `json:"service"`
	Version  string                 `json:"version"`
	Uptime   string                 `json:"uptime"`
	Services int                    `json:"services_monitored"`
	Checks   map[string]interface{} `json:"checks,omitempty"`
}

var (
	services  = make(map[string]*Service)
	checkers  = make(map[string]chan bool) // Para detener goroutines
	mu        sync.RWMutex
	startTime time.Time
	amqpURI   = getEnv("RABBITMQ_URL", "amqp://admin:securepass@rabbitmq:5672/")
	version   = "2.0.0"
)

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// logJSON genera logs estructurados en JSON
func logJSON(level, event string, data map[string]interface{}) {
	data["timestamp"] = time.Now().UTC().Format(time.RFC3339)
	data["level"] = level
	data["service"] = "monitor"
	data["event"] = event
	jsonData, _ := json.Marshal(data)
	log.Println(string(jsonData))
}

// registerService registra un nuevo servicio para monitoreo
func registerService(w http.ResponseWriter, r *http.Request) {
	var s Service
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		logJSON("ERROR", "register_service_failed", map[string]interface{}{
			"error": err.Error(),
		})
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validaciones
	if s.Name == "" || s.URL == "" {
		http.Error(w, "name and url are required", http.StatusBadRequest)
		return
	}
	if s.Frequency <= 0 {
		s.Frequency = 30 // Default 30 segundos
	}

	mu.Lock()
	defer mu.Unlock()

	// Si el servicio ya existe, detener su checker anterior
	if stopChan, exists := checkers[s.Name]; exists {
		close(stopChan)
	}

	s.Status = "UNKNOWN"
	s.LastCheck = time.Time{}
	s.Started = time.Now()
	services[s.Name] = &s

	// Iniciar checker para este servicio
	stopChan := make(chan bool)
	checkers[s.Name] = stopChan
	go checkHealth(&s, stopChan)

	logJSON("INFO", "service_registered", map[string]interface{}{
		"service_name": s.Name,
		"url":          s.URL,
		"frequency":    s.Frequency,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(s)
}

// getAllHealth devuelve el estado de todos los servicios monitoreados
func getAllHealth(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	out := make([]*Service, 0, len(services))
	for _, s := range services {
		// Calcular uptime
		uptime := time.Since(s.Started).Round(time.Second)
		sCopy := *s
		sCopy.Uptime = uptime.String()
		out = append(out, &sCopy)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// getServiceHealth devuelve el estado de un servicio específico
func getServiceHealth(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	mu.RLock()
	defer mu.RUnlock()

	if s, ok := services[name]; ok {
		sCopy := *s
		sCopy.Uptime = time.Since(s.Started).Round(time.Second).String()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(sCopy)
		return
	}

	http.Error(w, "service not found", http.StatusNotFound)
}

// deleteService elimina un servicio del monitoreo
func deleteService(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	mu.Lock()
	defer mu.Unlock()

	if stopChan, exists := checkers[name]; exists {
		close(stopChan)
		delete(checkers, name)
	}

	if _, exists := services[name]; exists {
		delete(services, name)
		logJSON("INFO", "service_unregistered", map[string]interface{}{
			"service_name": name,
		})
		w.WriteHeader(http.StatusNoContent)
		return
	}

	http.Error(w, "service not found", http.StatusNotFound)
}

// healthEndpoint devuelve el estado general del monitor
func healthEndpoint(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	status := "UP"
	checks := make(map[string]interface{})

	// Verificar RabbitMQ
	checks["rabbitmq"] = checkRabbitMQ()

	// Contar servicios UP/DOWN
	upCount := 0
	downCount := 0
	for _, s := range services {
		if s.Status == "UP" {
			upCount++
		} else if s.Status == "DOWN" {
			downCount++
		}
	}

	checks["monitored_services"] = map[string]interface{}{
		"total": len(services),
		"up":    upCount,
		"down":  downCount,
	}

	// Si hay servicios DOWN, cambiar status a DEGRADED
	if downCount > 0 {
		status = "DEGRADED"
	}

	health := HealthCheck{
		Status:   status,
		Service:  "monitor",
		Version:  version,
		Uptime:   time.Since(startTime).Round(time.Second).String(),
		Services: len(services),
		Checks:   checks,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// healthLive verifica que el servicio está vivo
func healthLive(w http.ResponseWriter, r *http.Request) {
	health := HealthCheck{
		Status:  "ALIVE",
		Service: "monitor",
		Version: version,
		Uptime:  time.Since(startTime).Round(time.Second).String(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// healthReady verifica que el servicio está listo
func healthReady(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	status := "READY"
	checks := make(map[string]interface{})

	// Verificar RabbitMQ
	rabbitCheck := checkRabbitMQ()
	checks["rabbitmq"] = rabbitCheck

	if rabbitCheck != "connected" {
		status = "NOT_READY"
	}

	health := HealthCheck{
		Status:   status,
		Service:  "monitor",
		Version:  version,
		Uptime:   time.Since(startTime).Round(time.Second).String(),
		Services: len(services),
		Checks:   checks,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// checkRabbitMQ verifica la conexión con RabbitMQ
func checkRabbitMQ() string {
	conn, err := amqp.Dial(amqpURI)
	if err != nil {
		return "disconnected"
	}
	defer conn.Close()
	return "connected"
}

// checkHealth monitorea continuamente un servicio
func checkHealth(s *Service, stopChan chan bool) {
	ticker := time.NewTicker(time.Duration(s.Frequency) * time.Second)
	defer ticker.Stop()

	// Primera verificación inmediata
	doHealthCheck(s)

	for {
		select {
		case <-stopChan:
			logJSON("INFO", "health_checker_stopped", map[string]interface{}{
				"service_name": s.Name,
			})
			return
		case <-ticker.C:
			doHealthCheck(s)
		}
	}
}

// doHealthCheck realiza una verificación de salud
func doHealthCheck(s *Service) {
	client := &http.Client{Timeout: 5 * time.Second}
	start := time.Now()
	resp, err := client.Get(s.URL)
	duration := time.Since(start).Milliseconds()

	mu.Lock()
	defer mu.Unlock()

	oldStatus := s.Status

	if err != nil {
		s.Status = "DOWN"
		s.LastCheck = time.Now()
		logJSON("ERROR", "health_check_failed", map[string]interface{}{
			"service_name":  s.Name,
			"url":           s.URL,
			"error":         err.Error(),
			"duration_ms":   duration,
			"previous_status": oldStatus,
		})

		if oldStatus != "DOWN" {
			notifyStatusChange(s, "DOWN", fmt.Sprintf("Service %s is DOWN: %v", s.Name, err))
		}
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		s.Status = "DOWN"
		s.LastCheck = time.Now()
		logJSON("ERROR", "health_check_unhealthy", map[string]interface{}{
			"service_name":    s.Name,
			"url":             s.URL,
			"status_code":     resp.StatusCode,
			"duration_ms":     duration,
			"previous_status": oldStatus,
		})

		if oldStatus != "DOWN" {
			notifyStatusChange(s, "DOWN", fmt.Sprintf("Service %s is DOWN (status %d)", s.Name, resp.StatusCode))
		}
		return
	}

	// Servicio OK
	s.Status = "UP"
	s.LastCheck = time.Now()

	logJSON("INFO", "health_check_ok", map[string]interface{}{
		"service_name": s.Name,
		"url":          s.URL,
		"status_code":  resp.StatusCode,
		"duration_ms":  duration,
	})

	// Si el servicio se recuperó, notificar
	if oldStatus == "DOWN" {
		logJSON("INFO", "service_recovered", map[string]interface{}{
			"service_name": s.Name,
		})
		notifyStatusChange(s, "UP", fmt.Sprintf("Service %s recovered", s.Name))
	}
}

// notifyStatusChange envía notificación de cambio de estado a RabbitMQ
func notifyStatusChange(s *Service, newStatus, message string) {
	conn, err := amqp.Dial(amqpURI)
	if err != nil {
		logJSON("ERROR", "rabbitmq_connection_failed", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		logJSON("ERROR", "rabbitmq_channel_failed", map[string]interface{}{
			"error": err.Error(),
		})
		return
	}
	defer ch.Close()

	// Publicar en el exchange de eventos
	exchange := getEnv("AUTH_EVENTS_EXCHANGE", "auth.events")
	routingKey := "monitor.alert"

	notification := map[string]interface{}{
		"service":   s.Name,
		"status":    newStatus,
		"message":   message,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"url":       s.URL,
		"emails":    s.Emails,
	}

	body, _ := json.Marshal(notification)

	err = ch.Publish(
		exchange,   // exchange
		routingKey, // routing key
		false,      // mandatory
		false,      // immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
			Timestamp:   time.Now(),
		})

	if err != nil {
		logJSON("ERROR", "rabbitmq_publish_failed", map[string]interface{}{
			"error": err.Error(),
		})
	} else {
		logJSON("INFO", "notification_sent", map[string]interface{}{
			"service":     s.Name,
			"status":      newStatus,
			"routing_key": routingKey,
		})
	}
}

// loggingMiddleware registra todas las peticiones HTTP
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		duration := time.Since(start).Milliseconds()

		logJSON("INFO", "http_request", map[string]interface{}{
			"method":      r.Method,
			"path":        r.URL.Path,
			"duration_ms": duration,
			"remote_addr": r.RemoteAddr,
		})
	})
}

func main() {
	startTime = time.Now()

	// Configuración de logs
	log.SetFlags(0) // Sin prefijos, usamos JSON

	logJSON("INFO", "monitor_starting", map[string]interface{}{
		"version":     version,
		"rabbitmq_url": amqpURI,
		"port":        8085,
	})

	// Router
	r := mux.NewRouter()
	r.Use(loggingMiddleware)

	// Endpoints de gestión
	r.HandleFunc("/register", registerService).Methods("POST")
	r.HandleFunc("/services", getAllHealth).Methods("GET")
	r.HandleFunc("/services/{name}", getServiceHealth).Methods("GET")
	r.HandleFunc("/services/{name}", deleteService).Methods("DELETE")

	// Health checks
	r.HandleFunc("/health", healthEndpoint).Methods("GET")
	r.HandleFunc("/health/live", healthLive).Methods("GET")
	r.HandleFunc("/health/ready", healthReady).Methods("GET")

	logJSON("INFO", "monitor_ready", map[string]interface{}{
		"port": 8085,
	})

	// Servidor HTTP
	if err := http.ListenAndServe(":8085", r); err != nil {
		logJSON("FATAL", "server_failed", map[string]interface{}{
			"error": err.Error(),
		})
		os.Exit(1)
	}
}
