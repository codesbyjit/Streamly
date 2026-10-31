import { describe, expect, it } from "vitest";

describe("notification-service", () => {
  it("has a test runner configured", () => {
    expect("notification-service").toContain("notification");
  });
});
