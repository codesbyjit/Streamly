import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { searchVideos, suggestTitles } from "../search/index.js";

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().trim().min(1).max(100).optional(),
  creatorId: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(["relevance", "recent", "popular"]).default("relevance")
});

export async function searchRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_query",
        message: "Invalid search parameters",
        details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
      });
    }
    const q = parsed.data.q?.trim();
    if (q === "") {
      return reply.code(400).send({ error: "invalid_query", message: "q cannot be empty" });
    }
    return searchVideos({ ...parsed.data, q });
  });

  app.get("/suggest", async (request, reply) => {
    const parsed = z.object({
      q: z.string().trim().min(1).max(100),
      limit: z.coerce.number().int().min(1).max(10).default(8)
    }).safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_query", details: parsed.error.issues });
    }
    return { items: await suggestTitles(parsed.data.q, parsed.data.limit) };
  });
}