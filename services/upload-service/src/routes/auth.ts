import type { FastifyRequest } from "fastify";
import { config } from "../config.js";
import { UploadError } from "../services/upload.service.js";

export function getOwnerId(request: FastifyRequest): string {
  // Replace this with verified JWT claims or trusted gateway identity in production.
  if (config.NODE_ENV === "production" || !config.DEV_AUTH_ENABLED) {
    throw new UploadError(501, "Production authentication integration is not configured");
  }
  const header = request.headers[config.DEV_USER_HEADER.toLowerCase()];
  const value = Array.isArray(header) ? header[0] : header;
  const ownerId = (typeof value === "string" ? value : config.DEV_DEFAULT_USER_ID).trim();
  if (!ownerId || ownerId.length > 128) throw new UploadError(401, "Invalid development identity");
  return ownerId;
}
