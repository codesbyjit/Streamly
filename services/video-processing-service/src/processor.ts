import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pool, schema } from './db.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { createThumbnail, probeMedia, transcodeHls } from './processors/ffmpeg.js';
import { cleanDir, downloadObject, uploadFile } from './storage.js';
import type { ProcessingEvent, VideoUploadedEvent } from './types.js';

function q(name: string): string {
  return `"${schema}".${name}`;
}

export async function processVideo(event: VideoUploadedEvent): Promise<ProcessingEvent> {
  const jobId = randomUUID();
  const videoId = event.data.videoId;
  const bucket = event.data.bucket || config.S3_BUCKET;
  const sourceKey = event.data.objectKey;
  const workDir = path.resolve(config.WORK_DIR, jobId);
  const sourcePath = path.join(workDir, 'source.bin');
  const outputDir = path.join(workDir, 'hls');
  const thumbnailPath = path.join(workDir, 'thumbnail.jpg');

  const existing = await pool.query(
    `SELECT job_id, status, master_playlist_key, thumbnail_key, duration_seconds, renditions
     FROM ${q('processing_jobs')} WHERE source_event_id = $1`,
    [event.eventId]
  );
  if (existing.rows[0]?.status === 'ready') {
    const row = existing.rows[0];
    return {
      eventId: randomUUID(), eventType: 'video.processing.completed', version: 1,
      occurredAt: new Date().toISOString(), producer: config.SERVICE_NAME,
      data: {
        videoId, jobId: row.job_id, status: 'ready',
        originalKey: sourceKey,
        masterPlaylistKey: row.master_playlist_key,
        thumbnailKey: row.thumbnail_key,
        durationSeconds: Number(row.duration_seconds),
        renditions: row.renditions
      }
    };
  }

  await mkdir(workDir, { recursive: true });
  await pool.query(
    `INSERT INTO ${q('processing_jobs')}
       (job_id, video_id, source_bucket, source_key, status, attempts, source_event_id, started_at, updated_at)
     VALUES ($1,$2,$3,$4,'processing',1,$5,now(),now())
     ON CONFLICT (source_event_id) DO UPDATE SET
       status='processing', attempts=${q('processing_jobs')}.attempts + 1,
       error_code=NULL, error_message=NULL, started_at=now(), updated_at=now()`,
    [jobId, videoId, bucket, sourceKey, event.eventId]
  );

  const publishBase = {
    eventId: randomUUID(),
    version: 1 as const,
    occurredAt: new Date().toISOString(),
    producer: config.SERVICE_NAME
  };

  try {
    logger.info({ jobId, videoId, sourceKey }, 'Video processing started');
    await downloadObject(bucket, sourceKey, sourcePath);
    const info = await probeMedia(sourcePath);
    await createThumbnail(sourcePath, thumbnailPath);
    const renditions = await transcodeHls(sourcePath, outputDir, info);

    const masterKey = `hls/${videoId}/${jobId}/master.m3u8`;
    const thumbnailKey = `thumbnails/${videoId}/${jobId}.jpg`;

    await uploadFile(thumbnailPath, thumbnailKey, 'image/jpeg');
    for (const rendition of renditions) {
      const dir = path.join(outputDir, rendition.name);
      const { readdir, stat } = await import('node:fs/promises');
      for (const filename of await readdir(dir)) {
        const fullPath = path.join(dir, filename);
        if (!(await stat(fullPath)).isFile()) continue;
        const contentType = filename.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : 'video/mp2t';
        await uploadFile(fullPath, `hls/${videoId}/${jobId}/${rendition.name}/${filename}`, contentType);
      }
    }
    await uploadFile(path.join(outputDir, 'master.m3u8'), masterKey, 'application/vnd.apple.mpegurl');

    const renditionData = renditions.map((r) => ({
      name: r.name, width: r.width, height: r.height,
      playlistKey: `hls/${videoId}/${jobId}/${r.name}/index.m3u8`
    }));
    await pool.query(
      `UPDATE ${q('processing_jobs')}
       SET status='ready', duration_seconds=$2, master_playlist_key=$3, thumbnail_key=$4,
           renditions=$5::jsonb, error_code=NULL, error_message=NULL, completed_at=now(), updated_at=now()
       WHERE source_event_id=$1`,
      [event.eventId, info.durationSeconds, masterKey, thumbnailKey, JSON.stringify(renditionData)]
    );

    logger.info({ jobId, videoId, durationSeconds: info.durationSeconds, renditions: renditionData }, 'Video processing completed');
    return {
      ...publishBase, eventType: 'video.processing.completed',
      data: {
        videoId, jobId, status: 'ready', originalKey: sourceKey,
        masterPlaylistKey: masterKey, thumbnailKey,
        durationSeconds: info.durationSeconds, renditions: renditionData
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE ${q('processing_jobs')} SET status='failed', error_code='PROCESSING_FAILED',
       error_message=$2, updated_at=now(), completed_at=now()
       WHERE source_event_id=$1`,
      [event.eventId, message.slice(0, 4000)]
    );
    logger.error({ jobId, videoId, err: message }, 'Video processing failed');
    throw error;
  } finally {
    await cleanDir(workDir).catch((err) => logger.warn({ err }, 'Could not clean temporary work directory'));
  }
}
