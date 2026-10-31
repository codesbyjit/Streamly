CREATE TABLE IF NOT EXISTS recommendation_videos (
  video_id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('processing', 'published', 'private', 'unlisted', 'deleted')),
  view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  like_count BIGINT NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recommendation_videos_feed_idx
  ON recommendation_videos (status, published_at DESC);
CREATE INDEX IF NOT EXISTS recommendation_videos_category_idx
  ON recommendation_videos (category, published_at DESC);
CREATE INDEX IF NOT EXISTS recommendation_videos_engagement_idx
  ON recommendation_videos (view_count DESC, like_count DESC);

CREATE TABLE IF NOT EXISTS recommendation_interactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL
    CHECK (interaction_type IN ('impression', 'click', 'watch', 'complete', 'like', 'dislike', 'skip')),
  watch_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watch_duration_seconds >= 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS recommendation_interactions_user_time_idx
  ON recommendation_interactions (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS recommendation_interactions_video_type_idx
  ON recommendation_interactions (video_id, interaction_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS recommendation_interactions_type_time_idx
  ON recommendation_interactions (interaction_type, occurred_at DESC);
