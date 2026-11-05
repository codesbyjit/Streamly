import { z } from "zod";
import { eventSchema } from "./base.event.js";

const VideoIdentitySchema = z.object({
  videoId: z.string().min(1),
  ownerId: z.string().min(1)
});

export const VideoUploadedEventSchema = eventSchema(
  "video.uploaded",
  1,
  VideoIdentitySchema.extend({
    objectKey: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    checksum: z.string().optional()
  })
);

export const VideoProcessingStartedEventSchema = eventSchema(
  "video.processing.started",
  1,
  VideoIdentitySchema.extend({
    jobId: z.string().min(1),
    attempt: z.number().int().positive()
  })
);

export const VideoProcessingCompletedEventSchema = eventSchema(
  "video.processing.completed",
  1,
  VideoIdentitySchema.extend({
    jobId: z.string().min(1),
    masterPlaylistKey: z.string().min(1),
    thumbnailKey: z.string().min(1),
    renditions: z.array(z.object({
      height: z.number().int().positive(),
      width: z.number().int().positive(),
      playlistKey: z.string().min(1),
      bitrate: z.number().int().positive().optional()
    })).min(1),
    durationSeconds: z.number().positive()
  })
);

export const VideoProcessingFailedEventSchema = eventSchema(
  "video.processing.failed",
  1,
  VideoIdentitySchema.extend({
    jobId: z.string().min(1),
    attempt: z.number().int().positive(),
    errorCode: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean()
  })
);

export const VideoPublishedEventSchema = eventSchema(
  "video.published",
  1,
  VideoIdentitySchema.extend({
    title: z.string().min(1),
    visibility: z.enum(["public", "unlisted", "private"]),
    publishedAt: z.string().datetime({ offset: true })
  })
);

export const VideoViewedEventSchema = eventSchema(
  "video.viewed",
  1,
  z.object({
    videoId: z.string().min(1),
    viewerId: z.string().min(1).optional(),
    sessionId: z.string().min(1),
    watchDurationSeconds: z.number().nonnegative().optional(),
    source: z.enum(["home", "search", "channel", "related", "direct", "other"]).optional()
  })
);

export const VideoLikedEventSchema = eventSchema(
  "video.liked",
  1,
  z.object({
    videoId: z.string().min(1),
    userId: z.string().min(1),
    reaction: z.enum(["like", "dislike"])
  })
);

export type VideoUploadedEvent = z.infer<typeof VideoUploadedEventSchema>;
export type VideoProcessingStartedEvent = z.infer<typeof VideoProcessingStartedEventSchema>;
export type VideoProcessingCompletedEvent = z.infer<typeof VideoProcessingCompletedEventSchema>;
export type VideoProcessingFailedEvent = z.infer<typeof VideoProcessingFailedEventSchema>;
export type VideoPublishedEvent = z.infer<typeof VideoPublishedEventSchema>;
export type VideoViewedEvent = z.infer<typeof VideoViewedEventSchema>;
export type VideoLikedEvent = z.infer<typeof VideoLikedEventSchema>;
