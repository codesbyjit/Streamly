import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../config.js";
import { analyticsQuerySchema, videoProjectionSchema } from "../schemas/recommendation.schema.js";
import { getAnalyticsSummary, upsertVideoProjection } from "../services/recommendation.service.js";

function requireInternalKey(request: FastifyRequest): boolean {
  const key = request.headers["x-internal-api-key"];
  return typeof key === "string" && key.length > 0 && key === env.INTERNAL_API_KEY;
}

export async function analyticsRoute(app: FastifyInstance): Promise<void> {
  app.post("/videos", async (request, reply) => {
    if (!requireInternalKey(request)) {
      return reply.code(401).send({ error: "unauthorized", message: "Missing or invalid internal API key" });
    }
    const parsed = videoProjectionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    await upsertVideoProjection(parsed.data);
    return reply.code(200).send({ status: "ok", videoId: parsed.data.videoId });
  });

  app.get("/analytics/summary", async (request, reply) => {
    if (!requireInternalKey(request)) {
      return reply.code(401).send({ error: "unauthorized", message: "Missing or invalid internal API key" });
    }
    const parsed = analyticsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const events = await getAnalyticsSummary(parsed.data.sinceHours);
    return { sinceHours: parsed.data.sinceHours, events };
  });
}