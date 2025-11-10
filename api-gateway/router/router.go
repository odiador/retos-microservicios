package router

type Route struct {
    Path    string
    Service string
}

var routes = []Route{
    {"/api/users", "http://localhost:8081"},
    {"/api/orders", "http://localhost:8082"},
    {"/api/products", "http://localhost:8083"},
}