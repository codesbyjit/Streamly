import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3';
import { mkdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { config } from './config.js';

export const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.s3ForcePathStyle,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY
  }
});

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET }));
    } catch (err) {
      // A concurrent initializer may have created it; verify before failing.
      await s3.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET })).catch(() => { throw err; });
    }
  }
}

export async function downloadObject(bucket: string, key: string, destination: string): Promise<number> {
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const length = Number(head.ContentLength ?? 0);
  if (!length) throw new Error('Source object is empty or its size is unknown');
  if (length > config.MAX_SOURCE_BYTES) throw new Error(`Source exceeds MAX_SOURCE_BYTES (${length} bytes)`);
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error('Object storage returned an empty response body');
  await mkdir(path.dirname(destination), { recursive: true });
  await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destination));
  return length;
}

export async function uploadFile(filePath: string, key: string, contentType: string): Promise<void> {
  const { createReadStream, stat } = await import('node:fs');
  const info = await stat(filePath);
  await s3.send(new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    Body: createReadStream(filePath),
    ContentLength: info.size,
    ContentType: contentType
  }));
}

export async function cleanDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
