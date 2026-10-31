import type { FastifyInstance } from "fastify";
import { checkDatabase } from "../db/pool.js";

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get("/health/ready", async (_request, reply) => {
    try {
      await checkDatabase();
      return { status: "ok", service: "recommendation-service", dependencies: { postgres: "ok" } };
    } catch {
      return reply.code(503).send({
        status: "unavailable",
        service: "recommendation-service",
        dependencies: { postgres: "unavailable" }
      });
    }
  });
}