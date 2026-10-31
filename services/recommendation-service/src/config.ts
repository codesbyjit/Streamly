import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3010),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  INTERNAL_API_KEY: z.string().min(16).default("change_this_internal_key"),
  DEFAULT_FEED_LIMIT: z.coerce.number().int().min(1).max(50).default(20),
  MAX_FEED_LIMIT: z.coerce.number().int().min(1).max(100).default(50),
  TRENDING_WINDOW_HOURS: z.coerce.number().int().min(1).max(8760).default(168)
});

export const env = envSchema.parse(process.env);