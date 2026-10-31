import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3010),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default("notification"),
  DATABASE_SSL: z.string().default("false"),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("streamly-notification-service"),
  KAFKA_GROUP_ID: z.string().default("streamly-notification-service-v1"),
  KAFKA_SSL: z.string().default("false"),
  KAFKA_SASL_MECHANISM: z.string().optional().default(""),
  KAFKA_SASL_USERNAME: z.string().optional().default(""),
  KAFKA_SASL_PASSWORD: z.string().optional().default(""),
  KAFKA_TOPICS: z.string().default("video.published,channel.subscribed,comment.created"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.string().default("false"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Streamly <notifications@streamly.local>"),
  EMAIL_ENABLED: z.string().default("false"),
  JWT_SECRET: z.string().optional().default(""),
  JWT_ISSUER: z.string().optional().default(""),
  JWT_AUDIENCE: z.string().optional().default(""),
  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().default(100),
  WORKER_ENABLED: z.string().default("true")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const raw = parsed.data;

export const env = {
  ...raw,
  databaseSsl: raw.DATABASE_SSL === "true",
  kafkaSsl: raw.KAFKA_SSL === "true",
  smtpSecure: raw.SMTP_SECURE === "true",
  emailEnabled: raw.EMAIL_ENABLED === "true",
  workerEnabled: raw.WORKER_ENABLED === "true",
  kafkaBrokers: raw.KAFKA_BROKERS.split(",").map((x) => x.trim()).filter(Boolean),
  kafkaTopics: raw.KAFKA_TOPICS.split(",").map((x) => x.trim()).filter(Boolean)
};
