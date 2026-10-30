import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db.js";

const app = await buildApp();

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(`Streamly auth-service listening on ${config.HOST}:${config.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await db.end();
}

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down auth-service");
  await app.close();
  await db.end();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
