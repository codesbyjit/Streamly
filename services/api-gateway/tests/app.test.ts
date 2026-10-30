import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";

describe("API Gateway", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns healthy status", async () => {
    app = await buildApp({
      enableProxies: false,
      env: {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: 3000,
        AUTH_SERVICE_URL: "http://localhost:3001",
        CONTENT_SERVICE_URL: "http://localhost:3002",
        SEARCH_SERVICE_URL: "http://localhost:3003"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      status: "ok",
      service: "api-gateway"
    });
  });

  it("includes a request ID in the response", async () => {
    app = await buildApp({
      enableProxies: false,
      env: {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: 3000,
        AUTH_SERVICE_URL: "http://localhost:3001",
        CONTENT_SERVICE_URL: "http://localhost:3002",
        SEARCH_SERVICE_URL: "http://localhost:3003"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("returns a consistent 404 response for unknown routes", async () => {
    app = await buildApp({
      enableProxies: false,
      env: {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: 3000,
        AUTH_SERVICE_URL: "http://localhost:3001",
        CONTENT_SERVICE_URL: "http://localhost:3002",
        SEARCH_SERVICE_URL: "http://localhost:3003"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/does-not-exist"
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: "Route not found"
      }
    });

    expect(response.json().error.requestId).toBeTruthy();
  });

  it("does not expose internal details for unexpected errors", async () => {
    app = await buildApp({
      enableProxies: false,
      env: {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: 3000,
        AUTH_SERVICE_URL: "http://localhost:3001",
        CONTENT_SERVICE_URL: "http://localhost:3002",
        SEARCH_SERVICE_URL: "http://localhost:3003"
      }
    });

    app.get("/test-error", async () => {
      throw new Error("sensitive internal detail");
    });

    const response = await app.inject({
      method: "GET",
      url: "/test-error"
    });

    expect(response.statusCode).toBe(500);

    expect(response.json()).toMatchObject({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred"
      }
    });

    expect(response.body).not.toContain("sensitive internal detail");
  });
});