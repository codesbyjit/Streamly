import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { jwtVerify } from "jose";
import { config } from "../config.js";
import type { AuthenticatedUser } from "../types.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

export default fp(async (app) => {
  const secret = new TextEncoder().encode(config.JWT_SECRET);

  app.decorateRequest("user", null);

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "unauthorized", message: "Missing bearer token" });
    }

    try {
      const { payload } = await jwtVerify(header.slice(7), secret, {
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
        algorithms: ["HS256"]
      });
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        return reply.code(401).send({ error: "unauthorized", message: "Token subject is missing" });
      }
      request.user = { sub: payload.sub, roles: Array.isArray(payload.roles) ? payload.roles.filter((r): r is string => typeof r === "string") : [] };
    } catch {
      return reply.code(401).send({ error: "unauthorized", message: "Invalid or expired bearer token" });
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  }
}
