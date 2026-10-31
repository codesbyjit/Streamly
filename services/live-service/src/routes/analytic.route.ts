import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { publishEvent } from "../events/publisher.js";
import { requireInternalKey } from "../lib/security.js";

const eventSchema = z.object({
  eventType: z.enum(["viewer_joined", "viewer_left", "heartbeat", "stream_started", "stream_ended"]),
  viewerId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({})
});

const analyticsRoute: FastifyPluginAsync = async (app) => {
  app.post("/:streamId/events", async (request, reply) => {
    if (!requireInternalKey(request, reply)) return;
    const params = z.object({ streamId: z.string().uuid() }).safeParse(request.params);
    const body = eventSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "validation_error", params: params.success ? undefined : params.error.issues, issues: body.success ? undefined : body.error.issues });
    }

    const stream = await pool.query("SELECT id FROM live_service.streams WHERE id = $1", [params.data.streamId]);
    if (!stream.rowCount) return reply.code(404).send({ error: "stream_not_found" });

    const inserted = await pool.query(
      `INSERT INTO live_service.stream_analytics
       (stream_id, event_type, viewer_id, session_id, occurred_at, metadata)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6::jsonb)
       RETURNING id, stream_id, event_type, viewer_id, session_id, occurred_at`,
      [
        params.data.streamId,
        body.data.eventType,
        body.data.viewerId ?? null,
        body.data.sessionId ?? null,
        body.data.occurredAt ?? null,
        JSON.stringify(body.data.metadata)
      ]
    );

    await publishEvent("live.analytics.recorded", { streamId: params.data.streamId, analyticsId: inserted.rows[0].id, eventType: body.data.eventType });
    return reply.code(201).send({ event: inserted.rows[0] });
  });

  app.get("/:streamId/summary", async (request, reply) => {
    if (!requireInternalKey(request, reply)) return;
    const params = z.object({ streamId: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_stream_id" });

    const stream = await pool.query("SELECT id, title, status, started_at, ended_at FROM live_service.streams WHERE id = $1", [params.data.streamId]);
    if (!stream.rowCount) return reply.code(404).send({ error: "stream_not_found" });

    const summary = await pool.query(
      `SELECT event_type, COUNT(*)::int AS count
       FROM live_service.stream_analytics
       WHERE stream_id = $1
       GROUP BY event_type`,
      [params.data.streamId]
    );

    return { stream: stream.rows[0], counts: Object.fromEntries(summary.rows.map((row) => [row.event_type, row.count])) };
  });
};

export default analyticsRoute;
