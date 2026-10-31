import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.forcePathStyle,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY
  }
});

export async function downloadObject(bucket: string, key: string, destination: string): Promise<number> {
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const size = head.ContentLength;
  if (typeof size === "number" && size > config.MAX_SOURCE_BYTES) {
    throw new Error(`Source object is too large (${size} bytes; limit ${config.MAX_SOURCE_BYTES})`);
  }

  await mkdir(path.dirname(destination), { recursive: true });
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`S3 returned an empty body for ${key}`);
  await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destination));
  const downloaded = await stat(destination);
  if (downloaded.size === 0) throw new Error(`Downloaded source object is empty: ${key}`);
  if (downloaded.size > config.MAX_SOURCE_BYTES) {
    throw new Error(`Downloaded source exceeds size limit (${downloaded.size} bytes)`);
  }
  return downloaded.size;
}

export async function uploadFile(
  bucket: string,
  key: string,
  filePath: string,
  contentType: string
): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentLength: (await stat(filePath)).size,
    ContentType: contentType,
    CacheControl: key.endsWith(".m3u8") ? "no-cache" : "public, max-age=31536000, immutable"
  }));
}
