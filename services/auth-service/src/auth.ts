import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { config } from "./config.js";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

const authPlugin: FastifyPluginAsync = async (app) => {
  await app.register(jwt, {
    secret: config.JWT_ACCESS_SECRET,
    sign: {
      iss: config.JWT_ISSUER,
      aud: config.JWT_AUDIENCE,
      expiresIn: config.JWT_ACCESS_TTL
    },
    verify: {
      allowedIss: config.JWT_ISSUER,
      allowedAud: config.JWT_AUDIENCE
    }
  });
};

export default fp(authPlugin, { name: "streamly-jwt" });

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "A valid access token is required"
    });
  }
}
