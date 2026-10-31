import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: "streamly_analytics_" });

export const httpRequests = new client.Counter({
  name: "streamly_analytics_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry]
});

export const ingestedEvents = new client.Counter({
  name: "streamly_analytics_events_ingested_total",
  help: "Successfully persisted unique analytics events",
  labelNames: ["event_type"] as const,
  registers: [registry]
});

export const duplicateEvents = new client.Counter({
  name: "streamly_analytics_duplicate_events_total",
  help: "Duplicate events ignored by eventId",
  registers: [registry]
});