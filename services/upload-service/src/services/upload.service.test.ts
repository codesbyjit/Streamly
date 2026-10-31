import { describe, expect, it } from "vitest";
import { makeObjectKey } from "../storage/s3.js";

describe("upload object keys", () => {
  it("does not expose the raw owner id and preserves a safe extension", () => {
    const key = makeObjectKey("person@example.com", "video-id", "my video.MP4");
    expect(key).toMatch(/^originals\/[a-f0-9]{24}\/video-id\/source\.mp4$/);
    expect(key).not.toContain("person@example.com");
  });

  it("does not accept a path as an extension", () => {
    const key = makeObjectKey("user", "video-id", "../../evil");
    expect(key).toMatch(/^originals\/[a-f0-9]{24}\/video-id\/source$/);
  });
});
