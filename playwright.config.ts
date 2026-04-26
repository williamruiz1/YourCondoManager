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

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5000);
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
