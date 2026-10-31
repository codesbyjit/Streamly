import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { healthRoutes } from "./routes/health.route.js";
import { profileRoutes } from "./routes/profiles.route.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    trustProxy: false,
    bodyLimit: 64 * 1024
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW
  });

  await app.register(healthRoutes, { prefix: "/api/v1/user" });
  await app.register(profileRoutes, { prefix: "/api/v1/user" });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: "not_found" });
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled request error");
    return reply.code(500).send({ error: "internal_error" });
  });

  return app;
}
