import type { ApiClient } from "../client.js";
import type {
  CreateVideoInput,
  PaginatedResponse,
  PlaybackInfo,
  UpdateVideoInput,
  Video,
} from "../types.js";

export function createVideosResource(client: ApiClient) {
  return {
    list: (params?: { cursor?: string; limit?: number; categoryId?: string }) =>
      client.get<PaginatedResponse<Video>>("/api/v1/videos", { query: params }),

    get: (videoId: string) =>
      client.get<Video>(`/api/v1/videos/${encodeURIComponent(videoId)}`),

    create: (input: CreateVideoInput) =>
      client.post<Video>("/api/v1/videos", input),

    update: (videoId: string, input: UpdateVideoInput) =>
      client.patch<Video>(`/api/v1/videos/${encodeURIComponent(videoId)}`, input),

    remove: (videoId: string) =>
      client.delete<void>(`/api/v1/videos/${encodeURIComponent(videoId)}`),

    playback: (videoId: string) =>
      client.get<PlaybackInfo>(
        `/api/v1/videos/${encodeURIComponent(videoId)}/playback`,
      ),
  };
}
