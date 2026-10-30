import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const db = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: "streamly-auth-service",
  ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined
});

db.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export async function checkDatabase(): Promise<void> {
  await db.query("SELECT 1");
}
