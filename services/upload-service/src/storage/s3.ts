import { createHash, randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

export const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY
  }
});

export function makeObjectKey(ownerId: string, videoId: string, fileName: string): string {
  const ext = fileName.toLowerCase().match(/\.[a-z0-9]{1,10}$/)?.[0] ?? "";
  const safeOwner = createHash("sha256").update(ownerId).digest("hex").slice(0, 24);
  return `${config.S3_KEY_PREFIX}/${safeOwner}/${videoId}/source${ext}`;
}

export async function createPresignedPut(objectKey: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: objectKey,
    ContentType: contentType
  });
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: config.S3_PRESIGN_EXPIRES_SECONDS,
    signableHeaders: new Set(["content-type"])
  });
  return { uploadUrl, requiredHeaders: { "Content-Type": contentType } };
}

export async function headObject(objectKey: string) {
  return s3.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: objectKey }));
}

export async function deleteObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: objectKey }));
}

export function newVideoId(): string {
  return randomUUID();
}
