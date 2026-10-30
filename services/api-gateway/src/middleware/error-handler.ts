import type { FastifyInstance, FastifyError } from "fastify";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    request.log.error(
      {
        err: error,
        requestId: request.id
      },
      "Request failed"
    );

    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
        message:
          statusCode >= 500
            ? "An unexpected error occurred"
            : error.message,
        requestId: request.id
      }
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: request.id
      }
    });
  });
}
