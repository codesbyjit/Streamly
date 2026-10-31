import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4010),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default("streaming"),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default("streamly-auth"),
  JWT_AUDIENCE: z.string().default("streamly-api"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.string().default("true"),
  PLAYBACK_BASE_URL: z.string().url(),
  PLAYBACK_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(86400).default(900),
  PLAYBACK_TOKEN_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  PLAYBACK_TOKEN_SECRET: z.string().min(32),
  CONTENT_SERVICE_URL: z.string().default(""),
  AUTH_SERVICE_URL: z.string().default(""),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(2500),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid streaming-service environment:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid streaming-service configuration");
}

export const config = {
  ...parsed.data,
  s3ForcePathStyle: parsed.data.S3_FORCE_PATH_STYLE === "true",
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
};
