export type NotificationType =
  | "video_published"
  | "new_subscriber"
  | "comment"
  | "system";

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sourceEventId?: string;
}

export interface NotificationRecord {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  source_event_id: string | null;
  read_at: string | null;
  created_at: string;
}
