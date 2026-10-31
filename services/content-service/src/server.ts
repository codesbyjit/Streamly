import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

const app = buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down content service");
  try {
    await app.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Shutdown failed");
    process.exit(1);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error({ err: error }, "Failed to start content service");
  await pool.end();
  process.exit(1);
}