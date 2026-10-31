import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db/pool.js";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health/live", async () => ({
    status: "ok",
    service: "notification-service",
  }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");

      return {
        status: "ready",
        dependencies: {
          postgres: "up",
        },
      };
    } catch {
      return reply.code(503).send({
        status: "not_ready",
        dependencies: {
          postgres: "down",
        },
      });
    }
  });
};

export default healthRoutes;