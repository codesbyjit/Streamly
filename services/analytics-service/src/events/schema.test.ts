import { describe, expect, it } from "vitest";
import { eventSchema } from "./schema.js";

describe("eventSchema", () => {
  it("accepts a valid video view event", () => {
    const parsed = eventSchema.safeParse({
      eventId: "evt-1",
      eventType: "video.viewed",
      version: 1,
      occurredAt: "2026-11-01T00:00:00.000Z",
      producer: "streaming-service",
      data: { videoId: "vid-1", watchDurationSeconds: 10 }
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a video event without videoId", () => {
    const parsed = eventSchema.safeParse({
      eventId: "evt-2",
      eventType: "video.viewed",
      occurredAt: "2026-11-01T00:00:00.000Z",
      producer: "streaming-service",
      data: {}
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid watch duration", () => {
    const parsed = eventSchema.safeParse({
      eventId: "evt-3",
      eventType: "video.viewed",
      occurredAt: "2026-11-01T00:00:00.000Z",
      producer: "streaming-service",
      data: { videoId: "vid-1", watchDurationSeconds: -5 }
    });
    expect(parsed.success).toBe(false);
  });
});