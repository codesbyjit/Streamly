import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: "streamly-upload-service"
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});
