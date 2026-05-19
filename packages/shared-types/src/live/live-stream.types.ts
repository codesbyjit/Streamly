export interface LiveStream {
  id: string;
  channelId: string;
  title: string;
  status: 'idle' | 'live' | 'ended';
  streamKey: string;
  ingestUrl: string;
  playbackUrl: string;
  startedAt: Date | null;
  endedAt: Date | null;
  viewerCount: number;
}