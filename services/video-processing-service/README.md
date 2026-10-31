# Video Processing Service

Kafka-driven Streamly worker that downloads uploaded source media from MinIO/S3, validates it with FFprobe, creates a thumbnail, transcodes HLS renditions with FFmpeg, uploads outputs, records job state in PostgreSQL, and publishes a completion/failure event.

## Requirements

- Node.js 22+
- FFmpeg and FFprobe on PATH for local development
- PostgreSQL, Kafka, and MinIO from Streamly infrastructure

## Run locally

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

Set `KAFKA_BROKERS=localhost:9092` and the `DATABASE_URL`/S3 values for host-based development. When running this worker as a Compose service, use `kafka:19092`, `postgres:5432`, and `minio:9000`.

## Input event

Topic: `video.uploaded`

```json
{
  "eventId": "evt-123",
  "eventType": "video.uploaded",
  "version": 1,
  "occurredAt": "2026-10-31T10:00:00.000Z",
  "producer": "upload-service",
  "data": {
    "videoId": "video-123",
    "ownerId": "user-123",
    "objectKey": "originals/video-123/source.mp4",
    "bucket": "streamly-media",
    "sizeBytes": 12000000
  }
}
```

The object must already exist in the configured bucket. The `objectKey` must be an object key, not a URL.

## Output

Successful processing is published to `video.processing.events` as `video.processing.completed`. Processing failures are recorded in PostgreSQL and retried by the worker; malformed input is sent to `video.processing.dlq`.

Outputs use these keys:

- `hls/{videoId}/{jobId}/master.m3u8`
- `hls/{videoId}/{jobId}/{rendition}/index.m3u8`
- `hls/{videoId}/{jobId}/{rendition}/segment_XXXXX.ts`
- `thumbnails/{videoId}/{jobId}.jpg`

The worker writes job state to the `video_processing.processing_jobs` table in the configured PostgreSQL database. It does not modify the content service's tables. The content service should consume the completion event and update its own video state.

## Kafka topics

This service expects these topics to exist:

- `video.uploaded`
- `video.processing.events`
- `video.processing.dlq`

Create them in the local Kafka UI or with Kafka CLI before sending messages. This service intentionally disables automatic topic creation.

## Notes / production hardening

- The current worker is a development baseline, not a claim of production-grade exactly-once processing. Kafka and database/object-storage writes cannot form one atomic transaction; consumers must be idempotent.
- Configure topic creation, retention, and partitions intentionally.
- Use a transactional outbox or reconciliation process for reliable event publication in production.
- Add stronger retry scheduling, concurrency controls, metrics, and integration tests before operating at scale.
- Private video delivery must be enforced by the streaming/CDN layer; do not make the bucket public.
- Set resource limits for FFmpeg and treat all uploaded media as untrusted input.
