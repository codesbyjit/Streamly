import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common.schemas.js";

export const PlaybackRequestSchema = z.object({
  videoId: IdSchema
});

export const PlaybackResponseSchema = z.object({
  videoId: IdSchema,
  protocol: z.literal("hls"),
  manifestUrl: z.string().url(),
  expiresAt: IsoDateTimeSchema.nullable(),
  subtitles: z.array(z.object({
    language: z.string().min(2),
    label: z.string().min(1),
    url: z.string().url()
  })).default([])
});

export type PlaybackRequest = z.infer<typeof PlaybackRequestSchema>;
export type PlaybackResponse = z.infer<typeof PlaybackResponseSchema>;
