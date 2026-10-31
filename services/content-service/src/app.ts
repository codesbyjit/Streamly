import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import { contentRoutes } from "./routes/content.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie"]
    },
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID()
  });

  app.register(helmet);
  app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  });

  app.register(healthRoutes, { prefix: "/api/v1/content" });
  app.register(contentRoutes, { prefix: "/api/v1/content" });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: "NOT_FOUND", message: "Route not found" });
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred"
    });
  });

  return app;
}