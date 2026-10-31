import { describe, expect, it } from "vitest";
import { createVideoSchema, updateVideoSchema, listVideosQuerySchema } from "../src/schemas/video.js";

describe("video schemas", () => {
  it("accepts valid video metadata and deduplicates tags", () => {
    const result = createVideoSchema.safeParse({
      ownerId: "8aabf95c-6c3c-4a21-91f8-83fbb2fef201",
      title: "  Streamly demo  ",
      tags: ["demo", "demo"],
      visibility: "private"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Streamly demo");
      expect(result.data.tags).toEqual(["demo"]);
    }
  });

  it("rejects blank titles", () => {
    expect(createVideoSchema.safeParse({
      ownerId: "8aabf95c-6c3c-4a21-91f8-83fbb2fef201",
      title: "   "
    }).success).toBe(false);
  });

  it("rejects empty update payloads", () => {
    expect(updateVideoSchema.safeParse({}).success).toBe(false);
  });

  it("defaults list limit and rejects oversized limits", () => {
    expect(listVideosQuerySchema.parse({}).limit).toBe(20);
    expect(listVideosQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
  });
});