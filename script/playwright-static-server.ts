// Wave 16a — Lightweight static server for Playwright E2E.
//
// The Playwright harness route-mocks every API call, so it does not
// need the real backend (which would require Postgres + SMTP + OAuth).
// This script serves the production build output (`dist/public`) over
// HTTP so Playwright can drive Chromium against the real frontend
// bundle.
//
// Use `npm run build` first to populate `dist/public`. Then either:
//   - `npx tsx script/playwright-static-server.ts` (manual)
//   - `PLAYWRIGHT_STATIC=1 npm run test:playwright` (the playwright
//     config swaps to this server when the env var is set)
//
// On Linux/CI we still recommend `npm run dev` against a real DB —
// this script is the macOS-friendly fallback that the Wave-15b dev-
// server cannot satisfy without a full Postgres install.

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "dist", "public");

if (!fs.existsSync(PUBLIC_DIR)) {
  console.error(
    `[playwright-static-server] ${PUBLIC_DIR} does not exist. Run \`npm run build\` first.`,
  );
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? process.env.PLAYWRIGHT_PORT ?? 5000);

const app = express();

// Serve hashed assets and the built JS/CSS.
app.use(express.static(PUBLIC_DIR, { index: false }));

// Generic /api/* fallback. Playwright tests register their own
// `page.route` handlers that intercept these calls before they leave
// the browser — so this handler is only a safety net for any request
// the test forgot to stub. Returning a JSON empty-array keeps the
// frontend from crashing on an unexpected HTML 404. Express 5 changed
// path-to-regexp; bare `/*` and `/*path` no longer round-trip
// identically across versions, so we use a pathless middleware here.
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  res.status(200).json({ ok: true, stub: true, items: [] });
});

// SPA fallback — serve index.html for any non-asset, non-API path.
// We read the file once and stream it back; sendFile() in Express 5 has
// edge cases with `req.path === "/"` resolution that this side-steps.
const indexHtml = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
app.use((_req, res) => {
  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(indexHtml);
});

app.listen(PORT, () => {
  console.log(`[playwright-static-server] listening on http://localhost:${PORT}`);
});
