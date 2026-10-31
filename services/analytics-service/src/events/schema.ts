import { z } from "zod";

const base = z.object({
  eventId: z.string().min(1).max(200),
  eventType: z.enum([
    "video.impression",
    "video.viewed",
    "video.completed",
    "video.liked",
    "video.disliked",
    "video.published",
    "channel.subscribed",
    "search.performed"
  ]),
  version: z.number().int().positive().default(1),
  occurredAt: z.string().datetime({ offset: true }),
  producer: z.string().min(1).max(100),
  data: z.record(z.string(), z.unknown())
});

export const eventSchema = base.superRefine((event, ctx) => {
  const data = event.data;
  const requireString = (key: string) => {
    if (typeof data[key] !== "string" || !(data[key] as string).trim()) {
      ctx.addIssue({ code: "custom", path: ["data", key], message: `${key} is required` });
    }
  };

  if (event.eventType.startsWith("video.")) requireString("videoId");
  if (event.eventType === "channel.subscribed") requireString("channelId");
  if (event.eventType === "search.performed") requireString("query");

  if (event.eventType === "video.viewed" && data.watchDurationSeconds !== undefined) {
    const duration = data.watchDurationSeconds;
    if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 0 || duration > 86400) {
      ctx.addIssue({
        code: "custom",
        path: ["data", "watchDurationSeconds"],
        message: "watchDurationSeconds must be an integer from 0 to 86400"
      });
    }
  }

  if (data.userId !== undefined && typeof data.userId !== "string") {
    ctx.addIssue({ code: "custom", path: ["data", "userId"], message: "userId must be a string" });
  }
});

export type AnalyticsEvent = z.infer<typeof eventSchema>;