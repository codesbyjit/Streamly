import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import type { CreateVideoInput, UpdateVideoInput } from "../schemas/video.js";

export type VideoRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string | null;
  tags: string[];
  visibility: "public" | "unlisted" | "private";
  status: "draft" | "uploading" | "processing" | "ready" | "published" | "failed" | "deleted";
  duration_seconds: number | null;
  source_object_key: string | null;
  thumbnail_object_key: string | null;
  hls_master_object_key: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const columns = `id, owner_id, title, description, category, tags, visibility, status,
  duration_seconds, source_object_key, thumbnail_object_key, hls_master_object_key,
  published_at, created_at, updated_at`;

export class VideosRepository {
  async create(input: CreateVideoInput): Promise<VideoRow> {
    const result = await pool.query<VideoRow>(
      `INSERT INTO videos (owner_id, title, description, category, tags, visibility)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${columns}`,
      [input.ownerId, input.title, input.description, input.category ?? null, input.tags, input.visibility]
    );
    return result.rows[0]!;
  }

  async findById(id: string): Promise<VideoRow | null> {
    const result = await pool.query<VideoRow>(
      `SELECT ${columns} FROM videos WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async update(id: string, ownerId: string, input: UpdateVideoInput): Promise<VideoRow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const mapping: Record<string, string> = {
      title: "title",
      description: "description",
      category: "category",
      tags: "tags",
      visibility: "visibility"
    };

    for (const [key, value] of Object.entries(input)) {
      values.push(value);
      fields.push(`${mapping[key]} = $${values.length}`);
    }

    values.push(id, ownerId);
    const result = await pool.query<VideoRow>(
      `UPDATE videos SET ${fields.join(", ")}
       WHERE id = $${values.length - 1}
         AND owner_id = $${values.length}
         AND deleted_at IS NULL
         AND status NOT IN ('processing', 'deleted')
       RETURNING ${columns}`,
      values
    );
    return result.rows[0] ?? null;
  }

  async softDelete(id: string, ownerId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE videos SET status = 'deleted', deleted_at = now()
       WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [id, ownerId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listPublic(limit: number, cursor?: string, category?: string) {
    const values: unknown[] = [];
    const conditions = [
      "status = 'published'",
      "visibility = 'public'",
      "deleted_at IS NULL"
    ];

    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }
    if (cursor) {
      values.push(cursor);
      conditions.push(`(published_at, id) < (
        SELECT published_at, id FROM videos WHERE id = $${values.length}
      )`);
    }

    values.push(limit + 1);
    const result = await pool.query<VideoRow>(
      `SELECT ${columns} FROM videos
       WHERE ${conditions.join(" AND ")}
       ORDER BY published_at DESC NULLS LAST, id DESC
       LIMIT $${values.length}`,
      values
    );

    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    return {
      items: rows,
      nextCursor: hasMore ? rows[rows.length - 1]?.id ?? null : null
    };
  }

  async publish(id: string, ownerId: string): Promise<VideoRow | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<VideoRow>(
        `UPDATE videos
         SET status = 'published', published_at = COALESCE(published_at, now())
         WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
           AND status = 'ready'
         RETURNING ${columns}`,
        [id, ownerId]
      );
      await client.query("COMMIT");
      return result.rows[0] ?? null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}