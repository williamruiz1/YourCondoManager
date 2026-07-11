import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// PERF-B-002 (founder-os#10741): node-postgres defaults to max=10 connections
// for the WHOLE process — shared by every HTTP handler AND the 5-min automation
// sweep — so under load or a long sweep, queries queue to the 10s
// connectionTimeout then throw (intermittent 5xx that look random). DATABASE_URL
// points at Neon's `-pooler` (PgBouncer) endpoint, which multiplexes many
// client connections onto the compute's real max_connections, so a modest
// per-process client pool is safe: 20 is within the finding's 15-20 band for a
// pooled setup and leaves the compute headroom. Override via PG_POOL_MAX.
const POOL_MAX = Math.max(1, Number(process.env.PG_POOL_MAX) || 20);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: POOL_MAX,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
