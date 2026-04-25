// Wave 17 — Ephemeral Postgres for Playwright real-backend specs.
//
// Design choice: PGlite (in-process Postgres in WASM) fronted by pg-gateway
// (a Node TCP server that speaks the Postgres wire protocol). The dev
// server connects via the standard `pg.Pool` driver in `server/db.ts`,
// pointed at `DATABASE_URL=postgresql://localhost:<port>/postgres`.
//
// Why this combination:
//   - pglite has no system deps (no Docker, no `brew install postgres`),
//     so a fresh dev Mac runs the suite immediately after `npm ci`.
//   - pg-gateway lets us keep `server/db.ts` 100% unchanged — the dev
//     server has no idea it is talking to a WASM Postgres.
//   - The schema is materialised via `drizzle-kit push --force` against
//     the gateway, so we get the FINAL schema (already-collapsed enums,
//     all columns and indexes) without replaying migration history.
//
// Why not replay `migrations/*.sql` directly: PGlite caches enum
// value-lists per backend in a way that doesn't refresh consistently
// after `ALTER TYPE ... ADD VALUE`. Migrations 0006 (board-admin role
// rename) and 0014 (portal_access role collapse) trip that bug. The
// drizzle-kit-push path side-steps the issue because it generates DDL
// from the canonical schema, not the historical evolution.
//
// Tradeoffs documented in docs/projects/platform-overhaul/implementation-
// artifacts/e2e-test-suite.md (Wave 17 section).
//
// The DB is started once per Playwright run (globalSetup), not per test.
// Tests insert and clear rows but never re-apply schema.

import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { fromNodeSocket } from "pg-gateway/node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

export interface TestDbHandle {
  /** Postgres connection string suitable for `pg.Pool({connectionString})`. */
  connectionString: string;
  /** Underlying pglite instance — for direct seed/clear use in helpers. */
  pglite: PGlite;
  /** Stop the gateway and close pglite. */
  stop: () => Promise<void>;
}

/**
 * Start a TCP gateway in front of pglite. Returns the bound port.
 *
 * Each incoming TCP connection is handed to pg-gateway, which in turn
 * forwards parsed SQL to the shared pglite instance. Authentication is
 * disabled (trust mode) — this gateway is bound to 127.0.0.1 only.
 */
function startGateway(pglite: PGlite): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      void fromNodeSocket(socket, {
        async onStartup() {
          // Trust auth — accept the startup unconditionally so we don't
          // have to manage passwords for an in-memory test DB.
          return;
        },
        async onMessage(data, { isAuthenticated }) {
          if (!isAuthenticated) return;
          return await pglite.execProtocolRaw(data);
        },
      }).catch((err) => {
        // Connection-level errors are not fatal to the gateway — log
        // and let the socket close.
        console.error("[test-db][gateway] connection error:", err);
      });
    });

    server.on("error", (err) => reject(err));
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind gateway"));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose());
          }),
      });
    });
  });
}

/**
 * Materialise the canonical schema via `drizzle-kit push --force`. This
 * generates DDL from `shared/schema.ts` and applies it to the empty
 * pglite instance behind the gateway. The end state matches what an
 * up-to-date production DB would look like AFTER all migrations had
 * run — without us having to replay them, which trips a pglite enum
 * caching bug for migrations 0006 and 0014.
 */
async function applySchema(connectionString: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["drizzle-kit", "push", "--force"], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
      },
      stdio: process.env.PLAYWRIGHT_DB_DEBUG === "1" ? "inherit" : "pipe",
    });
    let stderrBuf = "";
    if (child.stderr) {
      child.stderr.on("data", (d) => {
        stderrBuf += d.toString();
      });
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`drizzle-kit push exited with code ${code}\n${stderrBuf}`));
    });
  });
}

/**
 * Spin up an ephemeral Postgres for the Playwright run. Caller is
 * responsible for calling `stop()` at teardown.
 */
export async function startTestDb(): Promise<TestDbHandle> {
  const pglite = new PGlite();
  await pglite.waitReady;

  const gateway = await startGateway(pglite);
  const connectionString = `postgresql://test:test@127.0.0.1:${gateway.port}/postgres`;

  await applySchema(connectionString);

  return {
    connectionString,
    pglite,
    stop: async () => {
      await gateway.close();
      await pglite.close();
    },
  };
}
