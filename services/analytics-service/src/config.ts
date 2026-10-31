import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3010),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_SSL: z.string().default("false"),
  DB_MIGRATE_ON_START: z.string().default("true"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("streamly-analytics-service"),
  KAFKA_GROUP_ID: z.string().default("streamly-analytics-v1"),
  KAFKA_TOPIC_EVENTS: z.string().default("streamly.events"),
  KAFKA_FROM_BEGINNING: z.string().default("false"),
  KAFKA_ENABLED: z.string().default("true"),
  INGEST_API_KEY: z.string().optional().default(""),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  DATABASE_SSL: parsed.data.DATABASE_SSL.toLowerCase() === "true",
  DB_MIGRATE_ON_START: parsed.data.DB_MIGRATE_ON_START.toLowerCase() === "true",
  KAFKA_FROM_BEGINNING: parsed.data.KAFKA_FROM_BEGINNING.toLowerCase() === "true",
  KAFKA_ENABLED: parsed.data.KAFKA_ENABLED.toLowerCase() === "true",
  KAFKA_BROKERS: parsed.data.KAFKA_BROKERS.split(",").map((s) => s.trim()).filter(Boolean),
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
};