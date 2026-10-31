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
    prefix: "/api/v1/content",
    rewritePrefix: "/api/v1/content"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.UPLOAD_SERVICE_URL,
    prefix: "/api/v1/upload",
    rewritePrefix: "/api/v1/upload"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.USER_SERVICE_URL,
    prefix: "/api/v1/user",
    rewritePrefix: "/api/v1/user"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.STREAMING_SERVICE_URL,
    prefix: "/api/v1/stream",
    rewritePrefix: "/api/v1/stream"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.SEARCH_SERVICE_URL,
    prefix: "/api/v1/search",
    rewritePrefix: "/api/v1/search"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.SEARCH_SERVICE_URL,
    prefix: "/internal/v1/search",
    rewritePrefix: "/internal/v1/search"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.SOCIAL_SERVICE_URL,
    prefix: "/api/v1/social",
    rewritePrefix: "/api/v1/social"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.NOTIFICATION_SERVICE_URL,
    prefix: "/api/v1/notification",
    rewritePrefix: "/api/v1/notification"
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.NOTIFICATION_SERVICE_URL,
    prefix: "/internal/v1/notification",
    rewritePrefix: "/internal/v1/notification"
  });
}