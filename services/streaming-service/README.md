# Streamly Streaming Service

Playback authorization and manifest-resolution service for HLS assets. It does **not** transcode media or proxy every video segment; FFmpeg workers generate HLS assets and object storage/CDN serves them.

## Responsibilities

- Resolve playback for a video ID.
- Require a valid Streamly access token.
- Enforce private/unlisted/public visibility using the local asset record.
- Return HLS master-manifest URL and available renditions.
- Optionally verify video publication/visibility with `CONTENT_SERVICE_URL`.
- Provide health, readiness, and OpenAPI endpoints.

## Important integration contract

This starter validates HS256 access tokens using `JWT_SECRET`. Configure the same secret, issuer, and audience as your auth service for local development. If auth-service uses RS256/EdDSA or a JWKS endpoint, replace `src/plugins/auth.ts` with the matching verifier before integration. Do not accept user identity from an arbitrary `x-user-id` header.

The local database table `streaming.video_assets` is a playback projection populated by the content/video-processing workflow. The service does not assume ownership of the content service's tables.

Expected object layout:
`hls/{videoId}/master.m3u8`

The returned URL uses `PLAYBACK_BASE_URL` and is a normal URL. For a production private bucket, replace this with CloudFront signed URLs/cookies or another secure CDN delivery mechanism. A short-lived signed API playback token alone does not secure public object URLs.

## Install and run (from this directory)

```bash
cp .env.example .env
npm install
npm run dev
```

Run migrations:

```bash
npm run db:migrate
```

The migration script is not bundled as a package script in this minimal starter; apply `migrations/001_init.sql` with `psql` or your preferred migration tool:

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
```

Health: `GET /health`
Readiness: `GET /ready`
OpenAPI UI: `GET /docs`

## Endpoints

- `GET /api/v1/videos/:videoId/playback`
- `GET /api/v1/videos/:videoId/manifest` (metadata/URL response; actual HLS manifest is served by object storage)
- `GET /api/v1/videos/:videoId/renditions`
- `GET /health`
- `GET /ready`

Authenticated users can access published public videos. Owners can access their own private videos. Unlisted videos are available to authenticated users who know the video ID. Tighten unlisted sharing rules if the product requires link-only bearer access.

## Populate a local playback record

```sql
INSERT INTO streaming.video_assets
(video_id, owner_id, status, visibility, master_manifest_key, renditions)
VALUES
('demo-video', 'demo-user', 'READY', 'PUBLIC',
 'hls/demo-video/master.m3u8',
 '[{"label":"720p","width":1280,"height":720,"bandwidth":2500000,"playlistKey":"hls/demo-video/720p/index.m3u8"}]'::jsonb);
```

The `master_manifest_key` must point to an actual HLS master playlist in your MinIO bucket. This service does not create the file.

## Test

```bash
npm test
npm run typecheck
```

This service is a development baseline. Before production, add JWKS/asymmetric token verification as appropriate, signed CDN delivery, request/abuse monitoring, database migration automation, and integration tests against the actual auth/content contracts.
