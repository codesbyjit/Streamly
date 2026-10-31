import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./config.js";

export interface AuthenticatedRequest extends FastifyRequest {
  userId?: string;
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Minimal HS256 JWT verification using Node crypto.
 * In production, use your shared auth library if Streamly already has one.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyJwt(token: string): Record<string, unknown> | null {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(decodeBase64Url(parts[0]!).toString("utf8"));
    const payload = JSON.parse(decodeBase64Url(parts[1]!).toString("utf8"));
    if (header.alg !== "HS256") return null;

    const expected = createHmac("sha256", env.JWT_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const actual = decodeBase64Url(parts[2]!);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp <= now) return null;
    if (typeof payload.nbf === "number" && payload.nbf > now) return null;
    if (env.JWT_ISSUER && payload.iss !== env.JWT_ISSUER) return null;

    if (env.JWT_AUDIENCE) {
      const aud = payload.aud;
      if (!(aud === env.JWT_AUDIENCE || (Array.isArray(aud) && aud.includes(env.JWT_AUDIENCE)))) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function authenticate(request: AuthenticatedRequest, reply: FastifyReply) {
  // Health endpoints are public. All API routes require a verified bearer token
  // when JWT_SECRET is configured. Without a secret, fail closed for application APIs.
  if (request.url.startsWith("/health") || request.url === "/ready") return;

  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "unauthorized", message: "Missing bearer token" });
  }

  const payload = verifyJwt(authorization.slice("Bearer ".length));
  if (!payload) {
    return reply.code(401).send({ error: "unauthorized", message: "Invalid or expired token" });
  }

  const userId = payload.sub ?? payload.userId ?? payload.user_id;
  if (typeof userId !== "string" || !userId.trim()) {
    return reply.code(401).send({ error: "unauthorized", message: "Token has no user identity" });
  }
  request.userId = userId;
}
