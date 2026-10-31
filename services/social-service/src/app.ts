import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { checkDatabase } from './db/pool.js';
import { registerErrorHandler } from './http/errors.js';
import { commentRoutes } from './modules/comments/routes.js';
import { reactionRoutes } from './modules/reactions/routes.js';
import { subscriptionRoutes } from './modules/subscriptions/routes.js';
import { healthRoutes } from './modules/health/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: false,
    genReqId: request => request.headers['x-request-id']?.toString().slice(0, 128) || crypto.randomUUID(),
    bodyLimit: 64 * 1024
  });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW
  });

  registerErrorHandler(app);

  await app.register(async api => {
    await api.register(healthRoutes);
    await api.register(commentRoutes);
    await api.register(reactionRoutes);
    await api.register(subscriptionRoutes);
  }, { prefix: '/api/v1/social' });

  return app;
}
