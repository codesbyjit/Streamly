import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  AUTH_SERVICE_URL: z.string().url().default("http://localhost:3001"),
  CONTENT_SERVICE_URL: z.string().url().default("http://localhost:3002"),
  SEARCH_SERVICE_URL: z.string().url().default("http://localhost:3003")
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(source);
}

export type GatewayEnv = ReturnType<typeof loadEnv>;