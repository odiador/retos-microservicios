package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// ============================================
// CONFIGURACIÓN Y ESTRUCTURAS
// ============================================

type Config struct {
	Port               string
	AuthServiceURL     string
	ProfileServiceURL  string // Futuro servicio de perfiles
	OrchestratorURL    string
	JWTSecret          string
}

type ServiceResponse struct {
	StatusCode int
	Body       []byte
	Headers    http.Header
	Error      error
}

type UnifiedUserResponse struct {
	User struct {
		ID           string  `json:"id"`
		Username     string  `json:"username"`
		Email        string  `json:"email"`
		FirstName    *string `json:"firstName"`
		LastName     *string `json:"lastName"`
		Phone        *string `json:"phone"`
		Role         string  `json:"role"`
		Status       string  `json:"status"`
		CreatedAt    string  `json:"createdAt"`
		UpdatedAt    *string `json:"updatedAt"`
		LastLoginAt  *string `json:"lastLoginAt"`
		//futuros campos del servicio de perfiles
		Bio          *string `json:"bio,omitempty"`
		Avatar       *string `json:"avatar,omitempty"`
		Preferences  *string `json:"preferences,omitempty"`
	} `json:"user"`
}

// ============================================
// GATEWAY
// ============================================

type Gateway struct {
	config     *Config
	httpClient *http.Client
}

