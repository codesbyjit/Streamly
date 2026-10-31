import { buildApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { pool } from "./db/pool.js";
import { connectKafka, disconnectKafka } from "./kafka/producer.js";
import { dispatchOutboxBatch } from "./services/upload.service.js";

async function main() {
  await migrate();
  try {
    await connectKafka();
    console.log("Kafka connected");
  } catch (error) {
    // Service can still accept uploads; events remain in the outbox until Kafka recovers.
    console.warn("Kafka unavailable; outbox events will be retried", error);
  }

  const app = await buildApp();
  await app.listen({ host: config.HOST, port: config.PORT });

  const timer = setInterval(() => {
    void dispatchOutboxBatch().catch((error) => app.log.error({ err: error }, "Outbox dispatch failed"));
  }, 3000);
  timer.unref();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down upload service");
    clearInterval(timer);
    await app.close();
    await disconnectKafka().catch(() => undefined);
    await pool.end();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Upload service failed to start", error);
  process.exit(1);
});
