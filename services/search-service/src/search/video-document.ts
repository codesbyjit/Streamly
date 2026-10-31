import { z } from "zod";

export const videoDocumentSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).default(""),
  tags: z.array(z.string().max(100)).max(100).default([]),
  category: z.string().max(100).default(""),
  creatorId: z.string().min(1).max(200),
  creatorName: z.string().max(200).default(""),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  status: z.string().max(50).default("published"),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  thumbnailUrl: z.string().max(2048).default(""),
  durationSeconds: z.number().int().nonnegative().default(0),
  viewCount: z.number().int().nonnegative().default(0)
});

export type VideoDocument = z.infer<typeof videoDocumentSchema>;

export function isSearchable(video: VideoDocument): boolean {
  return video.visibility === "public" && video.status.toLowerCase() === "published";
}