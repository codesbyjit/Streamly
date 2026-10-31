import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { config, allowedContentTypes } from "../config.js";
import { createPresignedPut, headObject, deleteObject, makeObjectKey } from "../storage/s3.js";
import { publish } from "../kafka/producer.js";

export class UploadError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "UploadError";
  }
}

type CreateInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

const sessionTtlMs = config.UPLOAD_SESSION_TTL_HOURS * 60 * 60 * 1000;

export async function createUpload(ownerId: string, input: CreateInput) {
  const fileName = input.fileName.trim();
  if (!fileName || fileName.length > 255 || fileName.includes("/") || fileName.includes("\\")) {
    throw new UploadError(400, "fileName must be a plain filename up to 255 characters");
  }
  if (!allowedContentTypes.has(input.contentType)) {
    throw new UploadError(415, "Unsupported video content type");
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > config.S3_UPLOAD_MAX_BYTES) {
    throw new UploadError(400, `sizeBytes must be between 1 and ${config.S3_UPLOAD_MAX_BYTES}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const videoId = randomUUID();
    const objectKey = makeObjectKey(ownerId, videoId, fileName);
    const expiresAt = new Date(Date.now() + sessionTtlMs);
    const inserted = await client.query(
      `INSERT INTO upload_sessions
        (owner_id, video_id, file_name, content_type, expected_size_bytes, object_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, video_id, object_key, status, expires_at`,
      [ownerId, videoId, fileName, input.contentType, input.sizeBytes, objectKey, expiresAt]
    );
    await client.query("COMMIT");

    const row = inserted.rows[0] as {
      id: string; video_id: string; object_key: string; status: string; expires_at: Date;
    };
    try {
      const signed = await createPresignedPut(row.object_key, input.contentType);
      return {
        uploadId: row.id,
        videoId: row.video_id,
        objectKey: row.object_key,
        status: row.status,
        expiresAt: row.expires_at,
        uploadUrl: signed.uploadUrl,
        requiredHeaders: signed.requiredHeaders
      };
    } catch (error) {
      await pool.query(
        `UPDATE upload_sessions SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      throw error;
    }
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function completeUpload(ownerId: string, uploadId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT * FROM upload_sessions
       WHERE id = $1 AND owner_id = $2
       FOR UPDATE`,
      [uploadId, ownerId]
    );
    const session = result.rows[0] as {
      id: string; video_id: string; owner_id: string; file_name: string;
      content_type: string; expected_size_bytes: string; object_key: string;
      status: string; expires_at: Date;
    } | undefined;

    if (!session) throw new UploadError(404, "Upload session not found");
    if (session.status === "completed") {
      await client.query("COMMIT");
      return { uploadId: session.id, videoId: session.video_id, status: "completed" };
    }
    if (session.status !== "pending" && session.status !== "uploaded") {
      throw new UploadError(409, `Upload session is ${session.status}`);
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await client.query(
        `UPDATE upload_sessions SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [uploadId]
      );
      await client.query("COMMIT");
      throw new UploadError(410, "Upload session expired");
    }

    let head;
    try {
      head = await headObject(session.object_key);
    } catch {
      throw new UploadError(409, "Uploaded object was not found; upload the file before completing");
    }

    const actualSize = Number(head.ContentLength ?? -1);
    if (actualSize !== Number(session.expected_size_bytes)) {
      throw new UploadError(422, "Uploaded object size does not match the declared size");
    }
    if (head.ContentType && head.ContentType !== session.content_type) {
      throw new UploadError(422, "Uploaded object content type does not match the declared content type");
    }

    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const payload = {
      eventId,
      eventType: "video.uploaded",
      version: 1,
      occurredAt,
      producer: "upload-service",
      data: {
        uploadId: session.id,
        videoId: session.video_id,
        ownerId: session.owner_id,
        bucket: config.S3_BUCKET,
        objectKey: session.object_key,
        fileName: session.file_name,
        contentType: session.content_type,
        sizeBytes: actualSize
      }
    };

    await client.query(
      `UPDATE upload_sessions SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [uploadId]
    );
    await client.query(
      `INSERT INTO event_outbox (aggregate_id, event_type, topic, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [session.video_id, "video.uploaded", config.KAFKA_TOPIC_VIDEO_UPLOADED, JSON.stringify(payload)]
    );
    await client.query("COMMIT");

    return { uploadId: session.id, videoId: session.video_id, status: "completed" };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* already committed or transaction aborted */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function getUpload(ownerId: string, uploadId: string) {
  const result = await pool.query(
    `SELECT id, video_id, file_name, content_type, expected_size_bytes,
            status, expires_at, completed_at, created_at, updated_at
     FROM upload_sessions WHERE id = $1 AND owner_id = $2`,
    [uploadId, ownerId]
  );
  const row = result.rows[0];
  if (!row) throw new UploadError(404, "Upload session not found");
  return {
    uploadId: row.id,
    videoId: row.video_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: Number(row.expected_size_bytes),
    status: row.status,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function cancelUpload(ownerId: string, uploadId: string) {
  const result = await pool.query(
    `UPDATE upload_sessions
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND owner_id = $2 AND status IN ('pending', 'uploaded')
     RETURNING id, object_key`,
    [uploadId, ownerId]
  );
  const row = result.rows[0] as { id: string; object_key: string } | undefined;
  if (!row) {
    const existing = await pool.query(
      "SELECT status FROM upload_sessions WHERE id = $1 AND owner_id = $2",
      [uploadId, ownerId]
    );
    if (!existing.rows[0]) throw new UploadError(404, "Upload session not found");
    throw new UploadError(409, `Cannot cancel upload in ${existing.rows[0].status} state`);
  }
  try { await deleteObject(row.object_key); } catch { /* object may not exist; lifecycle cleanup can reconcile */ }
  return { uploadId: row.id, status: "cancelled" };
}

export async function dispatchOutboxBatch(limit = 50): Promise<number> {
  const candidates = await pool.query(
    `SELECT id, topic, aggregate_id, payload
     FROM event_outbox WHERE published_at IS NULL
     ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
  let sent = 0;
  for (const row of candidates.rows as Array<{ id: string; topic: string; aggregate_id: string; payload: unknown }>) {
    // Claim with a short DB lock to reduce duplicate sends if multiple instances run.
    const claim = await pool.query(
      `UPDATE event_outbox SET attempts = attempts + 1
       WHERE id = $1 AND published_at IS NULL
       RETURNING id`,
      [row.id]
    );
    if (claim.rowCount !== 1) continue;
    try {
      await publish(row.topic, row.aggregate_id, row.payload);
      await pool.query(
        `UPDATE event_outbox SET published_at = NOW(), last_error = NULL
         WHERE id = $1`,
        [row.id]
      );
      sent++;
    } catch (error) {
      await pool.query(
        `UPDATE event_outbox SET last_error = $2 WHERE id = $1`,
        [row.id, error instanceof Error ? error.message.slice(0, 1000) : "Unknown publish error"]
      );
      // Kafka may be disabled locally; leave outbox pending for a later retry.
      if (process.env.NODE_ENV === "test") throw error;
    }
  }
  return sent;
}
