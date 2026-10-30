import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp({ env });

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });

    app.log.info(
      `API Gateway listening on ${env.HOST}:${env.PORT}`
    );
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exitCode = 1;
    return;
  }

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info({ signal }, "Shutting down API Gateway");

    try {
      await app.close();
      process.exitCode = 0;
    } catch (error) {
      app.log.error(error);
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start API Gateway:", error);
  process.exitCode = 1;
});