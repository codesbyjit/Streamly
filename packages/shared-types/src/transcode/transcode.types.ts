export interface TranscodeJob {
  id: string;
  videoId: string;
  inputPath: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputs: TranscodeOutput[];
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface TranscodeOutput {
  resolution: string;
  codec: string;
  bitrate: number;
  filePath: string;
  fileSize: number;
}