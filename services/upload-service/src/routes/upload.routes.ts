import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getOwnerId } from "./auth.js";
import {
  completeUpload,
  createUpload,
  getUpload,
  cancelUpload,
  UploadError
} from "../services/upload.service.js";
import {
  createUploadSchema,
  uploadIdSchema
} from "../schemas/upload.js";

function parseOrReply<T>(
  schema: z.ZodType<T>,
  value: unknown,
  reply: {
    code: (status: number) => {
      send: (body?: unknown) => unknown;
    };
  }
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

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/", async (request, reply) => {
    const body = parseOrReply(
      createUploadSchema,
      request.body,
      reply
    );

    if (!body) return;

    const ownerId = getOwnerId(request);
    const upload = await createUpload(ownerId, body);

    return reply.code(201).send({
      data: upload
    });
  });

  app.post("/:uploadId/complete", async (request, reply) => {
    const params = parseOrReply(
      z.object({
        uploadId: uploadIdSchema
      }),
      request.params,
      reply
    );

    if (!params) return;

    const ownerId = getOwnerId(request);

    const upload = await completeUpload(
      ownerId,
      params.uploadId
    );

    return reply.send({
      data: upload
    });
  });

  app.get("/:uploadId", async (request, reply) => {
    const params = parseOrReply(
      z.object({
        uploadId: uploadIdSchema
      }),
      request.params,
      reply
    );

    if (!params) return;

    const ownerId = getOwnerId(request);

    const upload = await getUpload(
      ownerId,
      params.uploadId
    );

    return reply.send({
      data: upload
    });
  });

  app.delete("/:uploadId", async (request, reply) => {
    const params = parseOrReply(
      z.object({
        uploadId: uploadIdSchema
      }),
      request.params,
      reply
    );

    if (!params) return;

    const ownerId = getOwnerId(request);

    const upload = await cancelUpload(
      ownerId,
      params.uploadId
    );

    return reply.send({
      data: upload
    });
  });
}

export function errorHandler(
  error: Error & { statusCode?: number },
  _request: unknown,
  reply: {
    code: (status: number) => {
      send: (body?: unknown) => unknown;
    };
  }
): unknown {
  if (error instanceof UploadError) {
    return reply.code(error.statusCode).send({
      error: error.message
    });
  }

  console.error(error);

  const statusCode =
    error.statusCode &&
    error.statusCode >= 400 &&
    error.statusCode < 500
      ? error.statusCode
      : 500;

  return reply.code(statusCode).send({
    error:
      statusCode === 500
        ? "Internal server error"
        : error.message
  });
}