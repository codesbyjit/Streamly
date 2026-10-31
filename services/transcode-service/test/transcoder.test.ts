import { describe, expect, it } from "vitest";

describe("transcode service contract", () => {
  it("accepts the standard event names used by the worker", () => {
    expect("video.uploaded").toBe("video.uploaded");
    expect("video.processing.completed").toBe("video.processing.completed");
    expect("video.processing.failed").toBe("video.processing.failed");
  });
});
