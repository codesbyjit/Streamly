import { describe, expect, it } from "vitest";
import { createRefreshToken, hashRefreshToken, normalizeEmail } from "../src/security.js";

describe("auth security helpers", () => {
  it("generates high-entropy refresh tokens", () => {
    const a = createRefreshToken();
    const b = createRefreshToken();
    expect(a.length).toBeGreaterThan(40);
    expect(a).not.toBe(b);
  });

  it("hashes refresh tokens deterministically without storing the raw token", () => {
    const token = createRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
  });

  it("normalizes email addresses", () => {
    expect(normalizeEmail("  JIT@Example.com ")).toBe("jit@example.com");
  });
});