func NewGateway(config *Config) *Gateway {
	return &Gateway{
		config: config,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ============================================
// MIDDLEWARE - LOGGING
// ============================================

func (g *Gateway) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("[%s] %s %s - Started", r.Method, r.URL.Path, r.RemoteAddr)
		
		// Crear un ResponseWriter personalizado para capturar el status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		
		next.ServeHTTP(rw, r)
		
		duration := time.Since(start)
		log.Printf("[%s] %s - Status: %d - Duration: %v", r.Method, r.URL.Path, rw.statusCode, duration)
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// ============================================
// MIDDLEWARE - CORS
// ============================================

func (g *Gateway) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

// ============================================
// PROXY HELPER
// ============================================

func (g *Gateway) proxyRequest(targetURL string, r *http.Request, body []byte) *ServiceResponse {
	// Crear nueva request
	req, err := http.NewRequest(r.Method, targetURL, bytes.NewReader(body))
	if err != nil {
		return &ServiceResponse{Error: err}
	}

	// Copiar headers
	for key, values := range r.Header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	// Ejecutar request
	resp, err := g.httpClient.Do(req)
	if err != nil {
		return &ServiceResponse{Error: err}
	}
	defer resp.Body.Close()

	// Leer respuesta
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return &ServiceResponse{Error: err}
	}

	return &ServiceResponse{
		StatusCode: resp.StatusCode,
		Body:       responseBody,
		Headers:    resp.Header,
	}
}

// ============================================
// HANDLER - AUTENTICACIÓN (LOGIN)
// ============================================

func (g *Gateway) handleLogin(w http.ResponseWriter, r *http.Request) {
	log.Println("[Gateway] Processing login request")

	// Leer body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	// Proxy al servicio de autenticación
	targetURL := g.config.AuthServiceURL + "/sessions"
	resp := g.proxyRequest(targetURL, r, body)

	if resp.Error != nil {
		log.Printf("[Gateway] Error proxying to auth service: %v", resp.Error)
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	// Copiar headers de respuesta
	for key, values := range resp.Headers {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Enviar respuesta
	w.WriteHeader(resp.StatusCode)
	w.Write(resp.Body)

	log.Printf("[Gateway] Login request completed - Status: %d", resp.StatusCode)
}

// ============================================
// HANDLER - REGISTRO
// ============================================

func (g *Gateway) handleRegister(w http.ResponseWriter, r *http.Request) {
	log.Println("[Gateway] Processing register request")

	// Leer body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	// Proxy al servicio de autenticación
	targetURL := g.config.AuthServiceURL + "/accounts"
	resp := g.proxyRequest(targetURL, r, body)

	if resp.Error != nil {
		log.Printf("[Gateway] Error proxying to auth service: %v", resp.Error)
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	// Copiar headers de respuesta
	for key, values := range resp.Headers {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Enviar respuesta
	w.WriteHeader(resp.StatusCode)
	w.Write(resp.Body)

	log.Printf("[Gateway] Register request completed - Status: %d", resp.StatusCode)
}

// ============================================
// HANDLER - ELIMINACIÓN DE USUARIO
// ============================================

func (g *Gateway) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	username := vars["username"]
	
	log.Printf("[Gateway] Processing delete user request for: %s", username)

	// Extraer token de autorización
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, `{"error":"Authorization header required"}`, http.StatusUnauthorized)
		return
	}

	// Proxy al servicio de autenticación
	targetURL := g.config.AuthServiceURL + "/accounts/" + username
	resp := g.proxyRequest(targetURL, r, nil)

	if resp.Error != nil {
		log.Printf("[Gateway] Error proxying delete request: %v", resp.Error)
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	// Si la eliminación fue exitosa, publicar evento
	if resp.StatusCode == 200 {
		go g.publishUserDeletedEvent(username, authHeader)
	}

	// Copiar headers de respuesta
	for key, values := range resp.Headers {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Enviar respuesta
	w.WriteHeader(resp.StatusCode)
	w.Write(resp.Body)

	log.Printf("[Gateway] Delete user request completed - Status: %d", resp.StatusCode)
}

// Publicar evento de usuario eliminado al orquestador
func (g *Gateway) publishUserDeletedEvent(username string, authHeader string) {
	eventData := map[string]interface{}{
		"type": "user.deleted",
		"data": map[string]string{
			"username": username,
		},
		"meta": map[string]string{
			"timestamp": time.Now().Format(time.RFC3339),
			"source":    "api-gateway",
		},
	}

	jsonData, err := json.Marshal(eventData)
	if err != nil {
		log.Printf("[Gateway] Error marshaling user.deleted event: %v", err)
		return
	}

	req, err := http.NewRequest("POST", g.config.OrchestratorURL+"/orchestrator/user-deleted", bytes.NewReader(jsonData))
	if err != nil {
		log.Printf("[Gateway] Error creating user.deleted event request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader)

	resp, err := g.httpClient.Do(req)
	if err != nil {
		log.Printf("[Gateway] Error sending user.deleted event: %v", err)
		return
	}
	defer resp.Body.Close()

	log.Printf("[Gateway] user.deleted event published - Status: %d", resp.StatusCode)
}

// ============================================
// HANDLER - CONSULTA UNIFICADA DE USUARIO
// ============================================

func (g *Gateway) handleGetUserUnified(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	username := vars["username"]
	
	log.Printf("[Gateway] Processing unified GET user request for: %s", username)

	// Extraer token de autorización
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, `{"error":"Authorization header required"}`, http.StatusUnauthorized)
		return
	}

	// Canal para recibir respuestas
	type ServiceResult struct {
		Name     string
		Response *ServiceResponse
	}
	resultChan := make(chan ServiceResult, 2)
	var wg sync.WaitGroup

	// Consultar servicio de autenticación
	wg.Add(1)
	go func() {
		defer wg.Done()
		targetURL := g.config.AuthServiceURL + "/accounts/" + username
		resp := g.proxyRequest(targetURL, r, nil)
		resultChan <- ServiceResult{Name: "auth", Response: resp}
	}()

	// TODO: Consultar servicio de perfiles cuando esté disponible
	// wg.Add(1)
	// go func() {
	// 	defer wg.Done()
	// 	targetURL := g.config.ProfileServiceURL + "/profiles/" + username
	// 	resp := g.proxyRequest(targetURL, r, nil)
	// 	resultChan <- ServiceResult{Name: "profile", Response: resp}
	// }()

	// Esperar respuestas
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Recolectar respuestas
	results := make(map[string]*ServiceResponse)
	for result := range resultChan {
		results[result.Name] = result.Response
	}

	// Verificar respuesta de auth
	authResp := results["auth"]
	if authResp == nil || authResp.Error != nil {
		log.Printf("[Gateway] Error getting auth data: %v", authResp.Error)
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	if authResp.StatusCode != 200 {
		w.WriteHeader(authResp.StatusCode)
		w.Write(authResp.Body)
		return
	}

	// Parsear respuesta de auth
	var authData map[string]interface{}
	if err := json.Unmarshal(authResp.Body, &authData); err != nil {
		log.Printf("[Gateway] Error parsing auth response: %v", err)
		http.Error(w, "Error processing response", http.StatusInternalServerError)
		return
	}

	// Por ahora, solo retornar datos de auth
	// En el futuro, aquí se combinarían los datos de auth + profile
	unifiedResponse := authData

	// TODO: Cuando el servicio de perfiles esté disponible:
	// if profileResp := results["profile"]; profileResp != nil && profileResp.StatusCode == 200 {
	// 	var profileData map[string]interface{}
	// 	json.Unmarshal(profileResp.Body, &profileData)
	// 	// Combinar profileData con authData
	// }

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(unifiedResponse)

	log.Printf("[Gateway] Unified GET user request completed successfully")
}

// ============================================
// HANDLER - ACTUALIZACIÓN UNIFICADA DE USUARIO
// ============================================

func (g *Gateway) handleUpdateUserUnified(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	username := vars["username"]
	
	log.Printf("[Gateway] Processing unified UPDATE user request for: %s", username)

	// Extraer token de autorización
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, `{"error":"Authorization header required"}`, http.StatusUnauthorized)
		return
	}

	// Leer body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	// Parsear datos
	var updateData map[string]interface{}
	if err := json.Unmarshal(body, &updateData); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Separar datos por servicio
	authFields := map[string]interface{}{}
	profileFields := map[string]interface{}{}

	// Campos que van al servicio de autenticación
	authFieldNames := []string{"firstName", "lastName", "phone", "email"}
	for _, field := range authFieldNames {
		if val, exists := updateData[field]; exists {
			authFields[field] = val
		}
	}

	// Campos que irían al servicio de perfiles (futuro)
	profileFieldNames := []string{"bio", "avatar", "preferences", "address", "birthdate"}
	for _, field := range profileFieldNames {
		if val, exists := updateData[field]; exists {
			profileFields[field] = val
		}
	}

	// Canal para recibir respuestas
	type ServiceResult struct {
		Name     string
		Response *ServiceResponse
		Error    error
	}
	resultChan := make(chan ServiceResult, 2)
	var wg sync.WaitGroup

	// Actualizar en servicio de autenticación si hay campos
	if len(authFields) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			authBody, _ := json.Marshal(authFields)
			targetURL := g.config.AuthServiceURL + "/accounts/" + username
			
			// Crear request PATCH
			req, err := http.NewRequest("PATCH", targetURL, bytes.NewReader(authBody))
			if err != nil {
				resultChan <- ServiceResult{Name: "auth", Error: err}
				return
			}
			
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", authHeader)
			
			resp := g.proxyRequest(targetURL, req, authBody)
			resultChan <- ServiceResult{Name: "auth", Response: resp}
		}()
	}

	// TODO: Actualizar en servicio de perfiles cuando esté disponible
	// if len(profileFields) > 0 {
	// 	wg.Add(1)
	// 	go func() {
	// 		defer wg.Done()
	// 		profileBody, _ := json.Marshal(profileFields)
	// 		targetURL := g.config.ProfileServiceURL + "/profiles/" + username
	// 		resp := g.proxyRequest(targetURL, r, profileBody)
	// 		resultChan <- ServiceResult{Name: "profile", Response: resp}
	// 	}()
	// }

	// Esperar respuestas
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Recolectar respuestas
	results := make(map[string]*ServiceResponse)
	errors := []string{}
	
	for result := range resultChan {
		if result.Error != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", result.Name, result.Error))
			continue
		}
		results[result.Name] = result.Response
		
		if result.Response.StatusCode != 200 {
			errors = append(errors, fmt.Sprintf("%s returned status %d", result.Name, result.Response.StatusCode))
		}
	}

	// Si hubo errores, reportarlos
	if len(errors) > 0 {
		errorMsg := strings.Join(errors, "; ")
		log.Printf("[Gateway] Errors updating user: %s", errorMsg)
		http.Error(w, fmt.Sprintf(`{"error":"Partial update failed: %s"}`, errorMsg), http.StatusInternalServerError)
		return
	}

	// Obtener datos actualizados
	g.handleGetUserUnified(w, r)
	
	log.Printf("[Gateway] Unified UPDATE user request completed successfully")
}

