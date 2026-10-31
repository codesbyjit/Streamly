import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createVideoSchema,
  listVideosQuerySchema,
  updateVideoSchema,
  videoIdSchema
} from "../schemas/video.js";
import { VideosService } from "../services/videos.service.js";

const ownerSchema = z.string().uuid();
const service = new VideosService();

function parseOrReply<T>(
  schema: z.ZodType<T>,
  value: unknown,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } }
): T | null {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    reply.code(400).send({
      error: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return null;
  }
  return parsed.data;
}

export async function contentRoutes(app: FastifyInstance) {
  app.post("/", async (request, reply) => {
    const body = parseOrReply(createVideoSchema, request.body, reply);
    if (!body) return;
    const video = await service.create(body);
    return reply.code(201).send({ data: video });
  });

  app.get("/", async (request, reply) => {
    const query = parseOrReply(listVideosQuerySchema, request.query, reply);
    if (!query) return;
    const result = await service.listPublic(query.limit, query.cursor, query.category);
    return reply.send({ data: result.items, page: { nextCursor: result.nextCursor } });
  });

  app.get("/:videoId", async (request, reply) => {
    const params = parseOrReply(z.object({ videoId: videoIdSchema }), request.params, reply);
    if (!params) return;
    const video = await service.get(params.videoId);
    if (!video || video.status === "deleted") {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Video not found" });
    }

    // Private/unlisted visibility is not exposed publicly in this starter.
    if (video.visibility === "private" || video.visibility === "unlisted") {
      return reply.code(404).send({ error: "NOT_FOUND", message: "Video not found" });
    }
    return reply.send({ data: video });
  });

  app.patch("/:videoId", async (request, reply) => {
    const params = parseOrReply(z.object({ videoId: videoIdSchema }), request.params, reply);
    if (!params) return;
    const query = parseOrReply(z.object({ ownerId: ownerSchema }), request.query, reply);
    if (!query) return;
    const body = parseOrReply(updateVideoSchema, request.body, reply);
    if (!body) return;

    const video = await service.update(params.videoId, query.ownerId, body);
    if (!video) {
      return reply.code(404).send({
        error: "NOT_FOUND_OR_NOT_EDITABLE",
        message: "Video not found, not owned by this user, or cannot be edited in its current state"
      });
    }
    return reply.send({ data: video });
  });

  app.delete("/:videoId", async (request, reply) => {
    const params = parseOrReply(z.object({ videoId: videoIdSchema }), request.params, reply);
    if (!params) return;
    const query = parseOrReply(z.object({ ownerId: ownerSchema }), request.query, reply);
    if (!query) return;

    const deleted = await service.delete(params.videoId, query.ownerId);
    if (!deleted) return reply.code(404).send({ error: "NOT_FOUND", message: "Video not found" });
    return reply.code(204).send();
  });

  app.post("/:videoId/publish", async (request, reply) => {
    const params = parseOrReply(z.object({ videoId: videoIdSchema }), request.params, reply);
    if (!params) return;
    const body = parseOrReply(z.object({ ownerId: ownerSchema }), request.body, reply);
    if (!body) return;

    const video = await service.publish(params.videoId, body.ownerId);
    if (!video) {
      return reply.code(409).send({
        error: "NOT_READY",
        message: "Only videos in the ready state can be published"
      });
    }
    return reply.send({ data: video });
  });
}