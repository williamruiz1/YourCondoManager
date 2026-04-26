/**
 * Source-scan tests for the Wave 39 follow-up endpoint
 * `POST /api/admin/associations/start-checkout`.
 *
 * Locks invariants in the production handler at server/routes.ts that
 * the in-process reproduction in
 * `admin-associations-start-checkout.test.ts` cannot easily assert
 * (the production handler imports the full storage / Drizzle stack).
 *
 * Companion to `tests/signup-trial-duration.test.ts` — same approach.
 *
 * Specifically:
 *   - the endpoint is mounted with requireAdmin
 *   - role gate is exactly ["manager", "board-officer"] (NOT
 *     viewer / pm-assistant / assisted-board)
 *   - 21-day trial + payment_method_collection=if_required match Wave 39
 *   - the handler does NOT call `db.insert(adminUsers)` — preserves the
 *     "no new adminUser rows" constraint
 *   - the unique-index error surface produces 409 SUBSCRIPTION_EXISTS
 *   - the public /api/public/signup/start handler is unchanged in shape
 *     (still returns 409 on email collision for anonymous callers).
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";

const routesSource = fs.readFileSync("server/routes.ts", "utf8");

function handlerRegion(anchor: string, before = 0, after = 4000): string {
  const idx = routesSource.indexOf(anchor);
  if (idx < 0) return "";
  return routesSource.substring(Math.max(0, idx - before), idx + after);
}

describe("POST /api/admin/associations/start-checkout — source-scan invariants", () => {
  const anchor = '"/api/admin/associations/start-checkout"';
  // before=800 captures the `startCheckoutSchema = z.object({...})` block
  // that lives directly above the app.post(...) mount; after=12000 covers
  // the whole handler body up through the closing `);`.
  const handler = handlerRegion(anchor, 800, 12000);

  it("is mounted as POST", () => {
    // Multi-line app.post(\n    "/api/admin/associations/start-checkout"
    expect(routesSource).toMatch(
      /app\.post\(\s*"\/api\/admin\/associations\/start-checkout"/,
    );
  });

  it("applies requireAdmin", () => {
    expect(handler).toContain("requireAdmin");
  });

  it("role gate is exactly manager + board-officer (no viewer / pm-assistant / assisted-board / platform-admin)", () => {
    const match = handler.match(/requireAdminRole\(\[([^\]]+)\]\)/);
    expect(match).not.toBeNull();
    const roles = match![1];
    expect(roles).toContain('"manager"');
    expect(roles).toContain('"board-officer"');
    expect(roles).not.toContain('"assisted-board"');
    expect(roles).not.toContain('"pm-assistant"');
    expect(roles).not.toContain('"viewer"');
    expect(roles).not.toContain('"platform-admin"');
  });

  it("uses 21-day trial (Wave 39 founder-ratified default) and if_required collection", () => {
    expect(handler).toContain('"subscription_data[trial_period_days]": "21"');
    expect(handler).toContain('payment_method_collection: "if_required"');
  });

  it("zod schema locks plan to literal 'self-managed'", () => {
    expect(handler).toContain('z.literal("self-managed")');
  });

  it("does not insert into adminUsers (preserves 'no new admin user rows' constraint)", () => {
    // The handler's slice ends at the next `app.` mount or the start of
    // the webhook block. We grep within the handler body only.
    const handlerEnd = handler.indexOf("// POST /api/webhooks/platform/stripe");
    const handlerBody = handlerEnd >= 0 ? handler.slice(0, handlerEnd) : handler;
    expect(handlerBody).not.toMatch(/db\.insert\(\s*adminUsers/);
  });

  it("surfaces unique-index violations as 409 SUBSCRIPTION_EXISTS", () => {
    expect(handler).toContain("SUBSCRIPTION_EXISTS");
    expect(handler).toContain("platform_subscriptions_association_uq");
  });

  it("uses storage.upsertAdminAssociationScope (not raw DB write)", () => {
    expect(handler).toContain("storage.upsertAdminAssociationScope");
  });

  it("idempotency window is 1 hour", () => {
    expect(handler).toContain("60 * 60 * 1000");
  });
});

describe("Public /api/public/signup/start — unchanged in shape (no regression)", () => {
  it("still rejects email collisions with 409 (anonymous flow gate)", () => {
    const handler = handlerRegion('"/api/public/signup/start"', 0, 4500);
    expect(handler).toContain("An account with this email already exists.");
    // Locks the underlying check so reordering doesn't accidentally remove it.
    expect(handler).toMatch(/existingUser/);
  });

  it("still uses the 21-day trial (no regression from Wave 39)", () => {
    const handler = handlerRegion('"/api/public/signup/start"', 0, 4500);
    expect(handler).toContain('"subscription_data[trial_period_days]": "21"');
  });
});
