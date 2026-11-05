import type { ApiClient } from "../client.js";
import type { CompleteUploadInput, UploadSession } from "../types.js";

export interface CreateUploadInput {
  filename: string;
  contentType: string;
  size: number;
  title?: string;
}

export function createUploadsResource(client: ApiClient) {
  return {
    create: (input: CreateUploadInput) =>
      client.post<UploadSession>("/api/v1/uploads", input),

    complete: (input: CompleteUploadInput) =>
      client.post<void>(
        `/api/v1/uploads/${encodeURIComponent(input.uploadId)}/complete`,
        input,
      ),

    cancel: (uploadId: string) =>
      client.delete<void>(`/api/v1/uploads/${encodeURIComponent(uploadId)}`),
  };
}
