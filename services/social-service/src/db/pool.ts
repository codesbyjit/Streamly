import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
  application_name: 'streamly-social-service',
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

pool.on('error', error => {
  console.error({ err: error }, 'Unexpected idle PostgreSQL client error');
});

export async function checkDatabase(): Promise<void> {
  await pool.query('SELECT 1');
}
