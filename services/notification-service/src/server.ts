import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";

import { env } from "./config.js";
import { pool } from "./db/pool.js";

import healthRoutes from "./routes/health.route.js";

import {
  notificationRoutes,
  internalNotificationRoutes,
} from "./routes/notification.route.js";

import {
  startEventConsumer,
  stopEventConsumer,
} from "./events.js";

import { deliverPendingEmails } from "./email.js";

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
  },

  genReqId: () => randomUUID(),

  bodyLimit: 1024 * 1024,
  ignoreTrailingSlash: true,
});

await app.register(helmet);

await app.register(cors, {
  origin: false,
});

await app.register(healthRoutes, {
  prefix: "/api/v1/notification",
});

/**
 * User-facing notification API
 * GET    /api/v1/notifications
 * GET    /api/v1/notifications/unread-count
 * PATCH  /api/v1/notifications/:id/read
 * PATCH  /api/v1/notifications/read-all
 * DELETE /api/v1/notifications/:id
 * GET    /api/v1/notifications/preferences
 * PUT    /api/v1/notifications/preferences
 */
await app.register(notificationRoutes, {
  prefix: "/api/v1/notification",
});

await app.register(internalNotificationRoutes, {
  prefix: "/internal/v1/notification",
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(
    { err: error },
    "Request failed",
  );

  if (reply.sent) {
    return;
  }

  return reply.code(500).send({
    error: "internal_server_error",
    requestId: request.id,
  });
});

let emailTimer: NodeJS.Timeout | undefined;

let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  app.log.info(
    { signal },
    "Shutting down notification service",
  );

  if (emailTimer) {
    clearInterval(emailTimer);
  }

  try {
    await stopEventConsumer();
    await app.close();
    await pool.end();

    process.exitCode = 0;
  } catch (error) {
    app.log.error(
      { err: error },
      "Error during shutdown",
    );

    process.exitCode = 1;
  }
};

try {
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });

  if (env.workerEnabled) {
    await startEventConsumer();

    if (env.emailEnabled) {
      emailTimer = setInterval(() => {
        deliverPendingEmails().catch((error) => {
          app.log.error(
            { err: error },
            "Email outbox processing failed",
          );
        });
      }, 5000);

      emailTimer.unref();

      await deliverPendingEmails().catch((error) => {
        app.log.error(
          { err: error },
          "Initial email outbox processing failed",
        );
      });
    }
  }
} catch (error) {
  app.log.error(
    { err: error },
    "Failed to start notification service",
  );

  process.exitCode = 1;
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});