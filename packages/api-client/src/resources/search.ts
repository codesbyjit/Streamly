import type { ApiClient } from "../client.js";
import type { PaginatedResponse, SearchVideosParams, Video } from "../types.js";

export function createSearchResource(client: ApiClient) {
  return {
    videos: (params: SearchVideosParams) =>
      client.get<PaginatedResponse<Video>>("/api/v1/search", {
        query: params,
      }),
  };
}
