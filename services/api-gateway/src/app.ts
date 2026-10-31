import Fastify from "fastify";
import helmet from "@fastify/helmet";

import { loadEnv, type GatewayEnv } from "./config/env.js";
import { registerRequestId } from "./middleware/request-id.js";
import { registerErrorHandler } from "./middleware/error-handler.js";
import { registerProxies } from "./plugins/proxy.js";
import { registerHealthRoute } from "./routes/health.routes.js";

interface BuildAppOptions {
  env?: GatewayEnv;
  enableProxies?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = options.env ?? loadEnv();
  const enableProxies = options.enableProxies ?? true;

  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    requestIdHeader: false,
    disableRequestLogging: false
  });

  await app.register(helmet);

  registerRequestId(app);
  registerErrorHandler(app);

  await registerHealthRoute(app, env);

  if (enableProxies) {
    await registerProxies(app, env);
  }

  return app;
}