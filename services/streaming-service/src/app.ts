import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import authPlugin from "./plugins/auth.js";
import storagePlugin from "./plugins/storage.js";
import { healthRoutes } from "./routes/health.routes.js";
import { playbackRoutes } from "./routes/playback.routes.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    trustProxy: config.NODE_ENV === "production",
    requestIdHeader: "x-request-id",
    bodyLimit: 1024 * 1024
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW
  });
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: { title: "Streamly Streaming Service", version: "1.0.0" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
        }
      }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
  await app.register(authPlugin);
  await app.register(storagePlugin);

  await app.register(healthRoutes, { prefix: "/api/v1/stream" });
  await app.register(playbackRoutes, { prefix: "/api/v1/stream" });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: "not_found", message: "Route not found" });
  });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  return app;
}
