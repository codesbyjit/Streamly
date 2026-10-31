# Recommendation Service

Streamly's recommendation API. It provides personalized and trending video feeds, records user interactions, and exposes internal analytics. Ranking is deterministic and database-backed so the service works locally without an external ML model.

## Routes

Public routes are mounted under `/api/v1/recommendation`:
- `GET /health` — service and database health
- `GET /feed` — personalized feed; requires `x-user-id`
- `GET /trending` — trending videos
- `POST /interactions` — record an interaction; requires `x-user-id`

Internal routes are mounted under `/internal/v1/recommendation`:
- `GET /health` — internal health endpoint
- `POST /analytics/events` — record an event with `x-internal-api-key`
- `GET /analytics/summary` — aggregate interaction counts with `x-internal-api-key`

For local development, `x-user-id` is accepted as a gateway-injected identity. Do not trust a client-supplied identity header in production; the gateway must strip incoming values and inject a verified identity. Protect internal routes with a strong secret or service-to-service authentication.

## Run locally

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

The PostgreSQL database must be reachable using `DATABASE_URL`. For your current Compose infrastructure, host-run services use `localhost:5432`; containers use `postgres:5432` on the Compose network.

## Example requests

```bash
curl http://localhost:3010/api/v1/recommendation/health

curl -H "x-user-id: user_123" \
  "http://localhost:3010/api/v1/recommendation/feed?limit=20"

curl -H "x-user-id: user_123" \
  -H "content-type: application/json" \
  -d '{"videoId":"video_123","type":"watch","watchDurationSeconds":90}' \
  http://localhost:3010/api/v1/recommendation/interactions

curl -H "x-internal-api-key: change_this_internal_key" \
  http://localhost:3010/internal/v1/recommendation/analytics/summary
```

## Ranking

The feed excludes videos the user has already watched and ranks eligible published videos using category affinity, recency, and engagement. User preferences are derived from recorded interactions. This is a baseline ranking algorithm, not a trained ML model.

## Database

The migration creates:
- `recommendation_videos`: denormalized video projection maintained by content events or internal syncs
- `recommendation_interactions`: interaction history
- indexes for publication, recency, category, and user interactions

The service does not own the canonical video records. Populate/update the recommendation projection through `POST /internal/v1/recommendation/videos` or integrate a Kafka consumer later.

## Environment

See `.env.example`. Never use the example internal API key outside local development.
