/**
 * Route-inventory SNAPSHOT (founder-os#10758, YCM audit Wave 3 — ARCH-B-001 / CQ-002).
 *
 * The staged monolith decomposition carves domain routers out of the
 * `server/routes.ts` God-file one domain at a time (see the dispatch plan). Every
 * such extraction MUST be MOVE-ONLY — a handler is cut from `routes.ts` and pasted
 * into a `server/routes/<domain>.ts` module, its registration re-wired via
 * `register<Domain>Routes(app, …)`. Behavior — including the exact set of
 * (method, path) the server exposes — must NOT change.
 *
 * This test is the safety net that PROVES it: it statically enumerates every
 * `app.<verb>("/api/…")` registration across BOTH `server/routes.ts` AND every
 * extracted `server/routes/*.ts` router, and compares the sorted union against a
 * committed golden file. Because it reads the UNION, a move-only extraction
 * leaves the inventory byte-identical (the route just moved files) → this test
 * stays green with NO snapshot change, which is exactly the "byte-identical
 * method+path list before/after each extraction" guarantee the audit requires.
 *
 * When a route is DELIBERATELY added/removed (a real behavior change, NOT a
 * refactor), regenerate the golden file so the change is explicit + reviewable:
 *   UPDATE_ROUTE_INVENTORY=1 npx vitest run server/routes/__tests__/route-inventory-snapshot.test.ts
 * The golden diff then shows precisely which routes changed.
 *
 * Static (no DB / no app boot) so it runs anywhere — same approach as the
 * sibling CQ-010 route-inventory-tenant-scope meta-test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SERVER_DIR = join(__dirname, "..", "..");
const ROUTES_DIR = join(SERVER_DIR, "routes");
const ROUTES_TS = join(SERVER_DIR, "routes.ts");
const GOLDEN = join(__dirname, "route-inventory.snapshot.txt");

/** Every `app.<verb>("/api/…")` registration in a source file, as "VERB /api/path". */
function routesInFile(src: string): string[] {
  const re = /app\.(get|post|put|patch|delete)\(\s*"(\/api\/[^"]+)"/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push(`${m[1].toUpperCase()} ${m[2]}`);
  }
  return out;
}

/** The full sorted, de-duplicated (method, path) inventory across routes.ts +
 * every extracted router module (excludes tests + non-router files). */
function collectInventory(): string[] {
  const files: string[] = [ROUTES_TS];
  for (const name of readdirSync(ROUTES_DIR)) {
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      files.push(join(ROUTES_DIR, name));
    }
  }
  const set = new Set<string>();
  for (const f of files) {
    for (const r of routesInFile(readFileSync(f, "utf8"))) set.add(r);
  }
  return [...set].sort();
}

describe("route inventory snapshot — decomposition is move-only (founder-os#10758)", () => {
  const inventory = collectInventory();
  const serialized = inventory.join("\n") + "\n";

  it("enumerates a plausible number of routes (guards against a broken parser)", () => {
    // If this collapses, the parser broke and the snapshot guarantee is vacuous.
    expect(inventory.length).toBeGreaterThan(500);
  });

  it("matches the committed golden inventory (byte-identical method+path union)", () => {
    if (process.env.UPDATE_ROUTE_INVENTORY) {
      writeFileSync(GOLDEN, serialized);
      return; // regeneration mode — always passes; the diff is the review.
    }
    expect(existsSync(GOLDEN), `missing golden file ${GOLDEN} — run UPDATE_ROUTE_INVENTORY=1`).toBe(true);
    const expected = readFileSync(GOLDEN, "utf8");
    // A move-only extraction keeps this byte-identical (the route just changed
    // files); a real add/remove shows up as a golden diff to review.
    expect(serialized).toBe(expected);
  });
});
