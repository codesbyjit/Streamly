import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { connectKafka, closeKafka } from "./events/publisher.js";
import { closeRedis, connectRedis } from "./redis/client.js";

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down live-service");
  try {
    await app.close();
    await closeKafka();
    await closeRedis();
    await pool.end();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Graceful shutdown failed");
    process.exit(1);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await pool.query("SELECT 1");
  await connectRedis();
  await connectKafka();
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error({ err: error }, "Failed to start live-service");
  await app.close();
  await closeKafka().catch(() => undefined);
  await closeRedis().catch(() => undefined);
  await pool.end();
  process.exit(1);
}
