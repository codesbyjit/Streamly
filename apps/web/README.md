# Streamly Web

Next.js frontend for the Streamly monorepo. It uses the existing API gateway and service contracts; it does not create or own a database.

## Setup

From the repository root:

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web dev
```

Open http://localhost:3000.

The API gateway must be running at `http://localhost:4000`. Override `API_GATEWAY_URL` in `apps/web/.env.local` if needed.

## Implemented

- Responsive dark video discovery feed
- Search by title against the currently returned public feed
- Register, login, refresh-token rotation and logout through Next.js route handlers
- HttpOnly access and refresh cookies
- Upload flow: create upload session, PUT directly to MinIO, complete session, create video metadata
- Watch page using Shaka Player for HLS playback

## Backend integration notes

The frontend follows the current service routes:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET|POST /api/v1/content`
- `GET /api/v1/content/:videoId`
- `POST /api/v1/upload`
- `POST /api/v1/upload/:uploadId/complete`
- `GET /api/v1/stream/:videoId/playback`

The upload service currently uses `x-dev-user-id` development identity, while content creation accepts `ownerId` in the request body. The Next.js upload route extracts the JWT subject only to pass this local development identity header. This is not production authentication. Replace the service's development identity mechanism with verified JWT authentication before deployment.

The content create endpoint in the current backend schema does not accept a `videoId` from the upload session. The upload route therefore creates metadata with the service-generated ID, while the upload worker emits the upload-session video ID. Align those IDs in the backend before relying on the full upload-to-processing-to-playback flow. The UI upload flow is wired to the current endpoints but this ID mismatch must be fixed server-side.

MinIO must allow browser PUT requests from `http://localhost:3000` (CORS). The upload service's `S3_ENDPOINT` used to generate the presigned URL must be reachable by the browser, normally `http://localhost:9000` for local development.

## Scope

This is a minimal functional starting UI, not a finished YouTube clone. Search, subscriptions, watch history, comments, likes, creator studio analytics and channel pages are not included yet because the corresponding frontend-facing backend flows are not fully available in the current service contracts.
