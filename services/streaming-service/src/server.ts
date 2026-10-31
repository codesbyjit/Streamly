import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = await buildApp();

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(`Streaming service listening on ${config.HOST}:${config.PORT}`);
} catch (error) {
  app.log.error({ err: error }, "Failed to start streaming service");
  await app.close();
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down streaming service");
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Graceful shutdown failed");
    process.exit(1);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
