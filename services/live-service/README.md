# Live Service

Fastify control-plane service for Streamly live-stream sessions. It manages stream metadata, lifecycle transitions, ingest-key generation, and analytics ingestion. It does not itself receive or encode live media; configure a compatible RTMP/SRT/WebRTC media server and playback delivery layer separately.

## Setup

From the repository root, install workspace dependencies:

```bash
pnpm install
```

Copy `.env.example` to `.env` in this service directory and update values to match the local infrastructure.

```bash
pnpm --filter @repo/live-service db:migrate
pnpm --filter @repo/live-service dev
```

Default port: `3011`.

## Routes

Public prefix: `/api/v1/live`

- `GET /health`
- `GET /ready`
- `POST /streams`
- `GET /streams`
- `GET /streams/:streamId`
- `POST /streams/:streamId/start`
- `POST /streams/:streamId/end`
- `DELETE /streams/:streamId`

Internal prefix: `/internal/v1/live`

- `GET /health`
- `GET /ready`
- `POST /analytics/:streamId/events`
- `GET /analytics/:streamId/summary`

Analytics endpoints require `x-internal-api-key`. Public stream mutations require `x-user-id`, which must be injected by a trusted gateway after authentication. Do not trust client-supplied identity headers when the service is directly exposed to untrusted clients.

## Database

The migration creates schema `live_service` in the configured PostgreSQL database. It does not create a separate database.

## Kafka

Kafka publishing is disabled by default. Set `KAFKA_ENABLED=true` when the broker is reachable. Lifecycle events are published to `live.lifecycle` or the configured prefixed topic.

## Redis

Redis stores a viewer-count cache key when populated by future media-server integration. Redis is enabled by default; set `REDIS_ENABLED=false` to run without it.

## Media server integration

The `STREAM_INGEST_BASE_URL` and `STREAM_PLAYBACK_BASE_URL` settings currently define returned URLs. The media server must be configured to validate the generated ingest keys and publish playable HLS assets. The current service does not automatically configure or provision that media server.
