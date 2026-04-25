# i18n — string registry & migration path

> Spec: `docs/projects/platform-overhaul/decisions/5.6-i18n-scaffolding.md`
> Status: SPEC LOCKED 2026-04-25 (Wave 21) · EXTENDED 2026-04-25 (Wave 24, round 2 — +15 surfaces).

## What this is

A minimal, dependency-free string registry for the YCM client. There is no `i18next`, no plural engine, no interpolation engine. Wave 21 established the registry and the `t()` helper across the **top 10 user-facing surfaces**; Wave 24 extended it to 15 more operator surfaces (financial zone, operations, governance, and records). Full translation still lands in a follow-up wave when product commits to a non-English locale.

The point of this module is _extraction discipline_: every visible English literal on the in-scope surfaces lives in `strings.en.ts`, and pages call `t("some.key")`. Once that pattern is in place, swapping in a real translation engine is a mechanical refactor against the registry rather than an audit of every JSX file.

## Files

- **`strings.en.ts`** — flat registry. One `as const` object exporting `strings` + the `StringKey` type alias.
- **`use-strings.ts`** — exports `t(key)` (function form) and `useStrings()` (hook form for future locale-aware reads).
- **`README.md`** — this file.

## How to add a string

1. Open `strings.en.ts`.
2. Choose the key under the right surface prefix (`home.*`, `inbox.*`, `hub.<zone>.*`, `financialRules.*`, `portal.home.*`, `portal.finances.*`, `settings.billing.*`, `common.*`).
3. Add the entry to the `strings` object. Keep keys flat dotted strings — nested objects are out of scope for the lookup helper.
4. Reference the new key from the page via `t("your.new.key")`.

Naming convention:

- Use `<surface>.<context>.<element>` (`home.alerts.title`, `inbox.empty.unread`).
- Use `*.title`, `*.subtitle`, `*.body`, `*.cta` for headings, body copy, and primary buttons.
- Use `*.empty.title` / `*.empty.body` for empty states.
- Use `*.error.title` / `*.error.body` for error states.
- Use `common.*` for verbs/nouns that recur across surfaces (`common.review`, `common.refresh`, `common.signOut`).

If a string only appears on one surface, do _not_ promote it to `common.*` — keep it scoped.

## How to add a locale

When the product commits to a localized release:

1. Add `strings.es.ts` (or whichever locale) exporting an object keyed by the same `StringKey` union as `strings.en.ts`. TypeScript will refuse partial coverage.
2. Update `use-strings.ts` to read the active locale (likely from a `LocaleContext` provider, with the locale picked up from a user preference or `Accept-Language` header). The signature of `t(key)` does not change.
3. Add a fallback chain: if a key is missing from the active locale, fall through to English; if missing from English, return the key itself (current behavior).
4. Once the registry is multi-locale, file a follow-up wave to swap to `i18next` or `formatjs` if interpolation, plural rules, gender, or RTL layout become required. The current API (`t(key) → string`) is intentionally a subset of those libraries' APIs, so the swap is one wrapping layer.

## Why these 10 surfaces first

Wave 21 picked the 10 highest-traffic, persona-spanning surfaces:

1. `dashboard.tsx` — the operator Home (every workspace session lands here).
2. `communications-inbox.tsx` — central alert inbox (every persona consumes alerts).
3. `hubs/financials-hub.tsx`
4. `hubs/operations-hub.tsx`
5. `hubs/governance-hub.tsx`
6. `hubs/communications-hub.tsx` — four zone hubs that are the second click after Home.
7. `financial-rules.tsx` — Assessment Rules, the densest configuration UI.
8. `portal/portal-home.tsx` — owner Home (every portal session lands here).
9. `portal/portal-finances.tsx` — owner finances (the surface that drives billing trust).
10. `settings-billing.tsx` — workspace-level billing entry point.

Together these cover both shells (operator + owner portal), both personas (admin + owner), and the most legally / financially sensitive copy on the platform — the highest-leverage place to lock the registry pattern.

