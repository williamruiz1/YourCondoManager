// Wave 17 — Wrapper that starts the ephemeral pglite gateway and then
// launches the YCM dev server with DATABASE_URL pointed at it.
//
// This script is the `webServer.command` for Playwright in real-
// backend mode. We could not put the pglite startup in
// `globalSetup` because Playwright runs the webServer plugin BEFORE
// globalSetup (see node_modules/playwright/lib/runner/tasks.js
// `createGlobalSetupTasks` ordering). Embedding the boot here keeps
// the env handoff inside one process tree.
//
// The script also writes the gateway connection string to
// `.pocketpm/playwright-real-backend.json` (gitignored — see
// `tests/e2e/playwright/helpers/seed-helper.ts` `createRealBackend`)
// so each spec can connect a `pg.Pool` for direct row inserts.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startTestDb } from "../tests/e2e/playwright/helpers/test-db.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const HANDOFF_PATH = path.join(REPO_ROOT, ".playwright-real-backend.json");

async function main() {
  // eslint-disable-next-line no-console
  console.log("[playwright-real-backend] starting pglite + pg-gateway…");
  const handle = await startTestDb();
  // eslint-disable-next-line no-console
  console.log(`[playwright-real-backend] DATABASE_URL=${handle.connectionString}`);

  fs.writeFileSync(
    HANDOFF_PATH,
    JSON.stringify(
      {
        connectionString: handle.connectionString,
        sessionSecret: process.env.SESSION_SECRET ?? "wave17-playwright-test-secret",
      },
      null,
      2,
    ),
    "utf8",
  );

  const cleanup = async () => {
    try {
      fs.unlinkSync(HANDOFF_PATH);
    } catch {
      /* ignore */
    }
    await handle.stop();
  };

  process.on("SIGINT", () => {
    void cleanup().then(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void cleanup().then(() => process.exit(0));
  });

  const dev = spawn("npx", ["tsx", "watch", "server/index.ts"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: handle.connectionString,
      SESSION_SECRET: process.env.SESSION_SECRET ?? "wave17-playwright-test-secret",
      NODE_ENV: "development",
      AUTOMATION_SWEEPS_ENABLED: "0",
    },
  });

  dev.on("exit", async (code, signal) => {
    await cleanup();
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[playwright-real-backend] fatal:", err);
  process.exit(1);
});
