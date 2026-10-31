import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3012),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: z.string().default("false").transform((value) => value === "true"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  REDIS_ENABLED: z.string().default("true").transform((value) => value === "true"),
  REDIS_KEY_PREFIX: z.string().default("streamly:live:"),
  KAFKA_ENABLED: z.string().default("false").transform((value) => value === "true"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("streamly-live-service"),
  KAFKA_TOPIC_PREFIX: z.string().default(""),
  INTERNAL_API_KEY: z.string().min(16),
  STREAM_INGEST_BASE_URL: z.string().url().default("rtmp://localhost:1935/live"),
  STREAM_PLAYBACK_BASE_URL: z.string().url().default("http://localhost:8888/live"),
  MAX_ACTIVE_STREAMS_PER_USER: z.coerce.number().int().positive().default(3)
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
}

export const env = parsed.data;
