import { pool } from "../db/pool.js";
import type { AssetStatus, Rendition, VideoAsset, Visibility } from "../types.js";

interface Row {
  video_id: string;
  owner_id: string;
  status: AssetStatus;
  visibility: Visibility;
  master_manifest_key: string;
  renditions: Rendition[] | string;
  duration_seconds: string | number | null;
  width: number | null;
  height: number | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: Row): VideoAsset {
  const renditions = typeof row.renditions === "string" ? JSON.parse(row.renditions) : row.renditions;
  return {
    videoId: row.video_id,
    ownerId: row.owner_id,
    status: row.status,
    visibility: row.visibility,
    masterManifestKey: row.master_manifest_key,
    renditions,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class VideoAssetsRepository {
  async findById(videoId: string): Promise<VideoAsset | null> {
    const result = await pool.query<Row>(
      `SELECT video_id, owner_id, status, visibility, master_manifest_key,
              renditions, duration_seconds, width, height, created_at, updated_at
       FROM streaming.video_assets WHERE video_id = $1 LIMIT 1`,
      [videoId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
}
