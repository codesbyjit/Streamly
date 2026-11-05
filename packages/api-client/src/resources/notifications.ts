import type { ApiClient } from "../client.js";
import type { Notification, PaginatedResponse } from "../types.js";

export function createNotificationsResource(client: ApiClient) {
  return {
    list: (params?: { cursor?: string; limit?: number }) =>
      client.get<PaginatedResponse<Notification>>("/api/v1/notifications", {
        query: params,
      }),

    markRead: (notificationId: string) =>
      client.patch<void>(
        `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
      ),

    markAllRead: () =>
      client.post<void>("/api/v1/notifications/read-all"),
  };
}
