export interface WatchEvent {
  eventId: string;
  userId: string | null;
  videoId: string;
  sessionId: string;
  eventType: 'start' | 'pause' | 'resume' | 'complete' | 'seek' | 'quality_change';
  positionSeconds: number;
  videoDuration: number;
  quality: string;
  deviceType: string;
  timestamp: Date;
}