import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createIngestKey() {
  return randomBytes(32).toString("base64url");
}

export function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.headers["x-user-id"];
  if (typeof userId !== "string" || userId.trim().length === 0) {
    reply.code(401).send({ error: "unauthorized", message: "Missing authenticated user identity" });
    return null;
  }
  return userId;
}

export function requireInternalKey(request: FastifyRequest, reply: FastifyReply) {
  const provided = request.headers["x-internal-api-key"];
  if (typeof provided !== "string") {
    reply.code(401).send({ error: "unauthorized", message: "Missing internal API key" });
    return false;
  }
  const expectedBuffer = Buffer.from(env.INTERNAL_API_KEY);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    reply.code(401).send({ error: "unauthorized", message: "Invalid internal API key" });
    return false;
  }
  return true;
}
