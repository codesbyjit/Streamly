import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 2,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined
});

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../migrations');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS social_service');
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_service.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      const already = await client.query(
        'SELECT 1 FROM social_service.schema_migrations WHERE filename = $1',
        [filename]
      );
      if (already.rowCount) continue;

      const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO social_service.schema_migrations(filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`Applied migration: ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    console.log('Social-service migrations are up to date.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
