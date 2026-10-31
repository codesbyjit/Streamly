CREATE SCHEMA IF NOT EXISTS live_service;

CREATE TABLE IF NOT EXISTS live_service.streams (
    id UUID PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'live', 'ended', 'cancelled')),
    visibility VARCHAR(20) NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'unlisted', 'private')),
    ingest_key_hash TEXT NOT NULL UNIQUE,
    ingest_url TEXT NOT NULL,
    playback_url TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS streams_owner_created_idx
    ON live_service.streams (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS streams_status_created_idx
    ON live_service.streams (status, created_at DESC);

CREATE TABLE IF NOT EXISTS live_service.stream_analytics (
    id BIGSERIAL PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES live_service.streams(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL
        CHECK (event_type IN ('viewer_joined', 'viewer_left', 'heartbeat', 'stream_started', 'stream_ended')),
    viewer_id TEXT,
    session_id TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS stream_analytics_stream_time_idx
    ON live_service.stream_analytics (stream_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS stream_analytics_type_time_idx
    ON live_service.stream_analytics (event_type, occurred_at DESC);
