import { z } from "zod";

export const videoIdSchema = z.string().uuid();

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20)
  .transform((tags) => [...new Set(tags)]);

export const createVideoSchema = z.object({
  // ownerId is temporarily supplied by the request for local development.
  // Replace it with the authenticated identity from a verified gateway/JWT.
  ownerId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(5000).default(""),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  tags: tagsSchema.default([]),
  visibility: z.enum(["public", "unlisted", "private"]).default("private")
}).strict();

export const updateVideoSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  tags: tagsSchema.optional(),
  visibility: z.enum(["public", "unlisted", "private"]).optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided"
});

export const listVideosQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().trim().min(1).max(80).optional()
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;