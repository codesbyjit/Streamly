import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  application_name: "streamly-streaming-service"
});

pool.on("error", (error) => {
  console.error("Unexpected idle PostgreSQL client error", error);
});
