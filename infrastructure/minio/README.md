# MinIO

Local S3-compatible endpoint: `http://localhost:9000`; console: `http://localhost:9001`.

Default local credentials from `infrastructure/docker/.env`:

```dotenv
MINIO_ROOT_USER=streamly
MINIO_ROOT_PASSWORD=streamly_minio_dev_password
```

The Compose `minio-init` one-shot container creates the private `streamly-media` bucket. Keep it private; use presigned URLs for client upload/download flows.

Host-app settings:

```dotenv
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=streamly
S3_SECRET_KEY=streamly_minio_dev_password
S3_BUCKET=streamly-media
S3_FORCE_PATH_STYLE=true
```

From a container on `streamly-network`, use `http://minio:9000`.

Suggested object keys:

```text
originals/{videoId}/{uploadId}/source
hls/{videoId}/master.m3u8
hls/{videoId}/{rendition}/index.m3u8
hls/{videoId}/{rendition}/segment-{sequence}.ts
thumbnails/{videoId}/thumbnail.jpg
```

Persist object keys, not public URLs. These credentials are development-only; production should use least-privilege access and private buckets.
