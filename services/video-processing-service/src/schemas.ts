import { z } from 'zod';

export const videoUploadedSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.literal('video.uploaded'),
  version: z.number().int().positive(),
  occurredAt: z.string().min(1),
  producer: z.string().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  data: z.object({
    videoId: z.string().min(1).max(200),
    ownerId: z.string().optional(),
    objectKey: z.string().min(1).max(1024),
    bucket: z.string().optional(),
    contentType: z.string().optional(),
    sizeBytes: z.number().nonnegative().optional()
  })
});

export function safeObjectKey(key: string): string {
  if (key.startsWith('/') || key.includes('\\') || key.split('/').some((p) => p === '..' || p === '.')) {
    throw new Error('Unsafe object key');
  }
  return key;
}
