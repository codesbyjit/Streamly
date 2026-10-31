import 'dotenv/config';
import { z } from 'zod';

const optionalBool = z.enum(['true', 'false']).default('false').transform(v => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3008),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_SSL: optionalBool,
  DB_MIGRATE_ON_START: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  INTERNAL_API_KEY: z.string().min(16),
  TRUSTED_ID_HEADER: z.string().default('x-user-id'),
  TRUSTED_INTERNAL_KEY_HEADER: z.string().default('x-internal-api-key'),
  KAFKA_ENABLED: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('streamly-social-service'),
  KAFKA_SSL: optionalBool,
  KAFKA_SASL_MECHANISM: z.string().optional().default(''),
  KAFKA_SASL_USERNAME: z.string().optional().default(''),
  KAFKA_SASL_PASSWORD: z.string().optional().default(''),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  MAX_COMMENT_LENGTH: z.coerce.number().int().min(1).max(10000).default(5000),
  DEFAULT_PAGE_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().min(1).max(100).default(100)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
