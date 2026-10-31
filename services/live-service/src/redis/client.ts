import Redis from "ioredis";
import { env } from "../config/env.js";

export const redis = env.REDIS_ENABLED
  ? new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2000)
    })
  : null;

export async function connectRedis() {
  if (redis && redis.status === "wait") {
    await redis.connect();
  }
}

export async function closeRedis() {
  if (redis && redis.status !== "end") {
    await redis.quit();
  }
}
