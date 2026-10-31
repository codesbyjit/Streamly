import { buildApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { startConsumer, stopConsumer } from "./events/consumer.js";
import { ensureIndex, openSearch } from "./search/index.js";

const app = buildApp();

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Shutting down search service");

  try {
    await app.close();
    await stopConsumer();
    await openSearch.close();

    process.exitCode = 0;
  } catch (error) {
    logger.error({ err: error }, "Shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

async function main() {
  try {
    await ensureIndex();

    await app.listen({
      host: config.HOST,
      port: config.PORT,
    });

    logger.info(
      { host: config.HOST, port: config.PORT },
      "Search service listening",
    );

    await startConsumer();
  } catch (error) {
    logger.fatal({ err: error }, "Search service failed to start");

    try {
      await app.close();
      await stopConsumer();
      await openSearch.close();
    } catch (cleanupError) {
      logger.error(
        { err: cleanupError },
        "Startup cleanup failed",
      );
    }

    process.exitCode = 1;
  }
}

void main();