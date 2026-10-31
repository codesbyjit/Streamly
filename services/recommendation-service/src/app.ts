import Fastify from "fastify";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { env } from "./config.js";
import { analyticsRoute } from "./routes/analytics.route.js";
import { recommendationRoute } from "./routes/recommendation.route.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: env.NODE_ENV === "production",
    requestIdHeader: "x-request-id",
    bodyLimit: 1_048_576
  });

  await app.register(helmet);
  await app.register(sensible);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    if (reply.sent) return;
    return reply.code(500).send({ error: "internal_server_error", message: "An unexpected error occurred" });
  });

  await app.register(recommendationRoute, { prefix: "/api/v1/recommendation" });
  await app.register(analyticsRoute, { prefix: "/internal/v1/recommendation" });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: "not_found", message: "Route not found" });
  });

  return app;
}