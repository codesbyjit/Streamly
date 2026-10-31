import { pool } from "./pool.js";
import { env } from "../config.js";

const schema = env.DATABASE_SCHEMA;

const sql = `
CREATE SCHEMA IF NOT EXISTS "${schema}";

CREATE TABLE IF NOT EXISTS "${schema}".notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_event_id TEXT UNIQUE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON "${schema}".notifications (recipient_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON "${schema}".notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS "${schema}".notification_preferences (
  user_id TEXT PRIMARY KEY,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schema}".notification_outbox (
  id BIGSERIAL PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES "${schema}".notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email')),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE (notification_id, channel)
);

CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON "${schema}".notification_outbox (next_attempt_at, id)
  WHERE status IN ('pending', 'failed');
`;

try {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await pool.query(sql);
  console.log(`Notification schema "${schema}" is ready.`);
} catch (error) {
  console.error("Notification migration failed", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
