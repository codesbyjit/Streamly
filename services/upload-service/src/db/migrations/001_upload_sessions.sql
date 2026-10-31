CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id VARCHAR(128) NOT NULL,
  video_id UUID NOT NULL DEFAULT gen_random_uuid(),
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(128) NOT NULL,
  expected_size_bytes BIGINT NOT NULL CHECK (expected_size_bytes > 0),
  object_key TEXT NOT NULL UNIQUE,
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploaded', 'completed', 'cancelled', 'expired', 'failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS upload_sessions_owner_created_idx
  ON upload_sessions(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS upload_sessions_expiry_idx
  ON upload_sessions(status, expires_at);

CREATE TABLE IF NOT EXISTS event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS event_outbox_pending_idx
  ON event_outbox(created_at) WHERE published_at IS NULL;
