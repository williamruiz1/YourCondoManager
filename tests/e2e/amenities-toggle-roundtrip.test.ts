// @zone: cross-cutting — E2E integration test (Wave 15b, Flow E — SKELETON)
/**
 * E2E Flow E — Amenities toggle round-trip (skeleton).
 *
 * Planned coverage (per Wave 15b spec):
 *   - Manager PATCHes /api/associations/:id/settings/amenities → enabled=false
 *   - Owner visits /portal/amenities → 404
 *   - Owner sidebar (PortalShell nav) hides the Amenities entry
 *   - Manager flips back to enabled=true
 *   - Owner refresh → entry returns + route renders
 *
 * STATUS: test.skip. Today's tests already cover pieces:
 *   - tests/amenities-toggle-route.client.test.tsx
 *   - tests/amenities-toggle-sidebar.client.test.tsx
 *   - tests/amenities-toggle-auth.test.ts
 *
 * The missing piece is the full round-trip — manager flips the flag,
 * then the owner's view reflects it (currently each test stubs the
 * flag state instead of round-tripping through the PATCH handler).
 *
 * FOLLOW-UP (tracked as workitem Wave-16 true-E2E harness):
 *   1. Reuse the pattern in this file's signup-onboarding sibling —
 *      in-memory store for associations.amenitiesEnabled.
 *   2. Wire the PATCH handler + GET /api/portal/amenities/settings
 *      against the same store so a flip is observable.
 *   3. Drive the React sidebar component in jsdom with a QueryClient
 *      seeded by a `fetch` spy that reads from the harness.
 *   4. Assert the nav entry disappears after invalidation.
 */

import { describe, it, expect } from "vitest";

describe.skip("E2E Flow E — amenities toggle round-trip", () => {
  it("manager disables → owner /portal/amenities returns 404 (TODO)", () => {
    // TODO — see docstring. Depends on a shared amenitiesEnabled store
    // that both the admin PATCH and the portal GET read from.
    expect(true).toBe(true);
  });

  it("manager re-enables → owner sidebar re-shows the entry (TODO)", () => {
    // TODO — requires a full AppSidebar render + query invalidation
    // round-trip. Today's tests stub the flag state directly.
    expect(true).toBe(true);
  });
});
