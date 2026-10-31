CREATE SCHEMA IF NOT EXISTS streaming;

CREATE TABLE IF NOT EXISTS streaming.video_assets (
  video_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'READY', 'FAILED', 'DELETED')),
  visibility TEXT NOT NULL CHECK (visibility IN ('PUBLIC', 'UNLISTED', 'PRIVATE')),
  master_manifest_key TEXT NOT NULL,
  renditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_seconds NUMERIC(12, 3),
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(renditions) = 'array')
);

CREATE INDEX IF NOT EXISTS video_assets_owner_idx
  ON streaming.video_assets (owner_id);

CREATE INDEX IF NOT EXISTS video_assets_ready_visibility_idx
  ON streaming.video_assets (status, visibility)
  WHERE status = 'READY';
