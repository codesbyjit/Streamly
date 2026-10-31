import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  application_name: config.SERVICE_NAME
});

const schema = config.DATABASE_SCHEMA;

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".processing_jobs (
        job_id UUID PRIMARY KEY,
        video_id TEXT NOT NULL,
        source_bucket TEXT NOT NULL,
        source_key TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued','processing','ready','failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        duration_seconds DOUBLE PRECISION,
        master_playlist_key TEXT,
        thumbnail_key TEXT,
        renditions JSONB,
        error_code TEXT,
        error_message TEXT,
        source_event_id TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS processing_jobs_video_id_idx
      ON "${schema}".processing_jobs (video_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS processing_jobs_status_idx
      ON "${schema}".processing_jobs (status, updated_at)
    `);
    logger.info({ schema }, 'Database schema is ready');
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export { schema };
