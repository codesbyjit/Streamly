import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { deleteVideo, ensureIndex, indexVideo } from "../search/index.js";
import { isSearchable, videoDocumentSchema } from "../search/video-document.js";

function authorized(request: FastifyRequest): boolean {
  if (!config.INTERNAL_API_KEY) return config.NODE_ENV !== "production";
  return request.headers["x-internal-api-key"] === config.INTERNAL_API_KEY;
}

export async function internalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (!authorized(request)) {
      return reply.code(401).send({ error: "unauthorized", message: "Missing or invalid internal API key" });
    }
  });

  app.post("/reindex", async (request, reply) => {
    const body = z.object({ recreate: z.boolean().default(false) }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    await ensureIndex(body.data.recreate);
    return { status: "ok", recreated: body.data.recreate };
  });

  app.put("/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1).max(200) }).safeParse(request.params);
    const body = videoDocumentSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: "validation_error",
        details: [...(params.success ? [] : params.error.issues), ...(body.success ? [] : body.error.issues)]
      });
    }
    if (params.data.id !== body.data.id) {
      return reply.code(400).send({ error: "id_mismatch", message: "Path id must match body id" });
    }
    if (!isSearchable(body.data)) {
      await deleteVideo(body.data.id);
      return { status: "removed_from_search", id: body.data.id };
    }
    await indexVideo(body.data);
    return { status: "indexed", id: body.data.id };
  });

  app.delete("/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1).max(200) }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    await deleteVideo(params.data.id);
    return { status: "deleted", id: params.data.id };
  });
}