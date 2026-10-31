import fp from "fastify-plugin";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    storage: {
      createPlaybackUrl(key: string, expiresIn?: number): Promise<string>;
      objectExists(key: string): Promise<boolean>;
    };
  }
}

export default fp(async (app) => {
  const client = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: config.s3ForcePathStyle,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY,
      secretAccessKey: config.S3_SECRET_KEY
    }
  });

  app.decorate("storage", {
    async createPlaybackUrl(key: string, expiresIn = config.PLAYBACK_URL_TTL_SECONDS) {
      // Pre-signed object URLs are only effective if the bucket/object policy allows the signer
      // to read the object. Keep bucket private in production.
      const url = new URL(`${config.PLAYBACK_BASE_URL.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`);
      // The configured playback base URL is used for browser-visible playback.
      // For private S3/MinIO origins, replace this with getSignedUrl(GetObjectCommand).
      return url.toString();
    },
    async objectExists(key: string) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
        return true;
      } catch (error) {
        const name = (error as { name?: string }).name;
        if (name === "NotFound" || name === "NoSuchKey" || name === "NotFoundException") return false;
        throw error;
      }
    }
  });
});
