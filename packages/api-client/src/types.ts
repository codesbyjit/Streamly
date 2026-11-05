export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface RequestOptions extends Omit<RequestInit, "body" | "headers"> {
  headers?: HeadersInit;
  query?: QueryParams;
  body?: unknown;
  auth?: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  defaultHeaders?: HeadersInit;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export interface ApiErrorPayload {
  message?: string;
  error?: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  createdAt?: string;
}

export interface Video {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  visibility: "public" | "unlisted" | "private";
  status: "draft" | "uploading" | "processing" | "ready" | "failed" | "published";
  createdAt: string;
  publishedAt: string | null;
  viewCount?: number;
}

export interface CreateVideoInput {
  title: string;
  description?: string;
  visibility?: Video["visibility"];
  categoryId?: string;
  tags?: string[];
}

export interface UpdateVideoInput {
  title?: string;
  description?: string;
  visibility?: Video["visibility"];
  categoryId?: string | null;
  tags?: string[];
}

export interface UploadSession {
  uploadId: string;
  videoId: string;
  uploadUrl: string;
  objectKey?: string;
  expiresAt?: string;
  headers?: Record<string, string>;
}

export interface CompleteUploadInput {
  uploadId: string;
  videoId: string;
  objectKey?: string;
  declaredSize?: number;
  contentType?: string;
}

export interface PlaybackInfo {
  videoId: string;
  manifestUrl: string;
  expiresAt?: string;
}

export interface SearchVideosParams {
  q: string;
  cursor?: string;
  limit?: number;
  categoryId?: string;
  sort?: "relevance" | "newest" | "popular";
}

export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCommentInput {
  text: string;
  parentId?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  readAt: string | null;
  createdAt: string;
}
