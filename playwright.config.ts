// Wave 16a — Playwright E2E harness configuration.
//
// Coexists with the Wave 15b Vitest-based integration-style E2E suite
// under `tests/e2e/*.test.ts`. Playwright lives in `tests/e2e/playwright/`
// so the two harnesses do not collide.
//
// Wave 17 added a real-backend mode: when `PLAYWRIGHT_REAL_BACKEND=1`
// is set, we swap the `webServer.command` to a wrapper that boots an
// ephemeral pglite (in-process Postgres in WASM) behind a pg-gateway
// TCP listener and then starts the dev server with DATABASE_URL
// pointed at it. The wrapper writes the connection string to
// `.playwright-real-backend.json` so individual specs can attach a
// `pg.Pool` for direct row seeding.
//
// Server selection:
//   - PLAYWRIGHT_REAL_BACKEND=1                → wrapper script (real backend)
//   - else PLAYWRIGHT_STATIC=1 / Darwin (macOS) → static-server fallback
//   - Linux + DATABASE_URL set                  → `npm run dev` against caller-provided DB

import { execFileSync } from "node:child_process";

import { defineConfig, devices } from "@playwright/test";

// Ask the OS for a guaranteed-free ephemeral port, synchronously (config load is
// sync). A short node subprocess binds port 0, reads the OS-assigned port, and
// releases it. Falls back to 5000 on any failure.
function freePortSync(): number {
  try {
    const out = execFileSync(
      process.execPath,
      [
        "-e",
        "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close(()=>process.exit(0))})",
      ],
      { encoding: "utf8", timeout: 5000 },
    ).trim();
    const p = Number(out);
    if (Number.isInteger(p) && p > 0) return p;
  } catch {
    /* fall through to the default */
  }
  return 5000;
}

// Port selection (founder-os#8320 / #8337 root-cause fix):
//   - PLAYWRIGHT_PORT explicitly set → honor it (deterministic override).
//   - CI → a GUARANTEED-FREE ephemeral port, chosen fresh at config load.
//         The self-hosted macOS runner cannot guarantee a fixed port is free:
//         a webServer orphaned by a `cancel-in-progress` run survives and holds
//         port 5000, so every run (even docs-only) died with
//         "http://localhost:5000 is already used" BEFORE any test. Each
//         `npx playwright test` invocation is a fresh process that loads this
//         config and self-selects its own free port → a stale server on any
//         fixed port can never collide, cross-run OR between the sequential
//         route-mock/real-backend/visual steps. This is the structural fix; the
//         ci.yml port-free step is now only belt-and-suspenders.
//   - local → 5000 (+ reuseExistingServer below) for dev familiarity.
const PORT = process.env.PLAYWRIGHT_PORT
  ? Number(process.env.PLAYWRIGHT_PORT)
  : process.env.CI
    ? freePortSync()
    : 5000;
const BASE_URL = `http://localhost:${PORT}`;

const useRealBackend = process.env.PLAYWRIGHT_REAL_BACKEND === "1";
// Only fall back to the static server when we are NOT in real-backend
// mode. The Wave 17 macOS reusePort fix in server/index.ts means the
// real backend now boots cleanly on Darwin too — but we keep the
// static-server path as the default so existing CI flows that don't
// opt in stay unchanged.
const useStaticServer =
  !useRealBackend &&
  (process.env.PLAYWRIGHT_STATIC === "1" || process.platform === "darwin");

const webServerCommand = useRealBackend
  ? "tsx script/playwright-real-backend.ts"
  : useStaticServer
    ? "npm run build && tsx script/playwright-static-server.ts"
    : "npm run dev";

export default defineConfig({
  testDir: "tests/e2e/playwright",
  testMatch: /.*\.spec\.ts$/,
  // Each spec is independent; tests within a spec run sequentially so
  // route-mock state does not leak across cases.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Retry once on CI to absorb dev-server cold-start jitter; locally
  // we want fast deterministic runs.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Wave 25 — Visual regression baselines live under a single
  // `__screenshots__/` directory rather than the per-spec
  // `<spec>-snapshots/` Playwright default. Co-locating them keeps the
  // git story simple (one folder to grep, one folder to update).
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}{-projectName}{-platform}{ext}",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // The dev server uses cookie name `sid` in production and `sid_dev`
    // in development; the Wave-17 seed helper attaches whichever the
    // running dev server expects.
    storageState: undefined,
  },
  // Wave 45 — Cross-browser projects.
  // Chromium runs the full suite (including @visual baselines).
  // Firefox + WebKit run the non-visual suite — visual baselines are
  // stored as a single platform/browser combination (per Wave 25); to
  // add per-browser snapshots we'd need 3× the baselines, so the
  // visual-regression spec is excluded from Firefox + WebKit via
  // testIgnore. The non-visual specs are engine-agnostic and exercise
  // CSS rendering / Web API differences that catch real bugs.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      // visual-regression — chromium-only baselines (see comment above).
      testIgnore: [
        /visual-regression\.spec\.ts/,
      ],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      // See firefox project for rationale on each ignore.
      testIgnore: [
        /visual-regression\.spec\.ts/,
      ],
    },
  ],
  webServer: {
    command: webServerCommand,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { PORT: String(PORT) },
  },
});
