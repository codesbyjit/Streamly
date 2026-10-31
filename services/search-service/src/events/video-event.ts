import { videoDocumentSchema, type VideoDocument } from "../search/video-document.js";

export type VideoEvent =
  | { type: "upsert"; video: VideoDocument }
  | { type: "delete"; id: string };

const idSchema = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function parseVideoEvent(raw: unknown, topic: string): VideoEvent {
  if (!raw || typeof raw !== "object") throw new Error("Event must be a JSON object");
  const envelope = raw as Record<string, unknown>;
  const eventType = String(envelope.eventType ?? envelope.type ?? topic).toLowerCase();
  const data = (envelope.data && typeof envelope.data === "object" ? envelope.data : envelope) as Record<string, unknown>;

  const id = idSchema(data.id ?? data.videoId ?? data.video_id);
  if (eventType.includes("deleted") || eventType.includes("unpublished") || eventType.includes("private")) {
    if (!id) throw new Error("Delete/unpublish event is missing video id");
    return { type: "delete", id };
  }

  const normalized = {
    id: data.id ?? data.videoId ?? data.video_id,
    title: data.title,
    description: data.description ?? "",
    tags: data.tags ?? [],
    category: data.category ?? "",
    creatorId: data.creatorId ?? data.ownerId ?? data.userId ?? data.creator_id,
    creatorName: data.creatorName ?? data.channelName ?? "",
    visibility: data.visibility ?? "public",
    status: data.status ?? (eventType.includes("published") ? "published" : "processing"),
    publishedAt: data.publishedAt ?? data.published_at ?? data.createdAt,
    thumbnailUrl: data.thumbnailUrl ?? data.thumbnail_url ?? "",
    durationSeconds: data.durationSeconds ?? data.duration_seconds ?? 0,
    viewCount: data.viewCount ?? data.view_count ?? 0
  };

  const parsed = videoDocumentSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(`Invalid video event: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  return { type: "upsert", video: parsed.data };
}