// ============================================
// HANDLER - HEALTH CHECK
// ============================================

func (g *Gateway) handleHealth(w http.ResponseWriter, r *http.Request) {
	health := map[string]interface{}{
		"status": "UP",
		"service": "api-gateway",
		"timestamp": time.Now().Format(time.RFC3339),
		"upstreams": map[string]string{
			"auth": g.config.AuthServiceURL,
			"orchestrator": g.config.OrchestratorURL,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// ============================================
// CONFIGURACIÓN DE RUTAS
// ============================================

func (g *Gateway) setupRoutes() *mux.Router {
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", g.handleHealth).Methods("GET")

	// API v1 routes
	api := router.PathPrefix("/api/v1").Subrouter()

	// Autenticación
	api.HandleFunc("/auth/login", g.handleLogin).Methods("POST")
	api.HandleFunc("/auth/register", g.handleRegister).Methods("POST")

	// Gestión de usuarios - Operaciones simples
	api.HandleFunc("/users/{username}", g.handleDeleteUser).Methods("DELETE")

	// Gestión de usuarios - Operaciones unificadas
	api.HandleFunc("/users/{username}/profile", g.handleGetUserUnified).Methods("GET")
	api.HandleFunc("/users/{username}/profile", g.handleUpdateUserUnified).Methods("PATCH", "PUT")

	return router
}

// ============================================
// MAIN
// ============================================

func main() {
	// Cargar configuración
	config := &Config{
		Port:              getEnv("GATEWAY_PORT", "8000"),
		AuthServiceURL:    getEnv("AUTH_SERVICE_URL", "http://auth:3500"),
		ProfileServiceURL: getEnv("PROFILE_SERVICE_URL", "http://profiles:3600"),
		OrchestratorURL:   getEnv("ORCHESTRATOR_URL", "http://orchestrator:8080"),
		JWTSecret:         getEnv("JWT_SECRET", "mi_secreto_super_seguro"),
	}

	// Crear gateway
	gateway := NewGateway(config)

	// Configurar router
	router := gateway.setupRoutes()

	// Aplicar middlewares
	handler := gateway.loggingMiddleware(gateway.corsMiddleware(router))

	// Información de inicio
	log.Println("===========================================")
	log.Printf("API Gateway started on port %s", config.Port)
	log.Println("===========================================")
	log.Println("Upstream services:")
	log.Printf("  - Auth:        %s", config.AuthServiceURL)
	log.Printf("  - Profiles:    %s (future)", config.ProfileServiceURL)
	log.Printf("  - Orchestrator: %s", config.OrchestratorURL)
	log.Println("===========================================")
	log.Println("Available endpoints:")
	log.Println("  POST   /api/v1/auth/login")
	log.Println("  POST   /api/v1/auth/register")
	log.Println("  DELETE /api/v1/users/{username}")
	log.Println("  GET    /api/v1/users/{username}/profile")
	log.Println("  PATCH  /api/v1/users/{username}/profile")
	log.Println("  GET    /health")
	log.Println("===========================================")

	// Iniciar servidor
	addr := ":" + config.Port
	log.Printf("Listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}