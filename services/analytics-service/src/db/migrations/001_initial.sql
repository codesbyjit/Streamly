CREATE TABLE IF NOT EXISTS analytics_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  producer TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  video_id TEXT,
  channel_id TEXT,
  user_id_hash TEXT,
  watch_duration_seconds INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at
  ON analytics_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date
  ON analytics_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_video_date
  ON analytics_events (video_id, occurred_at DESC)
  WHERE video_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_channel_date
  ON analytics_events (channel_id, occurred_at DESC)
  WHERE channel_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS analytics_video_daily (
  day DATE NOT NULL,
  video_id TEXT NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  views BIGINT NOT NULL DEFAULT 0,
  completions BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  dislikes BIGINT NOT NULL DEFAULT 0,
  watch_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day, video_id)
);

CREATE TABLE IF NOT EXISTS analytics_daily_totals (
  day DATE PRIMARY KEY,
  impressions BIGINT NOT NULL DEFAULT 0,
  views BIGINT NOT NULL DEFAULT 0,
  completions BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  dislikes BIGINT NOT NULL DEFAULT 0,
  subscriptions BIGINT NOT NULL DEFAULT 0,
  searches BIGINT NOT NULL DEFAULT 0,
  watch_seconds BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);