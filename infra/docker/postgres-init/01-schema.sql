CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    password_hash VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CHANNELS
-- =====================================================

CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    subscriber_count BIGINT DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- VIDEOS
-- =====================================================

CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'uploading',
    visibility VARCHAR(20) DEFAULT 'private',
    duration_seconds INT,
    thumbnail_urls JSONB DEFAULT '{}'::jsonb,
    video_urls JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    category_id INT,
    language VARCHAR(10) DEFAULT 'en',
    view_count BIGINT DEFAULT 0,
    like_count INT DEFAULT 0,
    dislike_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    published_at TIMESTAMPTZ,
    search_vector TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes

CREATE INDEX idx_videos_channel
ON videos(channel_id, published_at DESC);

CREATE INDEX idx_videos_status
ON videos(status)
WHERE status = 'ready';

CREATE INDEX idx_videos_published_views
ON videos(published_at DESC, view_count DESC);

CREATE INDEX idx_videos_fts
ON videos
USING GIN(search_vector);

-- =====================================================
-- SUBSCRIPTIONS
-- =====================================================

CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    notify BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, channel_id)
);

CREATE INDEX idx_subscriptions_user
ON subscriptions(user_id, subscribed_at DESC);

-- =====================================================
-- WATCH HISTORY
-- =====================================================

CREATE TABLE watch_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    watch_time_seconds INT DEFAULT 0,
    completion_rate FLOAT DEFAULT 0,
    liked BOOLEAN,
    watched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, video_id)
);

CREATE INDEX idx_watch_history_user
ON watch_history(user_id, watched_at DESC);

-- =====================================================
-- COMMENTS
-- =====================================================

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INT DEFAULT 0,
    reply_count INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    path LTREE,
    depth INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_video
ON comments(video_id, created_at DESC);

CREATE INDEX idx_comments_tree
ON comments USING GIST(path);

-- =====================================================
-- PLAYLISTS
-- =====================================================

CREATE TABLE playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    visibility VARCHAR(20) DEFAULT 'private',
    video_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playlist_items (
    id BIGSERIAL PRIMARY KEY,
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    position INT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, video_id)
);

-- =====================================================
-- UPLOAD SESSIONS
-- =====================================================

CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    chunk_size INT DEFAULT 5242880,
    total_chunks INT NOT NULL,
    uploaded_chunks INT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================
-- TRANSCODE JOBS
-- =====================================================

CREATE TABLE transcode_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    input_path TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    progress INT DEFAULT 0,
    outputs JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LIVE STREAMS
-- =====================================================

CREATE TABLE live_streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'idle',
    stream_key VARCHAR(255) UNIQUE NOT NULL,
    ingest_url TEXT,
    playback_url TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    viewer_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SEARCH VECTOR TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION videos_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_videos_search_vector
BEFORE INSERT OR UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION videos_search_vector_update();

-- =====================================================
-- AUTO CHANNEL CREATION
-- =====================================================

CREATE OR REPLACE FUNCTION create_user_channel()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO channels (owner_id, name, description)
    VALUES (
        NEW.id,
        NEW.username || chr(39) || 's Channel',
        'Welcome to my channel!'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_channel
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_channel();