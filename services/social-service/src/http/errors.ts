import type { FastifyInstance } from 'fastify';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const status = Number((error as { statusCode?: number }).statusCode) || 500;
    const code = (error as { code?: string }).code;
    if (status >= 500) request.log.error({ err: error }, 'Request failed');
    reply.code(status).send({
      error: status >= 500 ? 'internal_server_error' : (code ?? 'request_error'),
      message: status >= 500 ? 'An unexpected error occurred' : error.message,
      requestId: request.id
    });
  });
}
