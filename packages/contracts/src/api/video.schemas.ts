import { z } from "zod";
import { IdSchema, IsoDateTimeSchema, PaginationQuerySchema, PageInfoSchema } from "./common.schemas.js";

export const VideoVisibilitySchema = z.enum(["public", "unlisted", "private"]);
export const VideoProcessingStatusSchema = z.enum([
  "draft", "uploading", "processing", "ready", "failed"
]);

export const CreateVideoRequestSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().max(5000).default(""),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  categoryId: IdSchema.optional(),
  visibility: VideoVisibilitySchema.default("private")
});

export const UpdateVideoRequestSchema = CreateVideoRequestSchema.partial();

export const VideoSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  categoryId: IdSchema.nullable(),
  visibility: VideoVisibilitySchema,
  processingStatus: VideoProcessingStatusSchema,
  thumbnailUrl: z.string().url().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  publishedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
});

export const VideoListQuerySchema = PaginationQuerySchema.extend({
  categoryId: IdSchema.optional(),
  channelId: IdSchema.optional(),
  sort: z.enum(["newest", "popular"]).default("newest")
});

export const VideoListResponseSchema = z.object({
  items: z.array(VideoSchema),
  pageInfo: PageInfoSchema
});

export type CreateVideoRequest = z.infer<typeof CreateVideoRequestSchema>;
export type UpdateVideoRequest = z.infer<typeof UpdateVideoRequestSchema>;
export type Video = z.infer<typeof VideoSchema>;
export type VideoListQuery = z.infer<typeof VideoListQuerySchema>;
export type VideoListResponse = z.infer<typeof VideoListResponseSchema>;
