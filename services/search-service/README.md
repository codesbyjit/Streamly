# Streamly Search Service

Search API and OpenSearch projection for Streamly video metadata. This service does **not** own the source-of-truth video records; it maintains a searchable index from events emitted by the Content Service.

## What it provides

- `GET /health/live` — process liveness.
- `GET /health/ready` — checks OpenSearch and (when enabled) Kafka consumer startup.
- `GET /api/v1/search` — video search with pagination and optional category/creator filters.
- `GET /api/v1/search/suggest?q=...` — title suggestions.
- `PUT /internal/v1/videos/:id` — upsert a video document for local testing or trusted internal calls.
- `DELETE /internal/v1/videos/:id` — remove a document.
- `POST /internal/v1/search/reindex` — create/recreate the index mapping (destructive only when `recreate=true` is supplied).

Internal routes are protected by `INTERNAL_API_KEY` when that variable is non-empty. Do not expose these routes publicly.

## Run locally

From this directory:

```bash
cp .env.example .env
npm install
npm run dev
```

Ensure the root Streamly infrastructure Compose stack is running. If the service is running on the host, defaults target `localhost:9200` and `localhost:9092`. If you add this service to Docker Compose, set `OPENSEARCH_NODE=http://opensearch:9200` and `KAFKA_BROKERS=kafka:19092`.

```bash
curl http://localhost:3010/health/ready
curl 'http://localhost:3010/api/v1/search?q=music&page=1&limit=10'
```

## Docker

Build from this directory:

```bash
docker build -t streamly-search-service .
```

Attach the container to the `streamly-network` network created by the infrastructure Compose stack, then set `OPENSEARCH_NODE=http://opensearch:9200` and `KAFKA_BROKERS=kafka:19092`.

## Event contract

Configure the Content Service to publish these Kafka topics:

- `video.published`
- `video.updated`
- `video.deleted`

Accepted event envelope (the consumer also accepts the video object directly):

```json
{
  "eventId": "evt_123",
  "eventType": "video.published",
  "occurredAt": "2026-10-31T12:00:00.000Z",
  "data": {
    "id": "video_123",
    "title": "Building a distributed system",
    "description": "An introduction",
    "tags": ["backend", "systems"],
    "category": "Technology",
    "creatorId": "user_123",
    "creatorName": "Jit",
    "visibility": "public",
    "status": "published",
    "publishedAt": "2026-10-31T12:00:00.000Z",
    "thumbnailUrl": "https://cdn.example.test/thumb.jpg",
    "durationSeconds": 420,
    "viewCount": 0
  }
}
```

Only videos with `visibility=public` and `status=published` are indexed. Unpublish/private/delete events remove the video from search. Make sure the Content Service's actual event schema matches or adapt `src/events/video-event.ts`.

Kafka consumer processing is idempotent by video ID. The consumer commits offsets after processing each message. For high-throughput production use, consider retry topics/dead-letter queues and a durable outbox in the producer.

## Search parameters

`GET /api/v1/search?q=...&page=1&limit=20&category=Technology&creatorId=user_123&sort=relevance`

- `q` optional; omitted means browse recent indexed videos.
- `page` defaults to `1`, maximum is `10000`.
- `limit` defaults to `20`, maximum is `50`.
- `category` and `creatorId` are exact filters.
- `sort`: `relevance`, `recent`, or `popular`.

Response shape:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalRelation": "eq",
  "hasMore": false
}
```

OpenSearch is the only datastore this service needs. PostgreSQL remains owned by the Content Service; do not have Search Service query or modify Content Service tables directly.

## Notes

- The local infrastructure stack disables OpenSearch security; keep it local only.
- Add authentication/authorization at the API gateway before exposing search endpoints to clients.
- Search results deliberately filter out private, unlisted, unpublished, and deleted content.
- This folder is self-contained; it does not assume a shared monorepo package exists yet.
