# Streamly Analytics Service

Consumes Streamly domain events from Kafka, stores an idempotent event ledger in PostgreSQL, maintains aggregate counters, and exposes analytics/reporting APIs.

## Responsibilities

- Consume `streamly.events` from Kafka.
- Validate event envelopes and supported event payloads.
- Persist events with unique `eventId` deduplication.
- Maintain daily video and service-wide aggregates transactionally.
- Expose health, readiness, Prometheus metrics, event ingestion, and reporting endpoints.

## Run locally

From this directory:

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

The default configuration expects the Streamly infrastructure Compose stack to be running on the host. Update `DATABASE_URL` and `KAFKA_BROKERS` if your ports or credentials differ.

For a container on the same Compose network, use:
- PostgreSQL: `postgres:5432`
- Kafka: `kafka:19092`

If this service is launched by a separate Compose project, attach it to `streamly-network` or define it in the same Compose file.

## API

- `GET /health` — process health
- `GET /ready` — database readiness and Kafka consumer state
- `GET /metrics` — Prometheus metrics
- `POST /internal/v1/events` — validated event ingestion; optionally protected by `INGEST_API_KEY`
- `GET /api/v1/analytics/overview?from=2026-01-01&to=2026-01-31`
- `GET /api/v1/analytics/videos/:videoId?from=2026-01-01&to=2026-01-31`
- `GET /api/v1/analytics/top-videos?from=2026-01-01&to=2026-01-31&limit=20`

Dates are inclusive UTC calendar dates. Maximum report range is 366 days. Reports contain only events the service has received.

## Event envelope

Publish events to Kafka topic `streamly.events`:

```json
{
  "eventId": "uuid-or-stable-id",
  "eventType": "video.viewed",
  "version": 1,
  "occurredAt": "2026-11-01T00:00:00.000Z",
  "producer": "streaming-service",
  "data": {
    "videoId": "video_123",
    "userId": "user_123",
    "watchDurationSeconds": 42
  }
}
```

Supported event types:
- `video.impression`
- `video.viewed`
- `video.completed`
- `video.liked`
- `video.disliked`
- `video.published`
- `channel.subscribed`
- `search.performed`

Required payloads:
- Video events require `videoId`.
- `video.viewed` may include `watchDurationSeconds` (0–86400).
- `channel.subscribed` requires `channelId`; `userId` is optional.
- `search.performed` requires `query`; query text is stored only as a normalized length/count dimension, not retained verbatim.

Use stable event IDs and publish an event only after the producer's own operation has succeeded. Consumers are at-least-once; this service deduplicates by `eventId`.

## Important deployment notes

- The initial version uses PostgreSQL for both event ledger and aggregates. This is appropriate for development and moderate event volume, not a claim of hyperscale capacity.
- The Kafka consumer commits offsets after the database transaction succeeds. Failed messages are retried by Kafka; poison-message/DLQ policy should be configured before production.
- Keep this service internal. Do not expose analytics endpoints publicly without gateway authentication and authorization.
- `INGEST_API_KEY` is optional for local development. Set it in non-local environments and use HTTPS at the gateway.
- Do not place raw search terms, email addresses, tokens, or other sensitive data in analytics event payloads.
