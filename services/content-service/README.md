# Streamly Content Service

Video metadata and publication lifecycle API for Streamly. Built with Fastify, TypeScript, PostgreSQL, and Zod.

## Responsibilities

- Create and retrieve video metadata.
- Update metadata owned by a creator.
- List public published videos with cursor pagination.
- Publish a video only after it reaches `ready`.
- Soft-delete videos.
- Expose liveness and database readiness endpoints.

This service does **not** upload media, transcode files, authenticate users, or serve HLS segments. Those responsibilities belong to the upload, authentication, video-processing, and streaming services.

## Run locally

Run Streamly infrastructure first. From this directory:

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

If using npm or Bun, use the equivalent install command and scripts. The repository may use a root workspace to manage dependencies centrally.

Health endpoints:

- `GET http://localhost:3002/health/live`
- `GET http://localhost:3002/health/ready`

## API

Base path: `/api/v1/videos`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/videos` | Create metadata |
| GET | `/api/v1/videos` | List public published videos |
| GET | `/api/v1/videos/:videoId` | Get public video |
| PATCH | `/api/v1/videos/:videoId?ownerId=<uuid>` | Update metadata |
| DELETE | `/api/v1/videos/:videoId?ownerId=<uuid>` | Soft-delete video |
| POST | `/api/v1/videos/:videoId/publish` | Publish a ready video |

### Create metadata

```json
{
  "ownerId": "8aabf95c-6c3c-4a21-91f8-83fbb2fef201",
  "title": "My first Streamly video",
  "description": "A test upload",
  "category": "Technology",
  "tags": ["streamly", "demo"],
  "visibility": "private"
}
```

`ownerId` is temporarily accepted from the request to make local API development possible before the auth service and gateway are connected. **This is not secure for deployment.** Before exposing the service, derive the owner identity from a verified JWT or trusted gateway identity and remove client-controlled ownership fields. Likewise, protect mutation routes with authentication and authorization.

## Lifecycle

```text
draft -> uploading -> processing -> ready -> published
                         |
                         +-> failed
```

The upload and worker services will own the transitions into `uploading`, `processing`, `ready`, and `failed`. The content service currently creates drafts and allows publication only from `ready`.

## Database

Migration: `migrations/001_create_videos.sql`.

The service expects the shared development PostgreSQL instance. The migration creates the `videos` table, indexes, and an update timestamp trigger. Run migrations explicitly; the API does not silently mutate schema at startup.

## Notes

- Use parameterized SQL for database access.
- Video records are soft-deleted.
- Private and unlisted records are not returned by the public GET route.
- Cursor pagination is intended for public feeds.
- Event publishing is not wired yet. Add a transactional outbox before relying on Kafka events for publication/indexing workflows.
- The provided test suite covers request schemas. Add database integration tests before production use.
