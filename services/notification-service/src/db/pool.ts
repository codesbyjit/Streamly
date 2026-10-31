import pg from "pg";
import { env } from "../config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  ssl: env.databaseSsl ? { rejectUnauthorized: env.NODE_ENV === "production" } : undefined,
  application_name: "streamly-notification-service"
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});
