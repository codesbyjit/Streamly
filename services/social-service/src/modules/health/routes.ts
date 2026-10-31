import type { FastifyInstance } from "fastify";
import { checkDatabase } from "../../db/pool.js";

export async function healthRoutes(app: FastifyInstance) {
    app.get('/health/live', async () => ({ status: 'ok', service: 'social-service' }));
    app.get('/health/ready', async (_request, reply) => {
        try {
            await checkDatabase();
            return { status: 'ready', service: 'social-service', dependencies: { postgres: 'ok' } };
        } catch {
            return reply.code(503).send({ status: 'not_ready', service: 'social-service', dependencies: { postgres: 'error' } });
        }
    });
}