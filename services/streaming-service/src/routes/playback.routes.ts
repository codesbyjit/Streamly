import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { VideoAssetsRepository } from "../repositories/video-assets.repository.js";
import { PlaybackError, PlaybackService } from "../services/playback.service.js";

const paramsSchema = z.object({
  videoId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/)
});

export async function playbackRoutes(app: FastifyInstance) {
  const service = new PlaybackService(new VideoAssetsRepository());

  app.get("/:videoId/playback", {
    preHandler: app.authenticate,
    schema: {
      tags: ["playback"],
      summary: "Resolve an HLS playback session",
      security: [{ bearerAuth: [] }],
      params: { type: "object", required: ["videoId"], properties: { videoId: { type: "string" } } }
    }
  }, async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", message: "Invalid video ID" });
    try {
      return await service.getPlayback(parsed.data.videoId, request.user!.sub);
    } catch (error) {
      if (error instanceof PlaybackError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      request.log.error({ err: error }, "Failed to resolve playback");
      return reply.code(500).send({ error: "internal_error", message: "Unable to resolve playback" });
    }
  });

  app.get("/:videoId/renditions", {
    preHandler: app.authenticate,
    schema: { tags: ["playback"], summary: "List available HLS renditions", security: [{ bearerAuth: [] }] }
  }, async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", message: "Invalid video ID" });
    try {
      const playback = await service.getPlayback(parsed.data.videoId, request.user!.sub);
      return { videoId: playback.videoId, protocol: playback.protocol, renditions: playback.renditions };
    } catch (error) {
      if (error instanceof PlaybackError) {
        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      request.log.error({ err: error }, "Failed to resolve renditions");
      return reply.code(500).send({ error: "internal_error", message: "Unable to resolve renditions" });
    }
  });
}
