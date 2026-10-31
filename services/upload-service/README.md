# Streamly Upload Service

Upload-session API for Streamly. It creates short-lived S3-compatible pre-signed URLs so clients upload video bytes directly to MinIO/S3 instead of proxying large files through this API.

## Responsibilities

- Create authenticated upload sessions.
- Validate declared file type and size.
- Generate private object keys and pre-signed PUT URLs.
- Confirm uploaded objects exist and match expected size/type.
- Persist session state in PostgreSQL.
- Publish `video.uploaded` events to Kafka after confirmation.
- Provide status, cancellation, and expiration cleanup APIs.

## Requirements

- Node.js 22+
- PostgreSQL
- MinIO/S3-compatible object storage
- Optional Kafka (event publishing is disabled when `KAFKA_BROKERS` is empty)

Use the infrastructure Compose stack at the repository level. Make sure the private bucket `streamly-media` exists (the provided infra `minio-init` service creates it).

## Local setup

```bash
cp .env.example .env
npm install
npm run dev
```

The service listens on `http://localhost:4010`. It creates its tables on startup using the SQL migration in `src/db/migrations/001_upload_sessions.sql`.

## API

- `GET /health`
- `POST /v1/uploads`
- `POST /v1/uploads/:uploadId/complete`
- `GET /v1/uploads/:uploadId`
- `DELETE /v1/uploads/:uploadId`

For local development, requests can include `x-dev-user-id: local-user-001`. This is only a development stub. In production, replace it with verified identity from the API gateway/JWT validation; do not enable `DEV_AUTH_ENABLED`.

### Create session

```bash
curl -X POST http://localhost:4010/v1/uploads \
  -H 'content-type: application/json' \
  -H 'x-dev-user-id: local-user-001' \
  -d '{"fileName":"demo.mp4","contentType":"video/mp4","sizeBytes":10485760}'
```

Response includes `uploadId`, `objectKey`, `uploadUrl`, `expiresAt`, and required headers. Upload the file bytes directly to the returned URL using an HTTP PUT with the specified `Content-Type`.

### Complete upload

```bash
curl -X POST http://localhost:4010/v1/uploads/UPLOAD_ID/complete \
  -H 'content-type: application/json' \
  -H 'x-dev-user-id: local-user-001' \
  -d '{}'
```

The service verifies the object in storage and emits `streamly.video.uploaded.v1` when Kafka is configured. Event publishing uses a transactional outbox table so a transient Kafka outage does not lose the event. A background dispatcher retries pending outbox records.

## Event contract

```json
{
  "eventId": "uuid",
  "eventType": "video.uploaded",
  "version": 1,
  "occurredAt": "ISO-8601 timestamp",
  "producer": "upload-service",
  "data": {
    "uploadId": "uuid",
    "videoId": "uuid",
    "ownerId": "local-user-001",
    "bucket": "streamly-media",
    "objectKey": "originals/owner-id/video-id/source.mp4",
    "contentType": "video/mp4",
    "sizeBytes": 10485760
  }
}
```

`videoId` is assigned by this service for now. A later content-service integration can replace that contract with a reservation call or a shared video ID.

## Security notes

- The bucket must remain private.
- Pre-signed URLs are bearer credentials; don't log or share them.
- The service validates object existence, size, and content type, but content-type metadata is not proof that a file is safe. The processing worker must probe media and treat uploads as untrusted.
- Keep `.env` out of Git.
- Configure CORS on MinIO/S3 for browser PUT uploads. The service's HTTP CORS setting does not configure bucket CORS.
- The development identity header is not authentication.
