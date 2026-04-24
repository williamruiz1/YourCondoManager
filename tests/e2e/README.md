# E2E Test Suite

Core user-flow integration coverage added in Wave 15b. See
`implementation-artifacts/e2e-test-suite.md` for the decision record
(runner choice, directory layout, CI plan).

## Running

```bash
npm run test:e2e
```

## Flows

| File | Flow | Status |
| --- | --- | --- |
| `signup-onboarding.test.ts` | Signup → onboarding banner dismissal | full |
| `alerts-lifecycle.test.ts` | Alert appears → WO complete → alert cleared | full |
| `assessment-lifecycle.test.ts` | Manager creates rule → runs → history + portal read | full |
| `owner-portal-navigation.client.test.tsx` | 7-zone nav + legacy URL redirect | skeleton (test.skip) |
| `amenities-toggle-roundtrip.test.ts` | Manager flip → owner reflects | skeleton (test.skip) |

Skeletons are marked with `describe.skip(...)` and document the
follow-up plan inline. The Wave-16 workitem tracks converting them
into full coverage (and adding a Playwright harness once the
integration-style slice is stable).

## Conventions

- Integration-style: in-memory fakes + real Express + real `fetch`
  round-trips — no live Postgres / Stripe / email.
- Each file is self-contained: no shared harness, no fixture files
  outside the file.
- Prefer `vi.mock("../../path/to/source", ...)` for module-level stubs
  (see `alerts-lifecycle.test.ts` for the pattern).
