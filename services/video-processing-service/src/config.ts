import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVICE_NAME: z.string().default('video-processing-service'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  KAFKA_CLIENT_ID: z.string().default('streamly-video-processing'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_GROUP_ID: z.string().default('streamly-video-processing-v1'),
  KAFKA_INPUT_TOPIC: z.string().default('video.uploaded'),
  KAFKA_OUTPUT_TOPIC: z.string().default('video.processing.events'),
  KAFKA_DLQ_TOPIC: z.string().default('video.processing.dlq'),
  KAFKA_FROM_BEGINNING: z.string().default('false'),
  DATABASE_URL: z.string().min(1),
  DATABASE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default('video_processing'),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.string().default('true'),
  S3_TLS: z.string().default('false'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  WORK_DIR: z.string().default('./.work'),
  MAX_SOURCE_BYTES: z.coerce.number().int().positive().default(5 * 1024 ** 3),
  MAX_VIDEO_SECONDS: z.coerce.number().positive().default(4 * 60 * 60),
  MAX_CONCURRENT_JOBS: z.coerce.number().int().min(1).max(8).default(1),
  TRANSCODE_TIMEOUT_MS: z.coerce.number().int().positive().default(2 * 60 * 60 * 1000),
  HLS_SEGMENT_SECONDS: z.coerce.number().int().min(2).max(15).default(6),
  RENDITIONS: z.string().default('360p,480p,720p,1080p'),
  THUMBNAIL_SECONDS: z.coerce.number().min(0).default(2),
  PRESERVE_SOURCE: z.string().default('true')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const e = parsed.data;
export const config = {
  ...e,
  kafkaBrokers: e.KAFKA_BROKERS.split(',').map((s) => s.trim()).filter(Boolean),
  kafkaFromBeginning: e.KAFKA_FROM_BEGINNING === 'true',
  s3ForcePathStyle: e.S3_FORCE_PATH_STYLE === 'true',
  s3Tls: e.S3_TLS === 'true',
  preserveSource: e.PRESERVE_SOURCE === 'true',
  renditions: e.RENDITIONS.split(',').map((s) => s.trim()).filter(Boolean)
};
