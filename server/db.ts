import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// founder-os#10741 (PERF-B-002): an explicit sized pool max. Unbounded pools
// exhaust Neon's per-plan connection ceiling under load / multi-machine scale-out.
// Per-instance cap, env-tunable against the actual Neon plan ceiling
// (total connections ≈ PG_POOL_MAX × running machines — keep the product under
// the plan limit). Default 10 is a safe single-instance cap that leaves ample
// headroom for a small multi-machine topology.
const PG_POOL_MAX = Math.max(1, Number(process.env.PG_POOL_MAX) || 10);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: PG_POOL_MAX,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
