import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { errorHandler, uploadRoutes } from "./routes/upload.routes.js";
import { healthRoutes } from "./routes/health.routes.js";


declare module "fastify" {
  interface FastifyInstance {
    pg: typeof pool;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    trustProxy: false,
    bodyLimit: 1024 * 1024
  });

  app.decorate("pg", pool);
  app.setErrorHandler(errorHandler);

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    methods: ["GET", "POST", "DELETE", "OPTIONS"]
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(sensible);

  app.register(healthRoutes, { prefix: "/api/v1/upload" });
  await app.register(
    async (uploadApp) => {
      await uploadRoutes(uploadApp);
    },
    { prefix: "api/v1/upload" }
  );

  app.addHook("onClose", async () => {
    // Pool lifecycle is closed by server shutdown handler.
  });
  return app;
}
