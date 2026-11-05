import type { ApiClient } from "../client.js";
import type {
  Comment,
  CreateCommentInput,
  PaginatedResponse,
} from "../types.js";

export function createSocialResource(client: ApiClient) {
  return {
    listComments: (videoId: string, params?: { cursor?: string; limit?: number }) =>
      client.get<PaginatedResponse<Comment>>(
        `/api/v1/videos/${encodeURIComponent(videoId)}/comments`,
        { query: params },
      ),

    createComment: (videoId: string, input: CreateCommentInput) =>
      client.post<Comment>(
        `/api/v1/videos/${encodeURIComponent(videoId)}/comments`,
        input,
      ),

    deleteComment: (commentId: string) =>
      client.delete<void>(`/api/v1/comments/${encodeURIComponent(commentId)}`),

    subscribe: (channelId: string) =>
      client.post<void>(
        `/api/v1/channels/${encodeURIComponent(channelId)}/subscribe`,
      ),

    unsubscribe: (channelId: string) =>
      client.delete<void>(
        `/api/v1/channels/${encodeURIComponent(channelId)}/subscribe`,
      ),
  };
}
