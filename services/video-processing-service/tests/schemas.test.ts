import { describe, expect, it } from 'vitest';
import { safeObjectKey } from '../src/schemas.js';
import { videoUploadedSchema } from '../src/schemas.js';

describe('videoUploadedSchema', () => {
  it('accepts a valid upload event', () => {
    const result = videoUploadedSchema.safeParse({
      eventId: 'event-1',
      eventType: 'video.uploaded',
      version: 1,
      occurredAt: new Date().toISOString(),
      data: { videoId: 'video-1', objectKey: 'originals/video-1/source.mp4' }
    });
    expect(result.success).toBe(true);
  });

  it('rejects a wrong event type', () => {
    expect(videoUploadedSchema.safeParse({
      eventId: 'event-1', eventType: 'user.created', version: 1,
      occurredAt: new Date().toISOString(),
      data: { videoId: 'video-1', objectKey: 'source.mp4' }
    }).success).toBe(false);
  });
});

describe('safeObjectKey', () => {
  it('rejects traversal keys', () => {
    expect(() => safeObjectKey('../secret')).toThrow();
    expect(() => safeObjectKey('a/../secret')).toThrow();
  });
});
