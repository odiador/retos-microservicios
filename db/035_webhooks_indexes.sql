SET search_path = auth, public;

-- Indexes for webhooks table
CREATE INDEX IF NOT EXISTS webhooks_user_idx ON webhooks (user_id);
CREATE INDEX IF NOT EXISTS webhooks_active_idx ON webhooks (active);
CREATE INDEX IF NOT EXISTS webhooks_events_idx ON webhooks USING GIN (events);

-- Indexes for webhook_deliveries table
CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx ON webhook_deliveries (webhook_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_event_type_idx ON webhook_deliveries (event_type);
CREATE INDEX IF NOT EXISTS webhook_deliveries_created_at_idx ON webhook_deliveries (created_at);
