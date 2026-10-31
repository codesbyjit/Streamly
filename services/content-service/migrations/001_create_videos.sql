CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title varchar(120) NOT NULL,
  description text NOT NULL DEFAULT '',
  category varchar(80),
  tags text[] NOT NULL DEFAULT '{}',
  visibility varchar(16) NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'unlisted', 'private')),
  status varchar(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'uploading', 'processing', 'ready', 'published', 'failed', 'deleted')),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  source_object_key text,
  thumbnail_object_key text,
  hls_master_object_key text,
  failure_reason text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (char_length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS videos_owner_created_idx
  ON videos (owner_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS videos_public_feed_idx
  ON videos (published_at DESC, id) WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS videos_category_idx
  ON videos (category, published_at DESC) WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS videos_tags_gin_idx ON videos USING gin (tags);
CREATE INDEX IF NOT EXISTS videos_updated_at_idx ON videos (updated_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS videos_set_updated_at ON videos;
CREATE TRIGGER videos_set_updated_at
BEFORE UPDATE ON videos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();