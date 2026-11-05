import type { ApiClient } from "../client.js";
import type { PaginatedResponse, Video } from "../types.js";

export function createFeedResource(client: ApiClient) {
  return {
    home: (params?: { cursor?: string; limit?: number }) =>
      client.get<PaginatedResponse<Video>>("/api/v1/feed/home", {
        query: params,
      }),

    subscriptions: (params?: { cursor?: string; limit?: number }) =>
      client.get<PaginatedResponse<Video>>("/api/v1/feed/subscriptions", {
        query: params,
      }),
  };
}
