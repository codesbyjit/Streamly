import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db/pool.js";
import { redis } from "../redis/client.js";

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get("/health/live", async () => ({
    status: "ok",
    service: "live-service",
    timestamp: new Date().toISOString()
  }));

  app.get("/health/ready", async (_request, reply) => {
    const checks: Record<string, "ok" | "error" | "disabled"> = {
      postgres: "error",
      redis: redis ? "error" : "disabled"
    };

    try {
      await pool.query("SELECT 1");
      checks.postgres = "ok";
    } catch {
      checks.postgres = "error";
    }

    if (redis) {
      try {
        await redis.ping();
        checks.redis = "ok";
      } catch {
        checks.redis = "error";
      }
    }

    const ready = Object.values(checks).every((value) => value === "ok" || value === "disabled");
    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      service: "live-service",
      checks
    });
  });
};

export default healthRoute;
