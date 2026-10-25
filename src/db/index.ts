import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const globalDb = globalThis as typeof globalThis & { __aurumPool?: Pool };
export const pool = globalDb.__aurumPool ?? new Pool({
  connectionString: url,
  max: Number(process.env.DB_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: `aurum-acquisition-${process.env.APP_ENV ?? "development"}`,
});
if (process.env.NODE_ENV !== "production") globalDb.__aurumPool = pool;
export const db = drizzle(pool, { schema });
