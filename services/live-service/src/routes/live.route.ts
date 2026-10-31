import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { publishEvent } from "../events/publisher.js";
import { createIngestKey, hashSecret, requireUser } from "../lib/security.js";
import { redis } from "../redis/client.js";

const createStreamSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(5000).default(""),
  visibility: z.enum(["public", "unlisted", "private"]).default("public")
});

const streamIdSchema = z.string().uuid();

const liveRoute: FastifyPluginAsync = async (app) => {
  app.post("/streams", async (request, reply) => {
    const ownerId = requireUser(request, reply);
    if (!ownerId) return;

    const parsed = createStreamSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });
    }

    const active = await pool.query(
      "SELECT COUNT(*)::int AS count FROM live_service.streams WHERE owner_id = $1 AND status IN ('created', 'live')",
      [ownerId]
    );

    if (active.rows[0].count >= env.MAX_ACTIVE_STREAMS_PER_USER) {
      return reply.code(409).send({ error: "active_stream_limit", message: "Active stream limit reached" });
    }

    const streamId = randomUUID();
    const ingestKey = createIngestKey();
    const ingestUrl = `${env.STREAM_INGEST_BASE_URL.replace(/\/$/, "")}/${ingestKey}`;
    const playbackUrl = `${env.STREAM_PLAYBACK_BASE_URL.replace(/\/$/, "")}/${streamId}/index.m3u8`;

    const result = await pool.query(
      `INSERT INTO live_service.streams
       (id, owner_id, title, description, visibility, ingest_key_hash, ingest_url, playback_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, owner_id, title, description, status, visibility, ingest_url, playback_url, created_at, updated_at`,
      [streamId, ownerId, parsed.data.title, parsed.data.description, parsed.data.visibility, hashSecret(ingestKey), ingestUrl, playbackUrl]
    );

    await publishEvent("live.stream.created", { streamId, ownerId, visibility: parsed.data.visibility });

    return reply.code(201).send({
      stream: result.rows[0],
      ingestKey,
      warning: "The ingest key is shown only once. Store it securely. Ingest and playback URLs require a configured media server."
    });
  });

  app.get("/streams", async (request, reply) => {
    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
      status: z.enum(["created", "live", "ended", "cancelled"]).optional()
    });
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "validation_error", issues: parsed.error.issues });

    const { limit, offset, status } = parsed.data;
    const result = await pool.query(
      `SELECT id, owner_id, title, description, status, visibility, playback_url, started_at, created_at
       FROM live_service.streams
       WHERE visibility = 'public' AND ($1::text IS NULL OR status = $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [status ?? null, limit, offset]
    );

    return { items: result.rows, limit, offset };
  });

  app.get("/streams/:streamId", async (request, reply) => {
    const params = z.object({ streamId: streamIdSchema }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_stream_id" });

    const result = await pool.query(
      `SELECT id, owner_id, title, description, status, visibility, playback_url, started_at, ended_at, created_at, updated_at
       FROM live_service.streams WHERE id = $1`,
      [params.data.streamId]
    );
    const stream = result.rows[0];
    if (!stream || stream.visibility === "private") {
      return reply.code(404).send({ error: "stream_not_found" });
    }

    if (redis) {
      try {
        const viewers = await redis.get(`${env.REDIS_KEY_PREFIX}viewers:${stream.id}`);
        return { stream, viewerCount: Number(viewers ?? 0) };
      } catch {
        return { stream, viewerCount: null };
      }
    }
    return { stream, viewerCount: null };
  });

  app.post("/streams/:streamId/start", async (request, reply) => {
    const ownerId = requireUser(request, reply);
    if (!ownerId) return;
    const params = z.object({ streamId: streamIdSchema }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_stream_id" });

    const result = await pool.query(
      `UPDATE live_service.streams
       SET status = 'live', started_at = COALESCE(started_at, NOW()), ended_at = NULL, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2 AND status = 'created'
       RETURNING id, owner_id, title, status, started_at, updated_at`,
      [params.data.streamId, ownerId]
    );
    if (!result.rowCount) return reply.code(409).send({ error: "invalid_stream_state_or_owner" });

    await publishEvent("live.stream.started", { streamId: params.data.streamId, ownerId });
    return { stream: result.rows[0] };
  });

  app.post("/streams/:streamId/end", async (request, reply) => {
    const ownerId = requireUser(request, reply);
    if (!ownerId) return;
    const params = z.object({ streamId: streamIdSchema }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_stream_id" });

    const result = await pool.query(
      `UPDATE live_service.streams
       SET status = 'ended', ended_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND owner_id = $2 AND status IN ('created', 'live')
       RETURNING id, owner_id, title, status, ended_at, updated_at`,
      [params.data.streamId, ownerId]
    );
    if (!result.rowCount) return reply.code(409).send({ error: "invalid_stream_state_or_owner" });

    await publishEvent("live.stream.ended", { streamId: params.data.streamId, ownerId });
    if (redis) await redis.del(`${env.REDIS_KEY_PREFIX}viewers:${params.data.streamId}`).catch(() => undefined);
    return { stream: result.rows[0] };
  });

  app.delete("/streams/:streamId", async (request, reply) => {
    const ownerId = requireUser(request, reply);
    if (!ownerId) return;
    const params = z.object({ streamId: streamIdSchema }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_stream_id" });

    const result = await pool.query(
      `UPDATE live_service.streams SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND owner_id = $2 AND status = 'created'
       RETURNING id, status`,
      [params.data.streamId, ownerId]
    );
    if (!result.rowCount) return reply.code(409).send({ error: "stream_cannot_be_cancelled" });
    await publishEvent("live.stream.cancelled", { streamId: params.data.streamId, ownerId });
    return { stream: result.rows[0] };
  });
};

export default liveRoute;
