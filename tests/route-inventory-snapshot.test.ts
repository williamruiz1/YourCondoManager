/**
 * Route-inventory snapshot — the move-only-refactor safety net for the God-file
 * decomposition of `server/routes.ts` (ARCH-B-001 / CQ-002, founder-os#10758).
 *
 * WHAT IT GUARDS: the complete (HTTP method + path) surface registered via
 * `app.<method>("<path>", ...)` across `server/routes.ts` AND every extracted
 * `server/routes/*.ts` module. The decomposition MOVES a registration from
 * routes.ts into a per-domain `routes/<domain>.ts` module (the existing
 * `registerXRoutes(app)` pattern). A pure move leaves the UNION of registrations
 * unchanged, so this sorted snapshot stays byte-identical before/after each
 * extraction PR.
 *
 * A failing snapshot means the route surface CHANGED — a route was added,
 * dropped, or its method/path was altered — i.e. the "refactor" was NOT
 * behavior-preserving. That is exactly the accidental-behavior-change this guard
 * exists to catch (money-safety: routes.ts carries Cherry Hill's live payment /
 * ledger / webhook handlers).
 *
 * To intentionally change the route surface (a real feature, not a refactor):
 * update the surface in its own non-refactor PR and run `vitest -u` to re-record
 * the baseline in that same PR — never fold a surface change into an extraction.
 *
 * The scan is STATIC (no server boot, no DB) so it is deterministic and safe to
 * run in any environment. Dynamically-built paths (a non-string-literal first
 * argument) are intentionally out of scope — they are captured consistently
 * (i.e. skipped) on both sides of a move, so the guard still holds.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Repo root = the parent of this test file's `tests/` directory.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = path.join(ROOT, "server");

/**
 * Every source file that registers routes onto the shared `app`: the routes.ts
 * God-file plus each extracted `server/routes/*.ts` module. `__tests__/` and
 * `*.test.ts` are excluded. Sorted for determinism.
 */
function routeSourceFiles(): string[] {
  const files = [path.join(SERVER, "routes.ts")];
  const routesDir = path.join(SERVER, "routes");
  for (const entry of readdirSync(routesDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue; // skips the __tests__ directory
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts")) continue;
    files.push(path.join(routesDir, entry.name));
  }
  return files.sort();
}

/**
 * Extract every `METHOD /path` registered via `app.<method>("<path>"` in one
 * source file. The `s` (dot-all) flag lets the path literal sit on the SAME line
 * as `app.<method>(` OR a following line — both styles exist in this codebase.
 * The path must be a `'…'` or `"…"` string literal.
 */
function extractRoutes(src: string): string[] {
  const re = /\bapp\.(get|post|put|patch|delete)\(\s*(['"])([^'"]+)\2/gs;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out.push(`${m[1].toUpperCase()} ${m[3]}`);
  }
  return out;
}

describe("route-inventory snapshot (God-file decomposition move-only guard)", () => {
  it("the full (method + path) route surface matches the recorded baseline", () => {
    const inventory = routeSourceFiles()
      .flatMap((file) => extractRoutes(readFileSync(file, "utf8")))
      .sort();
    // Sanity floor: the surface is large; a near-empty scan means the scanner
    // (not the routes) broke — fail loudly rather than snapshot an empty list.
    expect(inventory.length).toBeGreaterThan(400);
    expect(inventory).toMatchSnapshot();
  });
});
