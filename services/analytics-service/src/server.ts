import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";

import { env } from "./config.js";
import { pool } from "./db/pool.js";
import {
  startKafkaConsumer,
  stopKafkaConsumer,
} from "./kafka/consumer.js";
import {
  registry,
  httpRequests,
  ingestedEvents,
  duplicateEvents,
} from "./metrics.js";
import { eventSchema } from "./events/schema.js";
import { ingestEvent } from "./events/ingest.js";
import analyticsRoute from "./routes/analytics.routes.js";
import healthRoute from "./routes/health.routes.js";

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },
  trustProxy: true,
  bodyLimit: 256 * 1024,
  requestIdHeader: "x-request-id",
  genReqId: () => randomUUID(),
});

await app.register(helmet);

await app.register(cors, {
  origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false,
  credentials: true,
});

app.addHook("onResponse", async (request, reply) => {
  httpRequests.inc({
    method: request.method,
    route: request.routeOptions.url ?? "unmatched",
    status: String(reply.statusCode),
  });
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, "Request failed");

  const statusCode = (error as { statusCode?: number }).statusCode;

  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.code(statusCode).send({
      error: "bad_request",
      message: error.message,
    });
  }

  return reply.code(500).send({
    error: "internal_server_error",
    requestId: request.id,
  });
});

await app.register(analyticsRoute, {
  prefix: "/api/v1/analytics",
});

await app.register(analyticsRoute, {
  prefix: "/internal/v1/analytics",
});

await app.register(healthRoute, {
  prefix: "/api/v1/analytics",
});

await app.register(healthRoute, {
  prefix: "/internal/v1/analytics",
});

app.get("/health", async () => ({
  status: "ok",
  service: "analytics-service",
  timestamp: new Date().toISOString(),
}));

app.get("/ready", async (_request, reply) => {
  try {
    await pool.query("SELECT 1");

    return {
      status: "ready",
      service: "analytics-service",
    };
  } catch {
    return reply.code(503).send({
      status: "not_ready",
      service: "analytics-service",
    });
  }
});

app.get("/metrics", async (_request, reply) => {
  reply.header("Content-Type", registry.contentType);
  return registry.metrics();
});

app.post("/internal/v1/events", async (request, reply) => {
  if (
    env.INGEST_API_KEY &&
    request.headers["x-ingest-api-key"] !== env.INGEST_API_KEY
  ) {
    return reply.code(401).send({
      error: "unauthorized",
    });
  }

  const parsed = eventSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({
      error: "invalid_event",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const result = await ingestEvent(parsed.data);

  if (result.inserted) {
    ingestedEvents.inc({
      event_type: parsed.data.eventType,
    });
  } else {
    duplicateEvents.inc();
  }

  return reply.code(result.inserted ? 202 : 200).send({
    accepted: true,
    duplicate: !result.inserted,
    eventId: parsed.data.eventId,
  });
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;

  shuttingDown = true;
  app.log.info({ signal }, "Shutting down analytics service");

  try {
    await app.close();
    await stopKafkaConsumer();
    await pool.end();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Graceful shutdown failed");
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

async function main() {
  if (env.DB_MIGRATE_ON_START) {
    const { runMigrations } = await import("./db/migrate-runner.js");
    await runMigrations();
  }

  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });

  try {
    await startKafkaConsumer();
  } catch (error) {
    app.log.error(
      { err: error },
      "Kafka consumer failed to start; HTTP server remains available",
    );
  }
}

main().catch((error) => {
  app.log.error({ err: error }, "Service startup failed");
  process.exit(1);
});