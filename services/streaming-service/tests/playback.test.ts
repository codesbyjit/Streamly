import { describe, expect, it } from "vitest";
import { PlaybackError } from "../src/services/playback.service.js";

describe("PlaybackError", () => {
  it("preserves status and machine-readable code", () => {
    const error = new PlaybackError(404, "Video not found", "video_not_found");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("video_not_found");
    expect(error.message).toBe("Video not found");
  });
});
