import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// PERF-B-002 (founder-os#10741): node-postgres defaults `max` to 10 when
// unset, so the ENTIRE process — every HTTP request handler AND the periodic
// automation sweep — shared a 10-connection ceiling. Under `fly.toml`
// hard_limit=250 concurrent requests plus a heavy sweep, queries queued to the
// 10s connectionTimeout then threw, surfacing as intermittent 5xx that looked
// random. We now set `max` EXPLICITLY.
//
// The value MUST be sized against the Neon plan's `max_connections`, not
// maximized blindly (Neon imposes its own ceiling; the pooled `-pooler` host
// fronts far more). 15 is a conservative, safe default that reserves headroom
// under every Neon plan (even the direct-endpoint limit is well above this, and
// the pooler endpoint supports thousands). Tune via `DB_POOL_MAX` once the
// live Neon ceiling for the plan is confirmed. A separate small pool dedicated
// to the background sweep (so it can't starve request handlers) is a follow-on.
const POOL_MAX = Math.max(1, Number(process.env.DB_POOL_MAX || 15));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: POOL_MAX,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
