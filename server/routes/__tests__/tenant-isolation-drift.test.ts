/**
 * Tenant-isolation drift guard (A-AUTHZ-004) — the "CI check that flags a route
 * handler doing db.select/update by id with no association assertion."
 *
 * Root cause of the records-requests / amenities IDORs: extracted per-feature
 * modules under server/routes/*.ts drifted away from the central, fail-closed
 * tenant-isolation guards. This meta-test scans every such module's SOURCE and
 * fails if a module performs a by-id db op but references NO scope guard — so a
 * newly-added module is caught at CI time, one forgotten check before a leak.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROUTES_DIR = path.resolve(__dirname, "..");

/** Any reference to a shared/central tenant-scope guard (the fix's primitive). */
const GUARD_RE =
  /assertAssociationScope|assertAssociationInputScope|assertResourceScope|getAssociationIdQuery|resolveScopedAssociationId|\binScope\b|adminScopedAssociationIds/;

/** A by-id db op: select/update/delete filtered on a `<table>.id` equality. */
const BY_ID_DB_RE = /\b(db\.(select|update|delete|insert)|\.where\()/;
const RAW_ID_WHERE_RE = /\.where\(\s*eq\([a-zA-Z0-9_]+\.id\b/;

/** Modules that legitimately do NOT touch tenant-scoped data (no association). */
const ALLOWLIST = new Set<string>([
  "observability-smoke-test.ts", // admin-gated diagnostic, no tenant data
]);

function routeModules(): string[] {
  return readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .filter((f) => !ALLOWLIST.has(f));
}

describe("A-AUTHZ-004 — every route module doing by-id db ops references a scope guard", () => {
  const modules = routeModules();

  it("scans the whole server/routes/*.ts surface", () => {
    expect(modules.length).toBeGreaterThan(2);
  });

  for (const file of modules) {
    it(`${file} — by-id db op ⟹ a tenant-scope guard is present`, () => {
      const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
      const doesByIdDb = BY_ID_DB_RE.test(src) && RAW_ID_WHERE_RE.test(src);
      if (!doesByIdDb) return; // module has no by-id db op — nothing to gate
      expect(
        GUARD_RE.test(src),
        `${file} performs a by-id db op but references no tenant-scope guard ` +
          `(assertAssociationScope / assertResourceScope / getAssociationIdQuery / inScope). ` +
          `Add the shared guard from server/lib/tenant-scope.`,
      ).toBe(true);
    });
  }

  it("the two remediated modules explicitly import the shared primitive", () => {
    for (const file of ["records-requests.ts", "amenities.ts"]) {
      const src = readFileSync(path.join(ROUTES_DIR, file), "utf8");
      expect(src).toMatch(/from ["']\.\.\/lib\/tenant-scope["']/);
    }
  });
});
