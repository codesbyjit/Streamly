import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool.js";

const migrationPath = fileURLToPath(new URL("../../migrations/001_initial.sql", import.meta.url));

try {
  const sql = await readFile(path.resolve(migrationPath), "utf8");
  await pool.query(sql);
  console.log("Live service migrations applied");
} catch (error) {
  console.error("Live service migration failed", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
