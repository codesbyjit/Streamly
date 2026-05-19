import { Channel, Playlist } from "../channel/channel.types";
import { Video } from "../video/video.types";

export interface SearchQuery {
  query: string;
  filters?: {
    uploadDate?: 'today' | 'week' | 'month' | 'year';
    type?: 'video' | 'channel' | 'playlist';
    duration?: 'short' | 'medium' | 'long';
    hd?: boolean;
  };
  sort?: 'relevance' | 'upload_date' | 'view_count' | 'rating';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  items: SearchResultItem[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export type SearchResultItem = 
  | { type: 'video'; data: Video }
  | { type: 'channel'; data: Channel }
  | { type: 'playlist'; data: Playlist };