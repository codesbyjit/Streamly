export interface UploadSession {
  id: string;
  videoId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  createdAt: Date;
}