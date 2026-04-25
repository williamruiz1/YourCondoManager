# Visual Regression Runbook (Wave 25)

**Last updated:** 2026-04-25
**Owner:** Platform Overhaul · Wave 25 (Automated Quality Gates)
**Spec:** `docs/projects/platform-overhaul/decisions/5.7-automated-quality-gates.md`

---

## What this is

Playwright-native visual regression. We use `expect(page).toHaveScreenshot()`
against PNG baselines committed under
`tests/e2e/playwright/__screenshots__/`. The test runner generates a
fresh screenshot per run and pixel-diffs it against the committed
baseline; tests fail if the diff exceeds `maxDiffPixels: 200`.

**No external services.** The snapshots live in-repo. No Percy, no
Chromatic, no BrowserStack. This is a deliberate Wave-25 constraint
documented in the 5.7 decision.

---

## Surfaces under visual regression

Four surfaces, all in `tests/e2e/playwright/visual-regression.spec.ts`:

| Surface | Path | Snapshot |
|---|---|---|
| Operator Home | `/app` | `home.png` |
| Central Inbox | `/app/communications/inbox` | `inbox.png` |
| Assessment Rules | `/app/financial/rules` | `rules.png` |
| Owner Portal Home | `/portal` | `portal.png` |

Each spec is tagged `@visual` so the dedicated npm scripts grep them
out of the rest of the Playwright suite.

---

## How to run

```bash
# Diff current build against committed baselines.
npm run test:playwright:visual

# After an intentional UI change, regenerate baselines.
npm run test:playwright:visual:update

# Then review the diff and commit the new PNG.
git status -- tests/e2e/playwright/__screenshots__
git add tests/e2e/playwright/__screenshots__
git commit -m "chore(visual): refresh baseline for <surface>"
```

---

## When to update baselines

**Update them when an intentional UI change lands.** Example: a layout
refactor of the operator dashboard, a copy revision in the inbox empty
state, a new column in the rules table.

**Do NOT update them when:**

- A spec started failing and you do not know why. First find out what
  changed visually (the Playwright HTML report attaches the diff PNG).
  If a regression is confirmed, fix the regression rather than masking
  it with a fresh baseline.
- A run produced a tiny diff under `maxDiffPixels: 200` that resolved
  itself on the next run. That is exactly the noise band the threshold
  exists to absorb.
- The screenshot diff is dominated by user-data-dependent state (a
  changing date, a randomly seeded list). Snapshots should only cover
  surfaces that render deterministically against the route-mock
  fixtures used in `helpers/auth-helper.ts` and `helpers/seed-helper.ts`.

---

## How to add a new surface

1. Pick a surface that renders deterministically against route-mock
   fixtures (no server-time, no random ordering, no pulling counts
   from a live backend).
2. Add a `test("<name> @visual", …)` block in
   `tests/e2e/playwright/visual-regression.spec.ts`.
3. Run `npm run test:playwright:visual:update` to generate the
   baseline.
4. Review the generated PNG (open it; do not blind-commit).
5. Commit the new spec block plus the new PNG in the same commit.

---

## Why we are NOT using Percy / Chromatic

- **Cost discipline.** Wave 25's mandate is "no external services
  unless we cannot do it in-house". Playwright's built-in screenshot
  diffing is sufficient for the four-surface scope.
- **Repo-locality.** Baselines committed to the repo flow through
  normal code review. Reviewers can open the PNG diff in the PR
  without leaving GitHub. With Percy you have to follow a link to a
  third-party UI to approve.
- **Determinism.** The same Linux Docker image generates baselines
  and runs the diff. There is no cross-machine font rendering drift
  to debug, because both sides run in the same container.
- **Reversibility.** If we later decide we need cross-browser /
  cross-OS snapshots (Safari, mobile Chrome, dark mode), we can wire
  up Percy at that point without rewriting any of the existing
  specs — the same `@visual` tag will keep working.

---

## CI integration plan (deferred)

Wave 25 deliberately does **not** add a CI workflow file. The user
wires CI separately because the YCM repo's CI surface is already
contested between Replit Deployments, optional GitHub Actions, and
the existing Playwright real-backend job.

When CI is wired up:

1. Add a `playwright-visual` job that runs after the existing
   `playwright` job (they share the dev server boot, so reusing the
   webServer warmup makes sense).
2. The job runs `npm run test:playwright:visual` (no `--update-snapshots`).
3. On failure, upload the Playwright HTML report (it embeds the diff
   PNGs) as an artifact.
4. **Do not** auto-update baselines on CI. Updates are a manual,
   reviewer-acknowledged action via the runbook above.

For axe (the other Wave 25 deliverable):

1. The five existing specs already invoke `runAxeAudit*` at the end
   of each test, so the existing `playwright` job covers them.
2. Add a separate fast `playwright-a11y` job that runs only the
   `a11y-smoke.spec.ts` file (5 surfaces, ~30s) so a11y regressions
   surface independently of the slower flow specs. Command:
   `npx playwright test tests/e2e/playwright/a11y-smoke.spec.ts`.
3. Threshold (locked in 5.7): zero `critical` or `serious`
   violations on any surface; lower-severity findings are reported
   in the trace but do not fail.

---

## Known gotchas

- **Font rendering.** macOS and Linux render fonts slightly
  differently. If a developer runs `:visual:update` on macOS and a
  Linux CI runner re-runs `:visual`, the diff will exceed the
  threshold. Always update baselines on the same OS that CI runs on.
  In practice this means: do the update on Linux (Docker) when CI
  is wired up; until then, all baselines are macOS-generated and
  the spec is intended to run on macOS.
- **Animations.** We pass `animations: "disabled"` to
  `toHaveScreenshot()`. If a future surface uses CSS animations that
  are not pause-able via Playwright's freeze-frame, the snapshot
  will be flaky and that surface should be excluded from visual
  coverage rather than retried.
- **Network-dependent renders.** Snapshots only cover the route-mock
  path. If a surface fetches additional data after `networkidle`,
  the snapshot may capture a half-rendered state. Add an explicit
  `await page.locator(...).waitFor()` for the surface-specific
  loaded indicator before calling `toHaveScreenshot()`.
