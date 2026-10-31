import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

async function migrate() {
  const migrationPath = fileURLToPath(new URL("../../migrations/001_create_videos.sql", import.meta.url));
  const sql = await readFile(migrationPath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const version = "001_create_videos";
    const applied = await client.query("SELECT version FROM schema_migrations WHERE version = $1", [version]);
    if (applied.rowCount === 0) {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      console.log(`Applied migration: ${version}`);
    } else {
      console.log(`Migration already applied: ${version}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Database migration failed", error);
  process.exitCode = 1;
});