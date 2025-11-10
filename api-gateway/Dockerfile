FROM golang:1.21-alpine AS builder

WORKDIR /app

# Instalar dependencias
RUN apk add --no-cache git

# Copiar go.mod y go.sum
COPY go.mod go.sum ./
RUN go mod download

# Copiar código fuente
COPY . .

# Compilar
RUN CGO_ENABLED=0 GOOS=linux go build -o gateway ./app/main.go

# Stage final
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copiar binario
COPY --from=builder /app/gateway .

EXPOSE 8000

CMD ["./gateway"]