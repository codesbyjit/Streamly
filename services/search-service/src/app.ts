import Fastify from "fastify";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { healthRoutes } from "./routes/health.route.js";
import { searchRoutes } from "./routes/search.route.js";
import { internalRoutes } from "./routes/internal.route.js";

export function buildApp() {
    const app = Fastify({
        logger: false,
        trustProxy: true,
        bodyLimit: 1024 * 1024,
        requestTimeout: 15_000,
    });

    app.addHook("onRequest", async (request, reply) => {
        reply.header("x-request-id", request.id);

        const origin = request.headers.origin;

        if (origin && config.CORS_ORIGINS.includes(origin)) {
            reply.header("access-control-allow-origin", origin);
            reply.header("vary", "Origin");
            reply.header(
                "access-control-allow-headers",
                "content-type,authorization,x-internal-api-key",
            );
            reply.header(
                "access-control-allow-methods",
                "GET,POST,PUT,DELETE,OPTIONS",
            );
        }

        if (request.method === "OPTIONS") {
            return reply.code(204).send();
        }
    });

    app.setErrorHandler((error, request, reply) => {
        logger.error(
            { err: error, requestId: request.id },
            "Request failed",
        );

        const status =
            typeof error === "object" &&
                error !== null &&
                "statusCode" in error &&
                typeof error.statusCode === "number" &&
                error.statusCode >= 400 &&
                error.statusCode < 500
                ? error.statusCode
                : 500;

        return reply.code(status).send({
            error: status === 500 ? "internal_error" : "request_error",
            message:
                status === 500
                    ? "An unexpected error occurred"
                    : error instanceof Error
                        ? error.message
                        : "Request failed",
            requestId: request.id,
        });
    });

    app.register(healthRoutes, { prefix: "/api/v1/search" });
    app.register(searchRoutes, { prefix: "/api/v1/search" });
    app.register(internalRoutes, { prefix: "/internal/v1/search" });

    return app;
}