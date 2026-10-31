import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db/pool.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health/live", async (_request, reply) => {
    try {
      await app.pg.query("SELECT 1");
      return { status: "ok", service: "upload-service" };
    } catch {
      return reply.code(503).send({ status: "unavailable", dependency: "postgres" });
    }
  });
  
  app.get("/health/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ready", dependencies: { postgres: "ok" } };
    } catch {
      return reply.code(503).send({
        status: "not_ready",
        dependencies: { postgres: "unavailable" }
      });
    }
  });
};
