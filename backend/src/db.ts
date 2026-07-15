import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scans (
      id SERIAL PRIMARY KEY,
      workflow TEXT NOT NULL,
      reference TEXT,
      barcode TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
