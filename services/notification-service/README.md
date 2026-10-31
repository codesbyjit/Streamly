# Streamly Notification Service

A TypeScript/Fastify notification microservice for Streamly. It stores in-app notifications in PostgreSQL, consumes domain events from Kafka, exposes authenticated notification APIs, stores user notification preferences, and optionally delivers email through an SMTP outbox.

## Requirements

- Node.js 22+
- PostgreSQL reachable through `DATABASE_URL`
- Kafka reachable through `KAFKA_BROKERS` if `WORKER_ENABLED=true`
- Mailpit or another SMTP server if email delivery is enabled

The service uses a dedicated PostgreSQL schema (`notification`) in the existing Streamly database. It does not require a separate PostgreSQL container.

## Setup

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Health endpoints:
- `GET /health`
- `GET /ready`

Default port: `3010`.

For local development, set `JWT_SECRET` to the same HS256 secret used by your auth service. It must be at least 32 characters. All API endpoints except health/readiness require a bearer JWT with a user identity in `sub`, `userId`, or `user_id`. If your auth service uses asymmetric JWT signing, replace `src/auth.ts` with the project's shared token verification library; do not weaken authentication by trusting arbitrary `x-user-id` headers.

## API

All user-facing routes operate on the authenticated user's ID; callers cannot select another user's notification list by passing a recipient ID.

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/notifications` | List notifications; `limit`, `cursor`, `unreadOnly` |
| GET | `/api/v1/notifications/unread-count` | Count unread notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark one notification read |
| PATCH | `/api/v1/notifications/read-all` | Mark all notifications read |
| DELETE | `/api/v1/notifications/:id` | Delete a notification |
| GET | `/api/v1/notifications/preferences` | Get preferences |
| PUT | `/api/v1/notifications/preferences` | Update preferences |
| POST | `/internal/v1/notifications` | Internal create operation |

Example request:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3010/api/v1/notifications?limit=20&unreadOnly=true"
```

Internal create body:

```json
{
  "recipientId": "user_123",
  "type": "system",
  "title": "Welcome to Streamly",
  "body": "Your account is ready.",
  "data": {},
  "sourceEventId": "welcome:user_123"
}
```

Protect `/internal/v1/*` with private gateway routing and service-to-service authorization in deployments. The sample endpoint requires a valid user JWT, so for production machine-to-machine calls use a dedicated service identity / scope or an internal auth mechanism rather than forwarding a user's token.

## Kafka event contract

The consumer expects JSON messages with this envelope:

```json
{
  "eventId": "evt_123",
  "eventType": "video.published",
  "data": {
    "subscriberId": "user_123",
    "videoId": "video_456",
    "videoTitle": "Streamly architecture",
    "channelName": "Jit"
  }
}
```

Initial mappings:
- `video.published`: expects a recipient ID and video ID. Fan-out to subscribers should be done upstream or by a dedicated fan-out consumer; this service does not query another service's database.
- `channel.subscribed`: expects the channel owner/creator ID.
- `comment.created`: expects the video owner ID and video ID.

`KAFKA_TOPICS` defaults to `video.published,channel.subscribed,comment.created`. Topic names and payloads must match the producers' actual contracts. Event IDs are used for deduplication; recipient-specific fan-out events should use a stable unique event ID per recipient.

## Email delivery

Email is disabled by default. For local Mailpit:
```dotenv
EMAIL_ENABLED=true
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

When the recipient has enabled email notifications and the event includes an `email` field in `data`, an outbox row is created in the same transaction as the notification. In a production design, avoid placing email addresses in broadly consumed event payloads; resolve them through an authorized identity integration or pass a narrowly scoped delivery instruction.

The outbox uses retry delays. Add a maximum-attempt policy and a dead-letter/alerting path before production use.

## Docker

Build from this directory:
```bash
docker build -t streamly-notification-service .
```

To run it in the same Compose network as infrastructure, configure:
- `DATABASE_URL=postgresql://streamly:...@postgres:5432/streamly`
- `KAFKA_BROKERS=kafka:19092`
- `SMTP_HOST=mailpit`

Run migrations as a separate release step:
```bash
npm run db:migrate
```

## Notes

- This implementation is a complete starting service, but adapt JWT verification and event payloads to the actual Streamly contracts before integrating it.
- Add rate limits to internal/public routes at the gateway.
- Add a retention job for old notifications.
- For large-scale fan-out, publish per-recipient notification commands or use a dedicated fan-out worker.
- Email is best-effort and should not block notification API requests.
