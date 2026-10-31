import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_CLIENT_ID: z.string().default("streamly-transcode-service"),
  KAFKA_GROUP_ID: z.string().default("streamly-transcode-workers"),
  KAFKA_INPUT_TOPIC: z.string().default("video.uploaded"),
  KAFKA_READY_TOPIC: z.string().default("video.processing.completed"),
  KAFKA_FAILED_TOPIC: z.string().default("video.processing.failed"),
  KAFKA_FROM_BEGINNING: z.string().default("false"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().default("streamly"),
  S3_SECRET_KEY: z.string().default("streamly_minio_dev_password"),
  S3_BUCKET: z.string().default("streamly-media"),
  S3_FORCE_PATH_STYLE: z.string().default("true"),
  WORK_DIR: z.string().default("./.work"),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  FFPROBE_PATH: z.string().default("ffprobe"),
  TRANSCODE_RESOLUTIONS: z.string().default("360,480,720,1080"),
  HLS_SEGMENT_SECONDS: z.coerce.number().int().min(2).max(15).default(6),
  TRANSCODE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  MAX_SOURCE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024 * 1024),
  JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  CLEANUP_WORK_DIR: z.string().default("true"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid transcode-service configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;
const resolutions = raw.TRANSCODE_RESOLUTIONS.split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value >= 144 && value <= 4320);

if (resolutions.length === 0) {
  throw new Error("TRANSCODE_RESOLUTIONS must contain heights such as 360,480,720,1080");
}

export const config = {
  ...raw,
  brokers: raw.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean),
  resolutions: [...new Set(resolutions)].sort((a, b) => a - b),
  fromBeginning: raw.KAFKA_FROM_BEGINNING.toLowerCase() === "true",
  forcePathStyle: raw.S3_FORCE_PATH_STYLE.toLowerCase() !== "false",
  cleanupWorkDir: raw.CLEANUP_WORK_DIR.toLowerCase() !== "false"
};
