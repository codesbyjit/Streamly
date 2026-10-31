import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../config.js";
import { feedQuerySchema, interactionSchema } from "../schemas/recommendation.schema.js";
import { getFeed, getTrending, recordInteraction } from "../services/recommendation.service.js";
import { healthRoute } from "./health.route.js";

function getUserId(request: FastifyRequest): string | null {
  const value = request.headers["x-user-id"];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function recommendationRoute(app: FastifyInstance): Promise<void> {
  await healthRoute(app);

  app.get("/feed", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized", message: "Missing authenticated user identity" });
    }
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const limit = Math.min(parsed.data.limit ?? env.DEFAULT_FEED_LIMIT, env.MAX_FEED_LIMIT);
    const feed = await getFeed({ userId, limit, category: parsed.data.category, cursor: parsed.data.cursor });
    return { items: feed.items, nextCursor: feed.nextCursor };
  });

  app.get("/trending", async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    const limit = Math.min(parsed.data.limit ?? env.DEFAULT_FEED_LIMIT, env.MAX_FEED_LIMIT);
    const items = await getTrending(limit, env.TRENDING_WINDOW_HOURS);
    return { items };
  });

  app.post("/interactions", async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: "unauthorized", message: "Missing authenticated user identity" });
    }
    const parsed = interactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
    }
    await recordInteraction({ userId, ...parsed.data });
    return reply.code(201).send({ status: "recorded" });
  });
}