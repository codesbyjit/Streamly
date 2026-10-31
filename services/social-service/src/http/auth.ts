import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const requireIdentity: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const internalKey = request.headers[env.TRUSTED_INTERNAL_KEY_HEADER] as string | undefined;
  const userId = request.headers[env.TRUSTED_ID_HEADER] as string | undefined;

  if (!internalKey || !safeEqual(internalKey, env.INTERNAL_API_KEY)) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Missing or invalid internal gateway credentials' });
  }
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Missing or invalid authenticated user identity' });
  }
  (request as FastifyRequest & { userId: string }).userId = userId;
};
