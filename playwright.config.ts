// Wave 16a — Playwright E2E harness configuration.
//
// Coexists with the Wave 15b Vitest-based integration-style E2E suite
// under `tests/e2e/*.test.ts`. Playwright lives in `tests/e2e/playwright/`
// so the two harnesses do not collide.
//
// The dev server boots via `npm run dev` (port 5000 — see script/dev.ts).
// Playwright will reuse an already-running dev server when present;
// otherwise it spawns one and tears it down at the end of the run.
//
// CI plan: see implementation-artifacts/e2e-test-suite.md (Wave 16a
// section). This file does not register any GitHub Actions / workflow
// configuration — the user wires CI separately.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5000);
const BASE_URL = `http://localhost:${PORT}`;

// Server selection:
//   - CI / Linux with Postgres available  → `npm run dev` (real backend)
//   - macOS / no Postgres / PLAYWRIGHT_STATIC=1 → static-server fallback
//     (frontend only; tests route-mock the API surface, so this is
//     functionally equivalent for the assertions in this slice).
//
// `npm run dev` on macOS hits two compat issues today:
//   1. `reusePort: true` in server/index.ts → ENOTSUP on Darwin
//   2. seed step requires a live Postgres (no Docker assumption)
//
// The static-server path side-steps both while still serving the real
// production-built React bundle through Chromium. CI should drop the
// PLAYWRIGHT_STATIC flag once it provisions Postgres.
const useStaticServer =
  process.env.PLAYWRIGHT_STATIC === "1" || process.platform === "darwin";

const webServerCommand = useStaticServer
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
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // The dev server uses cookie name `sid`; allow Playwright to round-
    // trip cookies for the few specs that exercise real session paths.
    storageState: undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
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
