import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import "dotenv/config";

describe("live-service routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes public health under the requested prefix", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/live/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json().service).toBe("live-service");
  });

  it("exposes internal health", async () => {
    const response = await app.inject({ method: "GET", url: "/internal/v1/live/health" });
    expect(response.statusCode).toBe(200);
  });

  it("requires an authenticated user identity to create a stream", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/live/streams",
      payload: { title: "Test stream" }
    });
    expect(response.statusCode).toBe(401);
  });
});
