import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool.js";

const migrationPath = fileURLToPath(new URL("../../migrations/001_initial.sql", import.meta.url));

try {
  const sql = await readFile(migrationPath, "utf8");
  await pool.query(sql);
  console.log("Recommendation service migrations completed");
} catch (error) {
  console.error("Recommendation service migration failed", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}