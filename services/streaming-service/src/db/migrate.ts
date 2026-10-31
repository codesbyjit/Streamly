import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const migrationsDir = path.resolve(currentDir, "../../migrations");

type MigrationColumn = "name" | "filename" | "migration" | "version";

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create the tracking table only when it does not already exist.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Detect the existing migration tracking schema.
    const { rows: columns } = await client.query<{
      column_name: string;
    }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'schema_migrations';
    `);

    const columnNames = new Set(
      columns.map((column) => column.column_name),
    );

    const migrationColumn: MigrationColumn | undefined = [
      "name",
      "filename",
      "migration",
      "version",
    ].find((column) => columnNames.has(column)) as
      | MigrationColumn
      | undefined;

    if (!migrationColumn) {
      throw new Error(
        "Unsupported schema_migrations schema. Existing columns: " +
          [...columnNames].join(", "),
      );
    }

    // Serialize concurrent migration attempts.
    await client.query("SELECT pg_advisory_lock($1)", [724103]);

    try {
      const files = (await readdir(migrationsDir))
        .filter((file) => /^\d+.*\.sql$/.test(file))
        .sort((a, b) => a.localeCompare(b));

      if (files.length === 0) {
        console.log(`No SQL migrations found in ${migrationsDir}`);
        return;
      }

      console.log(`Found ${files.length} migration(s).`);

      for (const file of files) {
        // The existing version column may store a number or migration name.
        const version = file.match(/^(\d+)/)?.[1];

        if (!version) {
          console.warn(`Skipping migration without a version: ${file}`);
          continue;
        }

        const lookupValue =
          migrationColumn === "version" ? Number(version) : file;

        const { rows: appliedRows } = await client.query(
          `SELECT "${migrationColumn}"
           FROM schema_migrations
           WHERE "${migrationColumn}" = $1
           LIMIT 1`,
          [lookupValue],
        );

        if (appliedRows.length > 0) {
          console.log(`Skipping already applied migration: ${file}`);
          continue;
        }

        const sql = await readFile(
          path.join(migrationsDir, file),
          "utf8",
        );

        if (!sql.trim()) {
          console.log(`Skipping empty migration: ${file}`);
          continue;
        }

        console.log(`Applying migration: ${file}`);

        await client.query("BEGIN");

        try {
          await client.query(sql);

          if (migrationColumn === "version") {
            await client.query(
              `INSERT INTO schema_migrations ("version")
               VALUES ($1)`,
              [Number(version)],
            );
          } else {
            await client.query(
              `INSERT INTO schema_migrations ("${migrationColumn}")
               VALUES ($1)`,
              [file],
            );
          }

          await client.query("COMMIT");
          console.log(`Applied migration: ${file}`);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }

      console.log("Database migrations completed successfully.");
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [724103]);
    }
  } finally {
    client.release();
  }
}

migrate()
  .catch((error: unknown) => {
    console.error("Database migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });