import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db/pool.js";
import { env } from "../config.js";
import { isKafkaConnected } from "../kafka/consumer.js";

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get("health/", async () => ({
    status: "ok",
    service: "analytics-service",
    timestamp: new Date().toISOString(),
  }));

  app.get("/health/live", async () => ({
    status: "ok",
    service: "analytics-service",
  }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
    } catch {
      return reply.code(503).send({
        status: "not_ready",
        service: "analytics-service",
        dependencies: {
          postgres: "disconnected",
          kafka: env.KAFKA_ENABLED
            ? isKafkaConnected()
              ? "connected"
              : "disconnected"
            : "disabled",
        },
      });
    }

    return {
      status: "ready",
      service: "analytics-service",
      dependencies: {
        postgres: "connected",
        kafka: env.KAFKA_ENABLED
          ? isKafkaConnected()
            ? "connected"
            : "disconnected"
          : "disabled",
      },
    };
  });
};

export default healthRoute;