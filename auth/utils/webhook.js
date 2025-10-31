import crypto from 'crypto'
import db from '../db.js'

const SCHEMA = process.env.DB_SCHEMA || 'auth'
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 15000] // 1s, 5s, 15s
const MAX_RESPONSE_BODY_LENGTH = 5000 // Maximum characters to store from response/error
const MAX_CONCURRENT_WEBHOOKS = 10 // Maximum concurrent webhook deliveries

/**
 * Generates HMAC signature for webhook payload
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
}

/**
 * Sends webhook to a single endpoint with retries
 */
async function sendWebhook(webhook, eventType, eventData, attempt = 1) {
  const payload = {
    event: eventType,
    data: eventData,
    timestamp: new Date().toISOString(),
    webhook_id: webhook.id,
  }

  const signature = generateSignature(payload, webhook.secret)

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'User-Agent': 'Microservicios-Webhook/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    const responseBody = await response.text()

    // Log delivery
    await db(
      `INSERT INTO ${SCHEMA}.webhook_deliveries 
       (webhook_id, event_type, payload, response_status, response_body, attempt, delivered_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [webhook.id, eventType, payload, response.status, responseBody.substring(0, MAX_RESPONSE_BODY_LENGTH), attempt]
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseBody}`)
    }

    console.log(`[webhook] Successfully delivered ${eventType} to ${webhook.url}`)
    return { success: true, status: response.status }

  } catch (error) {
    console.error(`[webhook] Failed to deliver ${eventType} to ${webhook.url} (attempt ${attempt}):`, error.message)

    // Log failed delivery
    await db(
      `INSERT INTO ${SCHEMA}.webhook_deliveries 
       (webhook_id, event_type, payload, error, attempt) 
       VALUES ($1, $2, $3, $4, $5)`,
      [webhook.id, eventType, payload, error.message.substring(0, MAX_RESPONSE_BODY_LENGTH), attempt]
    )

    // Retry logic
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt] || 15000 // Use next delay index since attempt starts at 1
      console.log(`[webhook] Retrying in ${delay}ms...`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
      return sendWebhook(webhook, eventType, eventData, attempt + 1)
    }

    return { success: false, error: error.message }
  }
}

/**
 * Triggers webhooks for a specific event type
 */
export async function triggerWebhooks(eventType, eventData) {
  try {
    // Find all active webhooks subscribed to this event type
    const result = await db(
      `SELECT id, user_id, name, url, events, secret 
       FROM ${SCHEMA}.webhooks 
       WHERE active = TRUE 
       AND $1 = ANY(events)`,
      [eventType]
    )

    if (result.rows.length === 0) {
      console.log(`[webhook] No webhooks registered for event: ${eventType}`)
      return
    }

    console.log(`[webhook] Triggering ${result.rows.length} webhook(s) for event: ${eventType}`)

    // Send webhooks with concurrency limit to prevent overwhelming the system
    const webhooks = result.rows
    const batchSize = MAX_CONCURRENT_WEBHOOKS
    
    for (let i = 0; i < webhooks.length; i += batchSize) {
      const batch = webhooks.slice(i, i + batchSize)
      const promises = batch.map(webhook => 
        sendWebhook(webhook, eventType, eventData).catch(err => {
          console.error(`[webhook] Unhandled error for webhook ${webhook.id}:`, err)
        })
      )
      
      // Process each batch sequentially, but webhooks within batch are parallel
      await Promise.allSettled(promises)
    }

  } catch (error) {
    console.error('[webhook] Error triggering webhooks:', error)
  }
}

/**
 * Gets webhook by ID
 */
export async function getWebhook(webhookId, userId) {
  const result = await db(
    `SELECT id, user_id, name, url, events, active, created_at, updated_at 
     FROM ${SCHEMA}.webhooks 
     WHERE id = $1 AND user_id = $2`,
    [webhookId, userId]
  )
  return result.rows[0] || null
}

/**
 * Lists all webhooks for a user
 */
export async function listWebhooks(userId) {
  const result = await db(
    `SELECT id, user_id, name, url, events, active, created_at, updated_at 
     FROM ${SCHEMA}.webhooks 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  )
  return result.rows
}

/**
 * Creates a new webhook
 */
export async function createWebhook(userId, { name, url, events }) {
  // Generate a random secret for webhook verification
  const secret = crypto.randomBytes(32).toString('hex')

  const result = await db(
    `INSERT INTO ${SCHEMA}.webhooks (user_id, name, url, events, secret) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING id, user_id, name, url, events, secret, active, created_at, updated_at`,
    [userId, name, url, events]
  )
  return result.rows[0]
}

/**
 * Updates an existing webhook
 */
export async function updateWebhook(webhookId, userId, updates) {
  const sets = []
  const params = []
  let i = 1

  if (updates.name !== undefined) { 
    sets.push(`name = $${i++}`)
    params.push(updates.name) 
  }
  if (updates.url !== undefined) { 
    sets.push(`url = $${i++}`)
    params.push(updates.url) 
  }
  if (updates.events !== undefined) { 
    sets.push(`events = $${i++}`)
    params.push(updates.events) 
  }
  if (updates.active !== undefined) { 
    sets.push(`active = $${i++}`)
    params.push(updates.active) 
  }

  if (sets.length === 0) {
    throw new Error('No fields to update')
  }

  sets.push(`updated_at = NOW()`)
  params.push(webhookId, userId)

  const result = await db(
    `UPDATE ${SCHEMA}.webhooks 
     SET ${sets.join(', ')} 
     WHERE id = $${i++} AND user_id = $${i++}
     RETURNING id, user_id, name, url, events, active, created_at, updated_at`,
    params
  )

  if (result.rows.length === 0) {
    throw new Error('Webhook not found')
  }

  return result.rows[0]
}

/**
 * Deletes a webhook
 */
export async function deleteWebhook(webhookId, userId) {
  const result = await db(
    `DELETE FROM ${SCHEMA}.webhooks 
     WHERE id = $1 AND user_id = $2 
     RETURNING id`,
    [webhookId, userId]
  )
  return result.rows.length > 0
}

/**
 * Gets webhook deliveries for a specific webhook
 */
export async function getWebhookDeliveries(webhookId, userId, limit = 50) {
  // First verify the webhook belongs to the user
  const webhook = await getWebhook(webhookId, userId)
  if (!webhook) {
    throw new Error('Webhook not found')
  }

  const result = await db(
    `SELECT id, webhook_id, event_type, payload, response_status, response_body, 
            error, attempt, delivered_at, created_at 
     FROM ${SCHEMA}.webhook_deliveries 
     WHERE webhook_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [webhookId, limit]
  )
  return result.rows
}

export default {
  triggerWebhooks,
  getWebhook,
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  generateSignature,
}
