import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { env } from "./config/env.js";
import healthRoute from "./routes/health.route.js";
import liveRoute from "./routes/live.route.js";
import analyticsRoute from "./routes/analytic.route.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: true,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID()
  });

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    if (reply.sent) return;
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    return reply.code(statusCode).send({
      error: statusCode === 500 ? "internal_server_error" : "request_error",
      message: statusCode === 500 ? "An unexpected error occurred" : error.message,
      requestId: request.id
    });
  });

  app.get("/", async () => ({ service: "live-service", status: "ok" }));

  await app.register(healthRoute, { prefix: "/api/v1/live" });
  await app.register(liveRoute, { prefix: "/api/v1/live" });
  await app.register(healthRoute, { prefix: "/internal/v1/live" });
  await app.register(analyticsRoute, { prefix: "/internal/v1/live/analytics" });

  return app;
}
