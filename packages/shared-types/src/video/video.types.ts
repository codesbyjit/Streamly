export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'deleted';
export type VideoVisibility = 'public' | 'unlisted' | 'private';

export interface Video {
  id: string;
  channelId: string;
  title: string;
  description: string;
  status: VideoStatus;
  visibility: VideoVisibility;
  durationSeconds: number;
  thumbnails: ThumbnailSet;
  videoUrls: VideoManifests;
  tags: string[];
  categoryId: number;
  language: string;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThumbnailSet {
  default: string;
  medium: string;
  high: string;
  standard: string | null;
  maxres: string | null;
}

export interface VideoManifests {
  dash: string | null;
  hls: string | null;
}