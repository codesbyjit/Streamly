# Streamly Transcode Service

Kafka-driven FFmpeg worker that consumes `video.uploaded`, downloads the source object from MinIO/S3, creates HLS renditions and a thumbnail, uploads generated assets, and publishes success/failure events.

## Expected input event

The upload service must publish an event shaped like this (the consumer also accepts a `data` envelope):

```json
{
  "eventId": "evt_123",
  "eventType": "video.uploaded",
  "version": 1,
  "occurredAt": "2026-10-31T12:00:00.000Z",
  "data": {
    "videoId": "video_123",
    "ownerId": "user_123",
    "bucket": "streamly-media",
    "objectKey": "originals/video_123/source.mp4",
    "contentType": "video/mp4",
    "sizeBytes": 12345678
  }
}
```

`bucket` is optional and defaults to `S3_BUCKET`. `objectKey` is required. Event publishing is idempotency-aware through a local work marker only for the current attempt; for production, persist job state in a database or use an outbox/inbox table to guarantee durable deduplication.

## Output events

Success topic (default `video.processing.completed`):

```json
{
  "eventId": "generated-uuid",
  "eventType": "video.processing.completed",
  "version": 1,
  "occurredAt": "ISO timestamp",
  "data": {
    "videoId": "video_123",
    "status": "READY",
    "bucket": "streamly-media",
    "masterPlaylistKey": "hls/video_123/master.m3u8",
    "thumbnailKey": "thumbnails/video_123/thumbnail.jpg",
    "renditions": [
      { "height": 360, "playlistKey": "hls/video_123/360p/index.m3u8" }
    ]
  }
}
```

Failure topic (default `video.processing.failed`) carries `videoId`, `sourceObjectKey`, `error`, and `status: "FAILED"`.

## Run locally

1. Ensure the Streamly infrastructure Compose stack is running.
2. Create a bucket called `streamly-media` (the infra `minio-init` container should create it).
3. Copy `.env.example` to `.env`; adjust endpoints/credentials for your setup.
4. Install and run:

```bash
npm install
cp .env.example .env
npm run typecheck
npm run dev
```

You need `ffmpeg` and `ffprobe` on your host PATH when running outside Docker. On Windows, install FFmpeg and ensure both commands are on PATH.

## Run in Docker

Build the image from this directory:

```bash
docker build -t streamly-transcode-service .
```

To attach it to the existing infrastructure network:

```bash
docker run --rm --name streamly-transcode-service \
  --network streamly-network \
  --env-file .env \
  -e KAFKA_BROKERS=kafka:19092 \
  -e S3_ENDPOINT=http://minio:9000 \
  streamly-transcode-service
```

The environment file should use container-network endpoints when the worker runs in Docker. Do not expose these development credentials outside your machine.

## Output object layout

```text
hls/{videoId}/
├── master.m3u8
├── 360p/index.m3u8
├── 360p/segment_000.ts
├── 720p/index.m3u8
└── 720p/segment_000.ts

thumbnails/{videoId}/thumbnail.jpg
```

Renditions are generated only when the source is at least that tall. Audio is encoded as AAC and video as H.264. This is a development baseline, not a complete production transcoding farm.

## Operational notes

- Kafka consumer retries failed processing by throwing; KafkaJS will reprocess according to consumer behavior. A production setup should use bounded retries, a dead-letter topic, and explicit job state.
- `TRANSCODE_CONCURRENCY` is validated and currently controls the worker's per-process job semaphore.
- This worker does not write to PostgreSQL. The content service should consume completion/failure events and update authoritative video status. This avoids multiple services owning the same video database rows.
- Run untrusted media processing in a restricted container with CPU/memory limits and no unnecessary network access.
