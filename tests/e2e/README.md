# E2E Test Suite

Two coexisting harnesses:

1. **Vitest integration-style** (`tests/e2e/*.test.ts`, Wave 15b) — fast,
   in-memory, no browser. The default developer-loop check.
2. **Playwright real-browser** (`tests/e2e/playwright/*.spec.ts`,
   Wave 16a / 17 / 26) — boots the dev server + real Chromium. Default
   mode runs against route-mocked APIs; opt-in real-backend mode
   (`PLAYWRIGHT_REAL_BACKEND=1`, Wave 17 / 26) runs against an
   ephemeral pglite Postgres so the same specs exercise real handlers
   end-to-end.

See `implementation-artifacts/e2e-test-suite.md` for the decision record
(runner choice, directory layout, CI plan).

## Running

```bash
npm run test:e2e               # Vitest integration-style slice
npm run test:playwright        # Playwright real-browser slice (route-mock)
npm run test:playwright:real   # Playwright real-browser slice (ephemeral DB)
npm run test:playwright:install # one-time: install Chromium binary
```

## Flows — Vitest (integration-style)

| File | Flow | Status |
| --- | --- | --- |
| `signup-onboarding.test.ts` | Signup → onboarding banner dismissal | full |
| `alerts-lifecycle.test.ts` | Alert appears → WO complete → alert cleared | full |
| `assessment-lifecycle.test.ts` | Manager creates rule → runs → history + portal read | full |

Wave 26 deleted the two `test.skip` skeletons (`owner-portal-navigation.client.test.tsx`,
`amenities-toggle-roundtrip.test.ts`) — those flows are owned by the
Playwright harness now and no longer need a placeholder Vitest file.

## Flows — Playwright (real browser)

All five specs run in EITHER mode (route-mock by default,
real-backend when `PLAYWRIGHT_REAL_BACKEND=1`). Wave 26 graduated the
remaining four specs onto the real-backend track that Wave 17 opened
for `alerts-lifecycle`.

| File | Flow | Real-backend? |
| --- | --- | --- |
| `playwright/signup-onboarding.spec.ts` | Signup form + Stripe-mocked redirect → real provision rows → gated /app | yes (Stripe still mocked) |
| `playwright/alerts-lifecycle.spec.ts` | Alert seeded → PATCH WO resolved → alert cleared | yes |
| `playwright/assessment-lifecycle.spec.ts` | Rule run via real orchestrator → assessment-run-log row → owner dashboard surfaces it | yes |
| `playwright/owner-portal-navigation.spec.ts` | All seven owner-portal zones + legacy URL redirect | yes |
| `playwright/amenities-toggle-roundtrip.spec.ts` | Manager flip via real PATCH → owner sees disabled → flip back → owner sees enabled | yes |

Helpers live in `tests/e2e/playwright/helpers/`:
- `auth-helper.ts` — `loginAsManager` / `loginAsOwner` / `loginAsGuest`
  install `page.route` handlers for route-mock mode.
- `seed-helper.ts` — TWO helper sets:
  - Route-mock: `createSeedStore` + `installSeedRoutes` wires every
    endpoint each spec needs against an in-memory store.
  - Real-backend: `createRealBackend` returns a handle with
    `installManagerSession`, `installOwnerSession`,
    `seedAssociation`, `seedUnitWithOwner`, `seedRecurringChargeSchedule`,
    `seedAmenity`, `seedPlatformSubscription`, `seedOverdueWorkOrder`,
    plus `reset()` to truncate test-mutable tables between cases.
- `test-db.ts` — boots PGlite (in-process Postgres in WASM) behind a
  pg-gateway TCP listener, runs `drizzle-kit push --force` to
  materialise the schema.

## Conventions

- Integration-style: in-memory fakes + real Express + real `fetch`
  round-trips — no live Postgres / Stripe / email.
- Each Vitest file is self-contained: no shared harness, no fixture
  files outside the file.
- Playwright specs share the helpers above. Each spec uses a
  `test.describe.configure({ mode: "serial" })` block plus
  `beforeEach(reset)` so seeded rows from a prior test cannot bleed in.
- Prefer `vi.mock("../../path/to/source", ...)` for module-level stubs
  in Vitest tests (see `alerts-lifecycle.test.ts` for the pattern).
- In real-backend Playwright specs, do not register `route.fulfill`
  handlers for `/api/*` paths — let the dev server handle them.
  Stripe is the lone exception: `/api/public/signup/start` and
  `/api/public/signup/complete` stay browser-mocked because their
  server-side `stripeRequest` calls would otherwise hit the live
  Stripe API.
