import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../migrations');

export async function runMigrations(): Promise<void> {
  await pool.query('CREATE SCHEMA IF NOT EXISTS social_service');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_service.schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const files = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();

  for (const filename of files) {
    const applied = await pool.query(
      'SELECT 1 FROM social_service.schema_migrations WHERE filename = $1',
      [filename]
    );
    if (applied.rowCount) continue;

    const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO social_service.schema_migrations(filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
