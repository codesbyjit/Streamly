import type { FastifyInstance } from "fastify";
import type { GatewayEnv } from "../config/env.js";

type CheckStatus = "ok" | "error";

interface DependencyCheck {
  name: string;
  status: CheckStatus;
  url: string;
  latencyMs: number;
  error?: string;
}

interface RouteRecord {
  method: string;
  url: string;
}

const startedAt = Date.now();
const routes = new Map<string, RouteRecord>();

function normalizeMethod(method: string | string[]): string[] {
  return (Array.isArray(method) ? method : [method])
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function recordRoute(method: string | string[], url: string) {
  for (const item of normalizeMethod(method)) {
    const key = `${item} ${url}`;
    routes.set(key, { method: item, url });
  }
}

function getRouteInventory() {
  const inventory = [...routes.values()].sort((a, b) => {
    return a.url.localeCompare(b.url) || a.method.localeCompare(b.method);
  });

  const groups: Record<string, number> = {};

  for (const route of inventory) {
    const prefix = route.url.split("/").slice(0, 4).join("/") || "/";
    groups[prefix] = (groups[prefix] ?? 0) + 1;
  }

  return {
    totalRoutes: inventory.length,
    totalMethods: new Set(inventory.map((route) => route.method)).size,
    byPrefix: groups,
    routes: inventory,
  };
}

function getRuntimeInfo() {
  const memory = process.memoryUsage();

  return {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
    },
    cpu: process.cpuUsage(),
  };
}

function getUpstreamServices(env: GatewayEnv) {
  return Object.entries(env as Record<string, unknown>)
    .filter(
      ([key, value]) =>
        /_SERVICE_URL$/.test(key) &&
        typeof value === "string" &&
        value.length > 0,
    )
    .map(([key, value]) => ({
      name: key.replace(/_SERVICE_URL$/, "").toLowerCase().replaceAll("_", "-"),
      url: value as string,
    }));
}

async function checkDependency(
  name: string,
  baseUrl: string,
  timeoutMs = 2500,
): Promise<DependencyCheck> {
  const url = `${baseUrl.replace(/\/+$/, "")+"/api/v1/"+name}/health/ready`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      return {
        name,
        status: "error",
        url,
        latencyMs,
        error: `Upstream returned HTTP ${response.status}`,
      };
    }

    return {
      name,
      status: "ok",
      url,
      latencyMs,
    };
  } catch (error) {
    return {
      name,
      status: "error",
      url,
      latencyMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : "Unknown upstream error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function registerHealthRoute(
  app: FastifyInstance,
  env: GatewayEnv,
) {
  app.addHook("onRoute", (routeOptions) => {
    recordRoute(routeOptions.method, routeOptions.url);
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  }));

  app.get("/health/ready", async (_request, reply) => {
    const upstreams = getUpstreamServices(env);

    const checks = await Promise.all(
      upstreams.map((upstream) =>
        checkDependency(upstream.name, upstream.url),
      ),
    );

    const failed = checks.filter((check) => check.status === "error");
    const status = failed.length === 0 ? "ok" : "degraded";

    return reply.code(failed.length === 0 ? 200 : 503).send({
      status,
      service: "api-gateway",
      timestamp: new Date().toISOString(),
      checks: {
        gateway: "ok",
        upstreams: {
          total: checks.length,
          healthy: checks.length - failed.length,
          unhealthy: failed.length,
          details: checks,
        },
      },
    });
  });

  app.get("/health/details", async (_request, reply) => {
    const upstreams = getUpstreamServices(env);

    const checks = await Promise.all(
      upstreams.map((upstream) =>
        checkDependency(upstream.name, upstream.url),
      ),
    );

    const failed = checks.filter((check) => check.status === "error");
    const inventory = getRouteInventory();

    return reply
      .code(failed.length === 0 ? 200 : 503)
      .send({
        status: failed.length === 0 ? "ok" : "degraded",
        service: "api-gateway",
        timestamp: new Date().toISOString(),
        startedAt: new Date(startedAt).toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        routes: inventory,
        dependencies: {
          total: checks.length,
          healthy: checks.length - failed.length,
          unhealthy: failed.length,
          details: checks,
        },
        runtime: getRuntimeInfo(),
      });
  });
}