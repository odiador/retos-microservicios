#!/usr/bin/env node

/**
 * Script de ejemplo para probar webhooks localmente
 * 
 * Este script simula un servidor receptor de webhooks
 * para verificar que la funcionalidad está implementada correctamente.
 */

import http from 'http';
import crypto from 'crypto';

// El secret que recibirías al crear un webhook
let WEBHOOK_SECRET = null;

function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    console.log('⚠️  No se ha configurado el secret del webhook aún');
    return true; // Permitir para pruebas iniciales
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

function handleWebhook(req, res, body) {
  const signature = req.headers['x-webhook-signature'];
  const eventType = req.headers['x-webhook-event'];
  
  const payload = JSON.parse(body);
  
  console.log('\n📬 Webhook recibido!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Evento: ${eventType}`);
  console.log(`🔑 Firma: ${signature}`);
  console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
  
  // Verificar la firma
  if (!verifySignature(payload, signature)) {
    console.log('❌ Firma inválida!');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid signature' }));
    return;
  }
  
  console.log('✅ Firma válida');
  
  // Procesar el evento
  switch (eventType) {
    case 'user.created':
      console.log(`👤 Nuevo usuario creado: ${payload.data.username}`);
      break;
    case 'user.login':
      console.log(`🔐 Usuario inició sesión: ${payload.data.username}`);
      break;
    case 'user.updated':
      console.log(`📝 Usuario actualizado: ${payload.data.username}`);
      break;
    case 'user.deleted':
      console.log(`🗑️  Usuario eliminado: ${payload.data.username}`);
      break;
    case 'password.reset.requested':
      console.log(`🔒 Solicitud de reseteo de contraseña para: ${payload.data.email}`);
      break;
    case 'password.updated':
      console.log(`🔐 Contraseña actualizada para: ${payload.data.username}`);
      break;
    default:
      console.log(`❓ Evento desconocido: ${eventType}`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Responder rápidamente
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ received: true, timestamp: new Date().toISOString() }));
}

function handleConfigure(req, res, body) {
  const data = JSON.parse(body);
  const { secret } = data;
  
  if (secret) {
    WEBHOOK_SECRET = secret;
    console.log('✅ Secret del webhook configurado');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Secret configurado exitosamente' }));
  } else {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Secret requerido' }));
  }
}

function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'ok', 
    secret_configured: !!WEBHOOK_SECRET 
  }));
}

const server = http.createServer((req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'GET' && req.url === '/health') {
    handleHealth(req, res);
    return;
  }
  
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        if (req.url === '/webhook') {
          handleWebhook(req, res, body);
        } else if (req.url === '/configure') {
          handleConfigure(req, res, body);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (error) {
        console.error('Error procesando petición:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.WEBHOOK_PORT || 3001;

server.listen(PORT, () => {
  console.log('\n🎯 Servidor de webhooks de prueba iniciado');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Escuchando en: http://localhost:${PORT}/webhook`);
  console.log(`⚙️  Configurar secret: POST http://localhost:${PORT}/configure`);
  console.log(`❤️  Health check: GET http://localhost:${PORT}/health`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 Pasos para probar:');
  console.log('   1. Inicia el servidor de autenticación');
  console.log('   2. Registra/inicia sesión para obtener un token');
  console.log('   3. Crea un webhook apuntando a http://localhost:' + PORT + '/webhook');
  console.log('   4. Copia el secret y configúralo: curl -X POST http://localhost:' + PORT + '/configure -H "Content-Type: application/json" -d \'{"secret":"TU_SECRET"}\'');
  console.log('   5. Realiza acciones (registro, login, etc.) y observa los webhooks\n');
});
