# Streamly Social Service

Fastify + TypeScript service for comments, reactions, and channel subscriptions. PostgreSQL is the source of truth. Kafka event publishing is optional and can be disabled for local development.

## Requirements

- Node.js 22+
- pnpm
- Streamly's PostgreSQL infrastructure
- Kafka is optional (`KAFKA_ENABLED=false` to disable)

## Setup

From the repository root:

```bash
pnpm install
```

Then:

```bash
cd services/social-service
cp .env.example .env
pnpm dev
```

Set `DATABASE_URL` to match your Docker Compose credentials. The service uses schema `social_service` in the shared `streamly` database and runs SQL migrations at startup by default.

For a local app process, use `localhost:5432` and `localhost:9092`. If this service is itself run as a Compose container, use `postgres:5432` and `kafka:19092` and attach it to `streamly-network`.

## Routes

All routes are under `/api/v1`.

### Comments

- `POST /videos/:videoId/comments` — create a top-level comment or reply (`parentId` optional)
- `GET /videos/:videoId/comments?limit=20&cursor=<commentId>` — list top-level comments
- `GET /comments/:commentId/replies?limit=20&cursor=<commentId>` — list replies
- `PATCH /comments/:commentId` — edit your comment
- `DELETE /comments/:commentId` — soft-delete your comment

Create body:

```json
{ "body": "Great video!", "parentId": null }
```

### Reactions

- `PUT /videos/:videoId/reaction` — set your reaction (`like` or `dislike`)
- `DELETE /videos/:videoId/reaction` — remove your reaction
- `GET /videos/:videoId/reactions` — aggregate counts and the current user's reaction

### Subscriptions

- `PUT /channels/:channelId/subscription` — subscribe
- `DELETE /channels/:channelId/subscription` — unsubscribe
- `GET /channels/:channelId/subscription` — subscription count and current-user state
- `GET /me/subscriptions?limit=20&cursor=<channelId>` — list channel IDs the current user subscribes to

## Identity and gateway trust

The API gateway must validate the user's access token, then set `x-user-id` and `x-internal-api-key` on its upstream request. The service rejects protected routes if either header is missing/invalid. Never expose this service directly to the public internet with a client-supplied identity header. Use a long random `INTERNAL_API_KEY` shared only between the gateway and trusted services.

The service accepts UUID user/channel/video IDs. If other Streamly services use non-UUID identifiers, align the ID validation and migration types before integration.

## Events

When Kafka is enabled, the service publishes events to `streamly.social.events`:
- `social.comment.created`
- `social.comment.updated`
- `social.comment.deleted`
- `social.reaction.changed`
- `social.reaction.removed`
- `social.channel.subscribed`
- `social.channel.unsubscribed`

Events use an envelope with `eventId`, `eventType`, `occurredAt`, `producer`, and `data`. This is best-effort publishing after the database transaction. For guaranteed delivery, replace direct publishing with a transactional outbox and a separate publisher worker before production.

## Migrations and tests

```bash
pnpm db:migrate
pnpm typecheck
pnpm test
```

## Notes

- Comments are soft-deleted; the body is replaced with `[deleted]`.
- A user may have one reaction per video. Changing a reaction updates the existing record.
- Self-subscriptions are rejected.
- All write operations use parameterized SQL and validate request bodies.
- This is a development-ready baseline, not a production security audit. Add moderation, spam protection, audit trails, outbox delivery, and integration tests before production.
