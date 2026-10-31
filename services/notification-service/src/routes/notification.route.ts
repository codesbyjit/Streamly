import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { env } from "../config.js";
import {
    authenticate,
    type AuthenticatedRequest,
} from "../auth.js";

import {
    countUnread,
    createNotification,
    deleteNotification,
    getPreferences,
    listNotifications,
    markAllRead,
    markRead,
    updatePreferences,
} from "../repository.js";

const idSchema = z.string().trim().min(1).max(200);

const createSchema = z.object({
    recipientId: idSchema,

    type: z.enum([
        "video_published",
        "new_subscriber",
        "comment",
        "system",
    ]),

    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2000),

    data: z.record(z.string(), z.unknown()).optional(),

    sourceEventId: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .optional(),
});

const preferencesSchema = z.object({
    inAppEnabled: z.boolean(),
    emailEnabled: z.boolean(),
});

function currentUser(request: AuthenticatedRequest): string {
    if (!request.userId) {
        throw new Error("Authenticated user identity is missing");
    }

    return request.userId;
}

/**
 * User-facing routes.
 *
 * Registered with prefix:
 * /api/v1/notifications
 */
export const notificationRoutes: FastifyPluginAsync = async (app) => {
    app.addHook("preHandler", authenticate);

    app.get("/", async (request, reply) => {
        const query = z
            .object({
                limit: z.coerce
                    .number()
                    .int()
                    .min(1)
                    .max(env.MAX_PAGE_SIZE)
                    .default(env.DEFAULT_PAGE_SIZE),

                cursor: z.string().uuid().optional(),

                unreadOnly: z.coerce.boolean().default(false),
            })
            .safeParse(request.query);

        if (!query.success) {
            return reply.code(400).send({
                error: "validation_error",
                details: query.error.flatten(),
            });
        }

        const result = await listNotifications(
            currentUser(request as AuthenticatedRequest),
            query.data.limit,
            query.data.cursor,
            query.data.unreadOnly,
        );

        return {
            ...result,
            count: result.items.length,
        };
    });

    app.get("/unread-count", async (request) => {
        const userId = currentUser(request as AuthenticatedRequest);

        return {
            count: await countUnread(userId),
        };
    });

    app.patch("/:id/read", async (request, reply) => {
        const params = z
            .object({
                id: z.string().uuid(),
            })
            .safeParse(request.params);

        if (!params.success) {
            return reply.code(400).send({
                error: "invalid_notification_id",
            });
        }

        const notification = await markRead(
            currentUser(request as AuthenticatedRequest),
            params.data.id,
        );

        if (!notification) {
            return reply.code(404).send({
                error: "not_found",
            });
        }

        return { notification };
    });

    app.patch("/read-all", async (request) => {
        const updated = await markAllRead(
            currentUser(request as AuthenticatedRequest),
        );

        return { updated };
    });

    app.delete("/:id", async (request, reply) => {
        const params = z
            .object({
                id: z.string().uuid(),
            })
            .safeParse(request.params);

        if (!params.success) {
            return reply.code(400).send({
                error: "invalid_notification_id",
            });
        }

        const deleted = await deleteNotification(
            currentUser(request as AuthenticatedRequest),
            params.data.id,
        );

        if (!deleted) {
            return reply.code(404).send({
                error: "not_found",
            });
        }

        return reply.code(204).send();
    });

    app.get("/preferences", async (request) => {
        const preferences = await getPreferences(
            currentUser(request as AuthenticatedRequest),
        );

        return { preferences };
    });

    app.put("/preferences", async (request, reply) => {
        const body = preferencesSchema.safeParse(request.body);

        if (!body.success) {
            return reply.code(400).send({
                error: "validation_error",
                details: body.error.flatten(),
            });
        }

        const preferences = await updatePreferences(
            currentUser(request as AuthenticatedRequest),
            body.data.inAppEnabled,
            body.data.emailEnabled,
        );

        return { preferences };
    });
};

/**
 * Internal service-to-service route.
 *
 * Registered with prefix:
 * /internal/v1/notifications
 *
 * Still requires JWT authentication.
 */
export const internalNotificationRoutes: FastifyPluginAsync =
    async (app) => {
        app.addHook("preHandler", authenticate);

        app.post("/", async (request, reply) => {
            const body = createSchema.safeParse(request.body);

            if (!body.success) {
                return reply.code(400).send({
                    error: "validation_error",
                    details: body.error.flatten(),
                });
            }

            const notification = await createNotification(body.data);

            return reply.code(201).send({ notification });
        });
    };