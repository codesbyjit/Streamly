import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { config } from "./config.js";
import authPlugin from "./auth.js";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.refreshToken"
      ]
    },
    trustProxy: config.NODE_ENV === "production",
    bodyLimit: 1024 * 1024
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute"
  });
  await app.register(authPlugin);

  await app.register(healthRoutes, { prefix: "/api/v1/auth" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: "NOT_FOUND" });
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (reply.sent) return;
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });

  return app;
}
