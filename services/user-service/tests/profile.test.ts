import { describe, expect, it } from "vitest";
import { createProfileSchema, updateProfileSchema, updatePreferencesSchema } from "../src/schemas/profile.js";

describe("profile schemas", () => {
  it("accepts a valid profile", () => {
    expect(createProfileSchema.safeParse({
      userId: "f8f75f25-901b-4c90-8b63-62b2d4aee84a",
      handle: "streamly_user",
      displayName: "Streamly User"
    }).success).toBe(true);
  });

  it("rejects malformed handles", () => {
    expect(createProfileSchema.safeParse({
      userId: "f8f75f25-901b-4c90-8b63-62b2d4aee84a",
      handle: "bad handle",
      displayName: "User"
    }).success).toBe(false);
  });

  it("requires at least one profile update field", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unsupported preference themes", () => {
    expect(updatePreferencesSchema.safeParse({ theme: "neon" }).success).toBe(false);
  });
});
