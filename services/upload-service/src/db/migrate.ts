import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const here = dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  const sql = await readFile(resolve(here, "migrations/001_upload_sessions.sql"), "utf8");
  await pool.query(sql);
}
