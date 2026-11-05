export { ApiClient } from "./client.js";
export { ApiError, ApiTimeoutError } from "./errors.js";

export type {
  ApiClientConfig,
  ApiErrorPayload,
  Comment,
  CompleteUploadInput,
  CreateCommentInput,
  CreateVideoInput,
  Notification,
  PaginatedResponse,
  PlaybackInfo,
  QueryParams,
  QueryValue,
  RequestOptions,
  SearchVideosParams,
  UpdateVideoInput,
  UploadSession,
  UserProfile,
  Video,
} from "./types.js";

export type { AuthTokens, LoginInput, RegisterInput } from "./resources/auth.js";
export type { CreateUploadInput } from "./resources/uploads.js";

import { ApiClient } from "./client.js";
import { createAuthResource } from "./resources/auth.js";
import { createFeedResource } from "./resources/feed.js";
import { createNotificationsResource } from "./resources/notifications.js";
import { createSearchResource } from "./resources/search.js";
import { createSocialResource } from "./resources/social.js";
import { createUploadsResource } from "./resources/uploads.js";
import { createVideosResource } from "./resources/videos.js";
import type { ApiClientConfig } from "./types.js";

export function createApiClient(config: ApiClientConfig) {
  const client = new ApiClient(config);

  return {
    http: client,
    auth: createAuthResource(client),
    videos: createVideosResource(client),
    uploads: createUploadsResource(client),
    search: createSearchResource(client),
    social: createSocialResource(client),
    feed: createFeedResource(client),
    notifications: createNotificationsResource(client),
  };
}

export type StreamlyApiClient = ReturnType<typeof createApiClient>;
