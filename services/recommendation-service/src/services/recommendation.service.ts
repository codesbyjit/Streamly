import { pool } from "../db/pool.js";

export type InteractionType = "impression" | "click" | "watch" | "complete" | "like" | "dislike" | "skip";

export interface Video {
  videoId: string;
  creatorId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  thumbnailUrl: string | null;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  score: number;
}

function mapVideo(row: Record<string, unknown>, score = 0): Video {
  return {
    videoId: String(row.video_id),
    creatorId: String(row.creator_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    category: String(row.category ?? "general"),
    tags: (row.tags as string[] | undefined) ?? [],
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    publishedAt: new Date(String(row.published_at)).toISOString(),
    viewCount: Number(row.view_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    score
  };
}

export async function getFeed(input: {
  userId: string;
  limit: number;
  category?: string;
  cursor?: string;
}): Promise<{ items: Video[]; nextCursor: string | null }> {
  const preferences = await pool.query<{ category: string; weight: number }>(
    `SELECT v.category,
      SUM(CASE i.interaction_type
        WHEN 'complete' THEN 5
        WHEN 'like' THEN 4
        WHEN 'watch' THEN 2
        WHEN 'click' THEN 1
        WHEN 'dislike' THEN -5
        WHEN 'skip' THEN -2
        ELSE 0 END)::float AS weight
     FROM recommendation_interactions i
     JOIN recommendation_videos v ON v.video_id = i.video_id
     WHERE i.user_id = $1 AND i.occurred_at > NOW() - INTERVAL '90 days'
     GROUP BY v.category`,
    [input.userId]
  );

  const preferenceMap = new Map(preferences.rows.map((row) => [row.category, Number(row.weight)]));
  const result = await pool.query(
    `SELECT v.*
     FROM recommendation_videos v
     WHERE v.status = 'published'
       AND ($1::text IS NULL OR v.category = $1)
       AND ($2::timestamptz IS NULL OR v.published_at < $2)
       AND NOT EXISTS (
         SELECT 1 FROM recommendation_interactions i
         WHERE i.user_id = $3 AND i.video_id = v.video_id
           AND i.interaction_type IN ('watch', 'complete', 'dislike')
       )
     ORDER BY v.published_at DESC
     LIMIT $4`,
    [input.category ?? null, input.cursor ?? null, input.userId, input.limit + 1]
  );

  const hasMore = result.rows.length > input.limit;
  const rows = result.rows.slice(0, input.limit);
  const items = rows.map((row) => {
    const categoryScore = preferenceMap.get(String(row.category)) ?? 0;
    const ageHours = Math.max(0, (Date.now() - new Date(String(row.published_at)).getTime()) / 3_600_000);
    const recencyScore = Math.max(0, 100 - ageHours / 2);
    const engagementScore = Math.log1p(Number(row.view_count)) + Math.log1p(Number(row.like_count)) * 3;
    return mapVideo(row, categoryScore * 10 + recencyScore + engagementScore);
  }).sort((a, b) => b.score - a.score);

  return {
    items,
    nextCursor: hasMore && rows.length ? new Date(String(rows[rows.length - 1].published_at)).toISOString() : null
  };
}

export async function getTrending(limit: number, sinceHours: number): Promise<Video[]> {
  const result = await pool.query(
    `SELECT v.*,
      COALESCE(SUM(CASE i.interaction_type
        WHEN 'watch' THEN GREATEST(i.watch_duration_seconds, 1)
        WHEN 'complete' THEN 60
        WHEN 'like' THEN 20
        WHEN 'click' THEN 2
        ELSE 0 END), 0)::float AS recent_score
     FROM recommendation_videos v
     LEFT JOIN recommendation_interactions i
       ON i.video_id = v.video_id
      AND i.occurred_at >= NOW() - ($1::int * INTERVAL '1 hour')
     WHERE v.status = 'published'
     GROUP BY v.video_id
     ORDER BY recent_score DESC, v.view_count DESC, v.published_at DESC
     LIMIT $2`,
    [sinceHours, limit]
  );
  return result.rows.map((row) => mapVideo(row, Number(row.recent_score ?? 0)));
}

export async function recordInteraction(input: {
  userId: string;
  videoId: string;
  type: InteractionType;
  watchDurationSeconds: number;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO recommendation_interactions
        (user_id, video_id, interaction_type, watch_duration_seconds, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [input.userId, input.videoId, input.type, input.watchDurationSeconds, JSON.stringify(input.metadata)]
    );
    if (input.type === "watch" || input.type === "complete") {
      await client.query(
        "UPDATE recommendation_videos SET view_count = view_count + 1, updated_at = NOW() WHERE video_id = $1",
        [input.videoId]
      );
    } else if (input.type === "like") {
      await client.query(
        "UPDATE recommendation_videos SET like_count = like_count + 1, updated_at = NOW() WHERE video_id = $1",
        [input.videoId]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertVideoProjection(input: {
  videoId: string;
  creatorId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  thumbnailUrl?: string | null;
  publishedAt?: string;
  status: string;
  viewCount: number;
  likeCount: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO recommendation_videos
      (video_id, creator_id, title, description, category, tags, thumbnail_url, published_at, status, view_count, like_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, NOW()),$9,$10,$11)
     ON CONFLICT (video_id) DO UPDATE SET
       creator_id = EXCLUDED.creator_id,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       category = EXCLUDED.category,
       tags = EXCLUDED.tags,
       thumbnail_url = EXCLUDED.thumbnail_url,
       published_at = EXCLUDED.published_at,
       status = EXCLUDED.status,
       view_count = EXCLUDED.view_count,
       like_count = EXCLUDED.like_count,
       updated_at = NOW()`,
    [input.videoId, input.creatorId, input.title, input.description, input.category, input.tags,
      input.thumbnailUrl ?? null, input.publishedAt ?? null, input.status, input.viewCount, input.likeCount]
  );
}

export async function getAnalyticsSummary(sinceHours: number) {
  const result = await pool.query(
    `SELECT interaction_type AS type, COUNT(*)::int AS count,
       COUNT(DISTINCT user_id)::int AS unique_users,
       COUNT(DISTINCT video_id)::int AS unique_videos,
       COALESCE(SUM(watch_duration_seconds), 0)::bigint AS watch_duration_seconds
     FROM recommendation_interactions
     WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 hour')
     GROUP BY interaction_type
     ORDER BY count DESC`,
    [sinceHours]
  );
  return result.rows;
}