import { z } from "zod";

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  cursor: z.string().datetime().optional()
});

export const interactionSchema = z.object({
  videoId: z.string().trim().min(1).max(160),
  type: z.enum(["impression", "click", "watch", "complete", "like", "dislike", "skip"]),
  watchDurationSeconds: z.number().int().min(0).max(86400).default(0),
  metadata: z.record(z.unknown()).default({})
});

export const videoProjectionSchema = z.object({
  videoId: z.string().trim().min(1).max(160),
  creatorId: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(10000).default(""),
  category: z.string().trim().min(1).max(80).default("general"),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  thumbnailUrl: z.string().url().nullable().optional(),
  publishedAt: z.string().datetime().optional(),
  status: z.enum(["processing", "published", "private", "unlisted", "deleted"]).default("published"),
  viewCount: z.number().int().min(0).default(0),
  likeCount: z.number().int().min(0).default(0)
});

export const analyticsQuerySchema = z.object({
  sinceHours: z.coerce.number().int().min(1).max(8760).default(24)
});