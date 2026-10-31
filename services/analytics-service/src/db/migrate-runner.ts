import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "./pool.js";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [73120412]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const filename = "001_initial.sql";
    const applied = await client.query(
      "SELECT 1 FROM analytics_migrations WHERE filename = $1", [filename]
    );
    if (applied.rowCount) return;

    const sql = await readFile(join(process.cwd(), "src/db/migrations", filename), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO analytics_migrations(filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    try { await client.query("SELECT pg_advisory_unlock($1)", [73120412]); } catch {}
    client.release();
  }
}