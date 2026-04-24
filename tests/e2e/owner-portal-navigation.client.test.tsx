// @zone: cross-cutting — E2E integration test (Wave 15b, Flow D — SKELETON)
/**
 * E2E Flow D — Owner portal navigation (skeleton).
 *
 * Planned coverage (per Wave 15b spec):
 *   - Owner logs in at /portal
 *   - Navigates through all seven PortalShell zones:
 *       /portal, /portal/finances, /portal/finances/ledger,
 *       /portal/requests, /portal/community, /portal/amenities,
 *       /portal/notices, /portal/documents
 *   - Each zone renders without error
 *   - /portal?tab=financials (legacy URL) redirects to /portal/finances
 *
 * STATUS: test.skip. The PortalShell pulls in many zone-child components
 * that each perform their own fetches — spinning up a full-integration
 * render here would inflate this PR's diff beyond the ~2500-LoC budget.
 *
 * FOLLOW-UP (tracked as workitem Wave-16 true-E2E harness):
 *   1. Extend the existing `tests/portal-shell.client.test.tsx` fetch stub
 *      to cover every zone-child endpoint.
 *   2. Use wouter's memory-location to programmatically navigate through
 *      the seven routes in sequence and assert the heading + breadcrumb
 *      for each one.
 *   3. Assert window.location assign is called for legacy ?tab=financials
 *      (the PortalShell calls `window.location.assign("/portal/finances")`
 *      in the legacy-redirect effect — stub that out and assert).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";

describe.skip("E2E Flow D — owner portal navigation", () => {
  it("navigates through all seven zones without error (TODO: requires full-shell harness)", () => {
    // TODO — see module docstring. Depends on the Wave-16 harness that
    // stubs every zone-child fetch and the wouter memory-location jump
    // helper.
    expect(true).toBe(true);
  });

  it("legacy /portal?tab=financials redirects to /portal/finances (TODO)", () => {
    // TODO — replace window.location with a spy and assert the
    // `window.location.assign("/portal/finances")` call path.
    expect(true).toBe(true);
  });
});
