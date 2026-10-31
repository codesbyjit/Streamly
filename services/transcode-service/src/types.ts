export interface VideoUploadedEvent {
  eventId?: string;
  eventType?: string;
  version?: number;
  occurredAt?: string;
  data?: {
    videoId?: string;
    ownerId?: string;
    bucket?: string;
    objectKey?: string;
    contentType?: string;
    sizeBytes?: number;
  };
  videoId?: string;
  ownerId?: string;
  bucket?: string;
  objectKey?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface Rendition {
  height: number;
  width: number;
  playlistKey: string;
  bandwidth: number;
}

export interface ProcessingCompletedEvent {
  eventId: string;
  eventType: "video.processing.completed";
  version: 1;
  occurredAt: string;
  data: {
    videoId: string;
    ownerId?: string;
    status: "READY";
    bucket: string;
    masterPlaylistKey: string;
    thumbnailKey: string;
    renditions: Rendition[];
    durationSeconds: number;
    sourceObjectKey: string;
  };
}

export interface ProcessingFailedEvent {
  eventId: string;
  eventType: "video.processing.failed";
  version: 1;
  occurredAt: string;
  data: {
    videoId: string;
    ownerId?: string;
    status: "FAILED";
    sourceObjectKey: string;
    error: string;
  };
}
