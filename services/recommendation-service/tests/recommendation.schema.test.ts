import { describe, expect, it } from "vitest";
import { feedQuerySchema, interactionSchema, videoProjectionSchema } from "../src/schemas/recommendation.schema.js";

describe("recommendation schemas", () => {
  it("accepts valid feed query", () => {
    expect(feedQuerySchema.safeParse({ limit: "10", category: "technology" }).success).toBe(true);
  });

  it("rejects out-of-range feed limit", () => {
    expect(feedQuerySchema.safeParse({ limit: "1000" }).success).toBe(false);
  });

  it("accepts interaction payload", () => {
    expect(interactionSchema.safeParse({ videoId: "v1", type: "watch", watchDurationSeconds: 10 }).success).toBe(true);
  });

  it("rejects invalid interaction type", () => {
    expect(interactionSchema.safeParse({ videoId: "v1", type: "download" }).success).toBe(false);
  });

  it("requires creator and title for video projection", () => {
    expect(videoProjectionSchema.safeParse({ videoId: "v1", creatorId: "u1", title: "Title" }).success).toBe(true);
  });
});