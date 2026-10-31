export interface VideoUploadedEvent {
  eventId: string;
  eventType: 'video.uploaded';
  version: number;
  occurredAt: string;
  producer?: string;
  retryCount?: number;
  data: {
    videoId: string;
    ownerId?: string;
    objectKey: string;
    bucket?: string;
    contentType?: string;
    sizeBytes?: number;
  };
}

export interface ProcessingEvent {
  eventId: string;
  eventType:
    | 'video.processing.started'
    | 'video.processing.completed'
    | 'video.processing.failed';
  version: 1;
  occurredAt: string;
  producer: string;
  data: {
    videoId: string;
    jobId: string;
    status: 'processing' | 'ready' | 'failed';
    originalKey?: string;
    masterPlaylistKey?: string;
    thumbnailKey?: string;
    renditions?: Array<{ name: string; width: number; height: number; playlistKey: string }>;
    durationSeconds?: number;
    errorCode?: string;
    errorMessage?: string;
  };
}

export interface Rendition {
  name: string;
  width: number;
  height: number;
  bitrate: string;
}
