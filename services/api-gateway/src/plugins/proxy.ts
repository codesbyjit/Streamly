import fastifyHttpProxy from "@fastify/http-proxy";
import type { FastifyInstance } from "fastify";
import type { GatewayEnv } from "../config/env.js";

export async function registerProxies(
  app: FastifyInstance,
  env: GatewayEnv
) {
  await app.register(fastifyHttpProxy, {
    upstream: env.AUTH_SERVICE_URL,
    prefix: "/api/v1/auth",
    rewritePrefix: "/api/v1/auth"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.CONTENT_SERVICE_URL,
    prefix: "/api/v1/videos",
    rewritePrefix: "/api/v1/videos"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.SEARCH_SERVICE_URL,
    prefix: "/api/v1/search",
    rewritePrefix: "/api/v1/search"
  });
}