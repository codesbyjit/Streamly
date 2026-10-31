import type { FastifyRequest } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
}

export interface DomainEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  version: 1;
  occurredAt: string;
  producer: 'social-service';
  data: T;
}
