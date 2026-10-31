import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  AUTH_SERVICE_URL: z.string().url().default("http://localhost:3002"),
  CONTENT_SERVICE_URL: z.string().url().default("http://localhost:3003"),
  UPLOAD_SERVICE_URL: z.string().url().default("http://localhost:3004"),
  USER_SERVICE_URL: z.string().url().default("http://localhost:3005"),
  STREAMING_SERVICE_URL: z.string().url().default("http://localhost:3006"),
  SEARCH_SERVICE_URL: z.string().url().default("http://localhost:3007"),
  SOCIAL_SERVICE_URL: z.string().url().default("http://localhost:3008"),
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(source);
}

export type GatewayEnv = ReturnType<typeof loadEnv>;