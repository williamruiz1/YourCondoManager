# E2E Test Suite

Two coexisting harnesses:

1. **Vitest integration-style** (`tests/e2e/*.test.ts`, Wave 15b) — fast,
   in-memory, no browser. The default developer-loop check.
2. **Playwright real-browser** (`tests/e2e/playwright/*.spec.ts`,
   Wave 16a) — boots the dev server + real Chromium with route-mocked
   APIs. Provides browser-level coverage for the same five flows.

See `implementation-artifacts/e2e-test-suite.md` for the decision record
(runner choice, directory layout, CI plan).

## Running

```bash
npm run test:e2e               # Vitest integration-style slice
npm run test:playwright        # Playwright real-browser slice
npm run test:playwright:install # one-time: install Chromium binary
```

## Flows — Vitest (integration-style)

| File | Flow | Status |
| --- | --- | --- |
| `signup-onboarding.test.ts` | Signup → onboarding banner dismissal | full |
| `alerts-lifecycle.test.ts` | Alert appears → WO complete → alert cleared | full |
| `assessment-lifecycle.test.ts` | Manager creates rule → runs → history + portal read | full |
| `owner-portal-navigation.client.test.tsx` | 7-zone nav + legacy URL redirect | skeleton (test.skip) |
| `amenities-toggle-roundtrip.test.ts` | Manager flip → owner reflects | skeleton (test.skip) |

The two skeletons remain in place for backward compatibility — the
Wave-16a Playwright harness is the canonical owner of those flows now.

## Flows — Playwright (real browser)

| File | Flow |
| --- | --- |
| `playwright/signup-onboarding.spec.ts` | Signup form + Stripe-mocked redirect → success page → gated /app |
| `playwright/alerts-lifecycle.spec.ts` | Alert seeded → PATCH WO resolved → alert cleared |
| `playwright/assessment-lifecycle.spec.ts` | Rule created → run → run-history → owner portal ledger |
| `playwright/owner-portal-navigation.spec.ts` | All seven owner-portal zones + legacy URL redirect |
| `playwright/amenities-toggle-roundtrip.spec.ts` | Manager flip → owner sees disabled → flip back → owner sees enabled |

Helpers live in `tests/e2e/playwright/helpers/`:
- `auth-helper.ts` — `loginAsManager` / `loginAsOwner` / `loginAsGuest`
- `seed-helper.ts` — in-memory store + `installSeedRoutes` for the
  full set of fixture-driven endpoints

## Conventions

- Integration-style: in-memory fakes + real Express + real `fetch`
  round-trips — no live Postgres / Stripe / email.
- Each file is self-contained: no shared harness, no fixture files
  outside the file.
- Prefer `vi.mock("../../path/to/source", ...)` for module-level stubs
  (see `alerts-lifecycle.test.ts` for the pattern).
