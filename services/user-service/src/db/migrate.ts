import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool } from "./pool.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "migrations");

export async function migrate(): Promise<void> {
  await pool.query("CREATE SCHEMA IF NOT EXISTS user_service");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_service.schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of files) {
    const alreadyApplied = await pool.query(
      "SELECT 1 FROM user_service.schema_migrations WHERE name = $1",
      [name]
    );
    if (alreadyApplied.rowCount) continue;

    const sql = await readFile(path.join(migrationsDir, name), "utf8");
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO user_service.schema_migrations (name) VALUES ($1)",
        [name]
      );
      await client.query("COMMIT");
      console.info(`Applied migration ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
