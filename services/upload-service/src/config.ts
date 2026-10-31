import "dotenv/config";
import { z } from "zod";

const bool = z.string().optional().transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4010),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: bool.default("true"),
  S3_PRESIGN_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  S3_UPLOAD_MAX_BYTES: z.coerce.number().int().min(1).default(2_147_483_648),
  S3_ALLOWED_CONTENT_TYPES: z.string().default("video/mp4,video/webm,video/quicktime,video/x-matroska"),
  S3_KEY_PREFIX: z.string().default("originals"),
  KAFKA_BROKERS: z.string().default(""),
  KAFKA_CLIENT_ID: z.string().default("streamly-upload-service"),
  KAFKA_TOPIC_VIDEO_UPLOADED: z.string().default("streamly.video.uploaded.v1"),
  KAFKA_SSL: bool.default("false"),
  DEV_AUTH_ENABLED: bool.default("true"),
  DEV_USER_HEADER: z.string().default("x-dev-user-id"),
  DEV_DEFAULT_USER_ID: z.string().default("local-user-001"),
  UPLOAD_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  CORS_ORIGINS: z.string().default("http://localhost:3000")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const config = parsed.data;
export const allowedContentTypes = new Set(
  config.S3_ALLOWED_CONTENT_TYPES.split(",").map((x) => x.trim()).filter(Boolean)
);
