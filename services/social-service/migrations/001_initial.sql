CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS social_service.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES social_service.comments(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comments_body_nonempty CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS comments_video_created_idx
  ON social_service.comments(video_id, created_at DESC, id DESC)
  WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS comments_parent_created_idx
  ON social_service.comments(parent_id, created_at ASC, id ASC)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS comments_user_created_idx
  ON social_service.comments(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_service.video_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT video_reactions_user_video_unique UNIQUE (video_id, user_id)
);

CREATE INDEX IF NOT EXISTS video_reactions_video_reaction_idx
  ON social_service.video_reactions(video_id, reaction);

CREATE TABLE IF NOT EXISTS social_service.channel_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT channel_subscriptions_unique UNIQUE (channel_id, user_id),
  CONSTRAINT channel_subscriptions_not_self CHECK (channel_id <> user_id)
);

CREATE INDEX IF NOT EXISTS channel_subscriptions_user_created_idx
  ON social_service.channel_subscriptions(user_id, created_at DESC, channel_id);

CREATE INDEX IF NOT EXISTS channel_subscriptions_channel_idx
  ON social_service.channel_subscriptions(channel_id, created_at DESC);
