import type { FastifyPluginAsync } from "fastify";
import { checkDatabase } from "../db.js";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      await checkDatabase();
      return { status: "ready", dependencies: { postgres: "ok" } };
    } catch {
      return reply.code(503).send({
        status: "not_ready",
        dependencies: { postgres: "unavailable" }
      });
    }
  });
};

export default healthRoutes;
