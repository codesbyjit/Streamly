import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3007),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),
  OPENSEARCH_NODE: z.string().url().default("http://localhost:9200"),
  OPENSEARCH_INDEX: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/).default("streamly-videos-v1"),
  OPENSEARCH_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  KAFKA_ENABLED: z.string().default("true").transform((v) => v.toLowerCase() === "true"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("streamly-search-service"),
  KAFKA_GROUP_ID: z.string().default("streamly-search-service-v1"),
  KAFKA_TOPICS: z.string().default("video.published,video.updated,video.deleted"),
  KAFKA_FROM_BEGINNING: z.string().default("false").transform((v) => v.toLowerCase() === "true"),
  INTERNAL_API_KEY: z.string().default(""),
  CORS_ORIGINS: z.string().default("")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  KAFKA_BROKERS: parsed.data.KAFKA_BROKERS.split(",").map((v) => v.trim()).filter(Boolean),
  KAFKA_TOPICS: parsed.data.KAFKA_TOPICS.split(",").map((v) => v.trim()).filter(Boolean),
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(",").map((v) => v.trim()).filter(Boolean)
};