import type { FastifyInstance } from "fastify";
import { searchHealth } from "../search/index.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      const search = await searchHealth();
      return { status: "ready", dependencies: { opensearch: search } };
    } catch {
      return reply.code(503).send({
        status: "not_ready",
        dependencies: { opensearch: "unavailable" }
      });
    }
  });
}