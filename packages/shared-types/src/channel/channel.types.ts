import { VideoVisibility } from "../video/video.types";

export interface Channel {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  totalViews: number;
  createdAt: Date;
}

export interface Playlist {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: VideoVisibility;
  videoCount: number;
  createdAt: Date;
}