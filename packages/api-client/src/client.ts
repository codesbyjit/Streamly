import { ApiError, ApiTimeoutError } from "./errors.js";
import type { ApiClientConfig, RequestOptions } from "./types.js";

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function appendQuery(url: string, query?: RequestOptions["query"]): string {
  if (!query) return url;

  const parsed = new URL(url);
  for (const [key, rawValue] of Object.entries(query)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      if (value === null || value === undefined) continue;
      parsed.searchParams.append(key, String(value));
    }
  }

  return parsed.toString();
}

function combineSignals(
  requestSignal: AbortSignal | null | undefined,
  timeoutSignal: AbortSignal,
): AbortSignal {
  if (!requestSignal) return timeoutSignal;

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([requestSignal, timeoutSignal]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (requestSignal.aborted || timeoutSignal.aborted) {
    controller.abort();
  } else {
    requestSignal.addEventListener("abort", abort, { once: true });
    timeoutSignal.addEventListener("abort", abort, { once: true });
  }

  return controller.signal;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: ApiClientConfig["getAccessToken"];
  private readonly defaultHeaders: HeadersInit;
  private readonly credentials: RequestCredentials;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(config: ApiClientConfig) {
    if (!config.baseUrl.trim()) {
      throw new Error("ApiClient requires a non-empty baseUrl");
    }

    this.baseUrl = config.baseUrl;
    this.getAccessToken = config.getAccessToken;
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.credentials = config.credentials ?? "same-origin";
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.fetcher = config.fetcher ?? fetch;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      query,
      body,
      headers: suppliedHeaders,
      auth = true,
      signal: callerSignal,
      ...requestInit
    } = options;

    const headers = new Headers(this.defaultHeaders);
    new Headers(suppliedHeaders).forEach((value, key) => headers.set(key, value));

    if (body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (auth && this.getAccessToken) {
      const token = await this.getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(new ApiTimeoutError(this.timeoutMs)),
      this.timeoutMs,
    );
    const signal = combineSignals(callerSignal, timeoutController.signal);

    try {
      const response = await this.fetcher(appendQuery(joinUrl(this.baseUrl, path), query), {
        ...requestInit,
        headers,
        signal,
        credentials: this.credentials,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (!response.ok) {
        throw await ApiError.fromResponse(response);
      }

      if (response.status === 204) return undefined as T;

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        return (await response.json()) as T;
      }

      return (await response.text()) as T;
    } catch (error) {
      if (timeoutController.signal.aborted && !callerSignal?.aborted) {
        throw new ApiTimeoutError(this.timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}
