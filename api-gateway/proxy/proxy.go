package proxy

import (
    "net/http"
    "net/http/httputil"
    "net/url"
)

func main() {
    // URL del servicio backend
    target, _ := url.Parse("http://localhost:8081")
    
    // Crear el reverse proxy
    proxy := httputil.NewSingleHostReverseProxy(target)
    
    // Endpoint de autenticación
    http.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
        proxy.ServeHTTP(w, r)
    })

	//Endpoint de sms
	http.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
        proxy.ServeHTTP(w, r)
    })

    //Endpoint de monitoreo
	http.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
        proxy.ServeHTTP(w, r)
    })

	//Endpoint de logs
	http.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
        proxy.ServeHTTP(w, r)
    })

    http.ListenAndServe(":8080", nil)
}