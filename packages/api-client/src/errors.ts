import type { ApiErrorPayload } from "./types.js";

export class ApiError extends Error {
  readonly name = "ApiError";

  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
    readonly response?: Response,
  ) {
    super(message);
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let payload: ApiErrorPayload | undefined;

    try {
      payload = (await response.clone().json()) as ApiErrorPayload;
    } catch {
      // Non-JSON error responses are supported.
    }

    const message =
      payload?.message ??
      payload?.error ??
      `${response.status} ${response.statusText}`.trim() ??
      "Request failed";

    return new ApiError(
      message,
      response.status,
      payload?.code,
      payload?.details,
      response,
    );
  }
}

export class ApiTimeoutError extends Error {
  readonly name = "ApiTimeoutError";

  constructor(readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
  }
}
