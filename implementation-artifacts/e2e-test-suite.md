# E2E Test Suite — Wave 15b

## Decision — Test Runner

**Chosen:** Vitest (existing `vitest` setup at v4.1.4) + integration-style flows using
Express + `fetch` + `@testing-library/react` with `jsdom`.

**Rejected:** Playwright.

**Why integration-style instead of a real browser:**

- The existing 580-test suite already uses this pattern successfully
  (see `tests/portal-assessment-detail.test.ts`, `tests/alerts-read-state-mutations.test.ts`).
- Spinning up a real browser + a real Postgres for a single PR blows the
  ~2500-LoC budget and forces CI changes we don't need yet.
- The flows under test are state-transition + HTTP-contract heavy, not
  pixel-heavy. Integration-level fakes exercise the same layers: route
  handlers, session middleware, React Query cache, invalidation, sidebar /
  shell wiring, banner dismiss mutations.
- True E2E (Playwright + ephemeral Postgres) is tracked as a follow-up
  so we don't regress this PR trying to land both at once.

## Directory Structure

```
tests/e2e/
  signup-onboarding.test.ts           # Flow A — full
  alerts-lifecycle.test.ts            # Flow B — full
  assessment-lifecycle.test.ts        # Flow C — full
  owner-portal-navigation.client.test.tsx  # Flow D — skeleton (test.skip + TODO)
  amenities-toggle-roundtrip.test.ts  # Flow E — skeleton (test.skip + TODO)
  README.md                           # run instructions + flow matrix
```

`.test.ts` files are picked up by the server config; `.client.test.tsx`
falls into the jsdom bucket. No separate vitest config is needed — the
existing include globs already cover `tests/**/*.test.{ts,tsx}` and
`tests/**/*.client.test.tsx`.

## Run Instructions

```bash
npm run test:e2e        # runs only the e2e slice
npm test                # runs the full 580-test suite + these
```

`package.json` gains:

```json
"test:e2e": "vitest run tests/e2e"
```

## Flow Coverage Matrix

| Flow | Status | Notes |
| ---- | ------ | ----- |
| A. Signup → onboarding banner | full | Drives `/api/public/signup/start` + `/api/public/signup/complete` against a mocked Stripe / mocked `provisionWorkspace`. Asserts response shape + session establishment fallback path. |
| B. Alerts lifecycle | full | Seeds one overdue work order in the alert source layer, asserts count of 1, flips the source to "no overdue" (simulating WO completion), asserts the invalidated query returns 0. |
| C. Assessment lifecycle | full | Manager creates a recurring rule → runs it → run-history shows the entry. Owner portal sees the new recurring-charge schedule via the portal dashboard endpoint. |
| D. Owner portal navigation (all 7 routes + legacy URL) | skeleton | `test.skip` with TODO — needs a more complete PortalShell harness (session query + all 7 zone child fetches). Out of scope here; follow-up workitem filed. |
| E. Amenities toggle round-trip | skeleton | `test.skip` with TODO — needs real association fixture flip + sidebar re-render pass. Follow-up workitem filed. |

## CI Integration Plan (DOCUMENT ONLY — NOT WIRED)

When we're ready to add to CI:

1. Extend the existing `vitest run` step in the repo's test job to also
   execute `npm run test:e2e`. No new infra needed.
2. Add a separate job later for **true** browser-E2E (Playwright) that
   boots a short-lived Postgres container via `docker-compose` and runs
   `drizzle-kit push` before test start.
3. Block merge on the integration-E2E slice; keep the Playwright slice
   advisory until stable.

## Follow-ups Filed

- Workitem: "Wave 16 — true E2E harness (Playwright + ephemeral DB)" —
  covers flows D, E, and a real-browser pass at flows A-C.
- Workitem (deferred if no bugs surface): any bug found while authoring
  flows A-C.

## Anti-goals

- **Not** a refactor of existing tests.
- **Not** a push to Playwright today.
- **Not** a live-Stripe or live-email integration.