## Backlog of remaining surfaces

Out of scope for Waves 21 + 24; tracked here for the follow-up wave when a real translation engine is introduced. Surfaces struck through have been migrated.

| Tier | Surfaces | Notes |
|---|---|---|
| Tier 1 — high traffic | `portfolio.tsx`, `associations.tsx`, `association-context.tsx`, ~~`documents.tsx`~~ (Wave 24), ~~`persons.tsx`~~ (Wave 24), `board.tsx` | Operator core list views. |
| Tier 1 — owner portal | `portal/portal-requests.tsx`, `portal/portal-community.tsx`, `portal/portal-amenities.tsx`, `portal/portal-documents.tsx`, `portal/portal-notices.tsx` | Remaining six portal zone files. |
| Tier 2 — financial surfaces | ~~`financial-billing.tsx`~~ (Wave 24), ~~`financial-payments.tsx`~~ (Wave 24), ~~`financial-ledger.tsx`~~ (Wave 24), `financial-budgets.tsx`, ~~`financial-delinquency.tsx`~~ (Wave 24), `financial-reports.tsx`, ~~`financial-recurring-charges.tsx`~~ (Wave 24), `financial-assessments.tsx`, ~~`financial-late-fees.tsx`~~ (Wave 24), `financial-utilities.tsx`, ~~`financial-foundation.tsx`~~ (Wave 24), `financial-invoices.tsx`, `financial-reconciliation.tsx`, `financial-expenses.tsx` | Long tail; many are sub-pages already nested under `financial-rules.tsx`. |
| Tier 2 — governance + ops | ~~`meetings.tsx`~~ (Wave 24), ~~`elections.tsx`~~ (Wave 24), `election-detail.tsx`, `election-ballot.tsx`, `governance.tsx`, `governance-compliance.tsx`, `inspections.tsx`, `insurance.tsx`, `maintenance-schedules.tsx`, `amenities-admin.tsx`, `board-portal.tsx`, `board-packages.tsx`, ~~`announcements.tsx`~~ (Wave 24), `community-hub.tsx`, `community-hub-public.tsx`, `ai-ingestion.tsx`, ~~`work-orders.tsx`~~ (Wave 24), ~~`vendors.tsx`~~ (Wave 24), ~~`units.tsx`~~ (Wave 24) | One per surface; mechanical extraction. |
| Tier 3 — settings & admin | `admin-users.tsx`, `new-association.tsx`, `executive.tsx`, `help-center.tsx`, `not-found.tsx`, `landing.tsx`, `onboarding-invite.tsx`, `plan-signup-success.tsx` | Lower-traffic; safe to defer until the locale switcher ships. |
| Components | `home-alerts-panel.tsx`, `hub-alert-widget.tsx`, `setup-wizard.tsx`, `signup-onboarding-checklist.tsx`, `breadcrumb-nav.tsx`, `workspace-page-header.tsx`, `association-scope-banner.tsx` | Shared — extract once, used everywhere. |

When opening the follow-up wave, do not extract everything in one PR. Take Tier 1 first, ship, validate, then move to the rest. Wave 24 covered the bulk of the financial sub-pages and the highest-traffic operator list views; the next round should pick up the remaining portal surfaces and the `_detail` / `_ballot` sub-pages.

## Conventions

- **Don't translate dynamic strings inline.** A status string built by `${status.charAt(0).toUpperCase() + status.slice(1)}` should be replaced with a `t()` lookup keyed by the status enum value (Wave 21 has done this for billing status / plan labels — see `settings.billing.status.*` / `settings.billing.plan.*`).
- **Don't translate test IDs, query keys, or route paths.** `data-testid` attributes are infrastructure, not user copy.
- **Don't promote a string to `common.*` for a single use site.** Wait until at least two surfaces share the literal.
- **Keep the registry single-file per locale.** Splitting `strings.en.ts` into per-surface files defeats the lookup-table model and increases churn during translation.
