import { test } from "node:test";
import assert from "node:assert/strict";
import { videoDocumentSchema, isSearchable } from "./video-document.js";

test("accepts a public published video", () => {
  const video = videoDocumentSchema.parse({
    id: "v1",
    title: "Test video",
    creatorId: "u1",
    visibility: "public",
    status: "published"
  });
  assert.equal(isSearchable(video), true);
});

test("does not expose private videos in search", () => {
  const video = videoDocumentSchema.parse({
    id: "v2",
    title: "Private video",
    creatorId: "u1",
    visibility: "private",
    status: "published"
  });
  assert.equal(isSearchable(video), false);
});

test("rejects a video without an id", () => {
  assert.equal(videoDocumentSchema.safeParse({ title: "Missing id", creatorId: "u1" }).success, false);
});