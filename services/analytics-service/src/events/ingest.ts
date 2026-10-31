import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import type { AnalyticsEvent } from "./schema.js";

function dayFrom(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function hashUserId(userId: unknown): string | null {
  if (typeof userId !== "string" || !userId) return null;
  // Stable pseudonymization for analytics joins; do not store raw user identifiers.
  return createHash("sha256").update(userId).digest("hex");
}

export async function ingestEvent(event: AnalyticsEvent): Promise<{ inserted: boolean }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await insertAndAggregate(client, event);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertAndAggregate(
  client: PoolClient,
  event: AnalyticsEvent
): Promise<{ inserted: boolean }> {
  const data = event.data as Record<string, unknown>;
  const videoId = typeof data.videoId === "string" ? data.videoId : null;
  const channelId = typeof data.channelId === "string" ? data.channelId : null;
  const userIdHash = hashUserId(data.userId);
  const duration = event.eventType === "video.viewed" && typeof data.watchDurationSeconds === "number"
    ? data.watchDurationSeconds
    : 0;

  // Do not persist free-text search queries or raw user identifiers in the event payload.
  const safePayload: Record<string, unknown> = { ...data };
  delete safePayload.userId;
  if (event.eventType === "search.performed") {
    const query = typeof safePayload.query === "string" ? safePayload.query.trim() : "";
    safePayload.queryLength = query.length;
    delete safePayload.query;
  }

  const inserted = await client.query(
    `INSERT INTO analytics_events
      (event_id, event_type, event_version, producer, occurred_at, video_id,
       channel_id, user_id_hash, watch_duration_seconds, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [
      event.eventId, event.eventType, event.version, event.producer, event.occurredAt,
      videoId, channelId, userIdHash, duration, JSON.stringify(safePayload)
    ]
  );

  if (inserted.rowCount === 0) return { inserted: false };

  const day = dayFrom(event.occurredAt);
  const counters = {
    impressions: event.eventType === "video.impression" ? 1 : 0,
    views: event.eventType === "video.viewed" ? 1 : 0,
    completions: event.eventType === "video.completed" ? 1 : 0,
    likes: event.eventType === "video.liked" ? 1 : 0,
    dislikes: event.eventType === "video.disliked" ? 1 : 0,
    subscriptions: event.eventType === "channel.subscribed" ? 1 : 0,
    searches: event.eventType === "search.performed" ? 1 : 0,
    watchSeconds: duration
  };

  await client.query(
    `INSERT INTO analytics_daily_totals
      (day, impressions, views, completions, likes, dislikes, subscriptions, searches, watch_seconds)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (day) DO UPDATE SET
       impressions = analytics_daily_totals.impressions + EXCLUDED.impressions,
       views = analytics_daily_totals.views + EXCLUDED.views,
       completions = analytics_daily_totals.completions + EXCLUDED.completions,
       likes = analytics_daily_totals.likes + EXCLUDED.likes,
       dislikes = analytics_daily_totals.dislikes + EXCLUDED.dislikes,
       subscriptions = analytics_daily_totals.subscriptions + EXCLUDED.subscriptions,
       searches = analytics_daily_totals.searches + EXCLUDED.searches,
       watch_seconds = analytics_daily_totals.watch_seconds + EXCLUDED.watch_seconds,
       updated_at = NOW()`,
    [day, counters.impressions, counters.views, counters.completions, counters.likes,
      counters.dislikes, counters.subscriptions, counters.searches, counters.watchSeconds]
  );

  if (videoId) {
    await client.query(
      `INSERT INTO analytics_video_daily
        (day, video_id, impressions, views, completions, likes, dislikes, watch_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (day, video_id) DO UPDATE SET
         impressions = analytics_video_daily.impressions + EXCLUDED.impressions,
         views = analytics_video_daily.views + EXCLUDED.views,
         completions = analytics_video_daily.completions + EXCLUDED.completions,
         likes = analytics_video_daily.likes + EXCLUDED.likes,
         dislikes = analytics_video_daily.dislikes + EXCLUDED.dislikes,
         watch_seconds = analytics_video_daily.watch_seconds + EXCLUDED.watch_seconds,
         updated_at = NOW()`,
      [day, videoId, counters.impressions, counters.views, counters.completions,
        counters.likes, counters.dislikes, counters.watchSeconds]
    );
  }

  return { inserted: true };
}