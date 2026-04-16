# Handoff: Task 1 — Wire planCatalog as Pricing Source of Truth

**Task ID:** (PPM blocked — `project_id` column missing in executor API; tracked locally)
**Product/Repo:** williamruiz1/YourCondoManager
**Lane:** 3A (clear AC, single-repo, no billing logic changes — wiring only)
**Governing spec:** 4.4 Q3 (RESOLVED, founder-decided 2026-04-16)
**Branch:** `feature/plancatalog-wiring`
**Depends on:** Task 0 (Vitest infrastructure) — MERGED via PR #8

---

## Objective

Wire the existing `planCatalog` database table as the single source of truth for plan definitions and pricing. Replace all hardcoded client-side plan data with API-driven reads from `planCatalog`. Align server-side Stripe price ID resolution with `planCatalog` tier boundaries.

## Context

- **4.4 Q3 decision (RESOLVED):** `planCatalog` at `shared/schema.ts:2795-2818` is the canonical pricing source. The client-side `PLANS` constant at `client/src/pages/plan-signup.tsx:30-87` is stale and must be retired. The self-managed two-tier boundary (under/over 30 units at `server/routes.ts:12706-12712`) must reference `planCatalog.unitMin`/`unitMax` instead of hardcoded `30`.
- **Canonical pricing** (from `docs/strategy/pricing-and-positioning.md`):
  - Self-Managed: Small Community (≤30 units, $89/mo, $79/mo annual), Mid Community (31–75 units, $139/mo, $119/mo annual), Large Community (76–200 units, $199/mo, $169/mo annual)
  - Property Manager: PM Tier 1 (≤30 units/complex, $30/mo/complex, $300/mo min), PM Tier 2 (31–75 units/complex, $50/mo/complex), PM Tier 3 (75+ units, Contact us)
- **Phase 0 billing tables** (`billingAccounts`, `billingSubscriptions`, etc.) exist in schema but are NOT wired by this task. This task wires `planCatalog` only. Phase 0 migration is 4.4 Q4 (PENDING — separate future task).
- **Stripe price IDs** remain in the secrets store — they reference `planCatalog` entries, not standalone definitions. The lookup path changes from hardcoded plan keys to `planCatalog`-derived keys.

## Schema Reference

`planCatalog` table at `shared/schema.ts:2795-2818`:

```
planCatalog {
  id: varchar (PK, UUID)
  planKey: text (unique index)
  accountType: billingAccountTypeEnum ("self_managed" | "property_manager")
  displayName: text
  status: planCatalogStatusEnum ("draft" | "active" | "retired")
  pricingModel: pricingModelEnum ("flat_per_association" | "per_complex" | "enterprise_manual")
  unitMin: integer (nullable)
  unitMax: integer (nullable)
  currency: text (default "USD")
  billingFrequencySupported: jsonb (string[], default ["monthly"])
  monthlyAmountCents: integer (nullable)
  annualEffectiveMonthlyCents: integer (nullable)
  annualBilledAmountCents: integer (nullable)
  recommendedInSignup: integer (default 0)
  version: integer (default 1)
  effectiveFrom: timestamp
  effectiveTo: timestamp (nullable)
  metadata: jsonb (nullable)
  createdAt: timestamp
  updatedAt: timestamp
}
```

## Acceptance Criteria

- [ ] AC-1: **Seed migration script.** A SQL migration seeds `planCatalog` with the canonical plan rows from `docs/strategy/pricing-and-positioning.md`:
  - `self-managed-small` — Small Community, self_managed, flat_per_association, unitMin=1, unitMax=30, $89/mo ($8900 cents), annual $79/mo effective ($7900), annual billed $948/yr ($94800)
  - `self-managed-mid` — Mid Community, self_managed, flat_per_association, unitMin=31, unitMax=75, $139/mo ($13900), annual $119/mo ($11900), annual billed $1428/yr ($142800)
  - `self-managed-large` — Large Community, self_managed, flat_per_association, unitMin=76, unitMax=200, $199/mo ($19900), annual $169/mo ($16900), annual billed $2028/yr ($202800)
  - `pm-tier-1` — PM Tier 1, property_manager, per_complex, unitMin=1, unitMax=30, $30/mo ($3000)
  - `pm-tier-2` — PM Tier 2, property_manager, per_complex, unitMin=31, unitMax=75, $50/mo ($5000)
  - `pm-tier-3` — PM Tier 3 (Enterprise), property_manager, enterprise_manual, unitMin=76, unitMax=null (no upper bound)
  - All rows: status=`active`, version=1, effectiveFrom=now(), effectiveTo=null, recommendedInSignup=1 for self-managed-small
  - Migration must be idempotent (ON CONFLICT DO NOTHING on planKey)

- [ ] AC-2: **Public API endpoint.** `GET /api/public/plans` returns all active `planCatalog` rows (status=`active`, effectiveTo IS NULL or effectiveTo > now()), grouped by `accountType`. Response shape:
  ```json
  {
    "selfManaged": [
      { "planKey": "self-managed-small", "displayName": "Small Community", "unitMin": 1, "unitMax": 30, "monthlyAmountCents": 8900, "annualEffectiveMonthlyCents": 7900, "annualBilledAmountCents": 94800, "billingFrequencySupported": ["monthly", "annual"], "recommendedInSignup": true }
    ],
    "propertyManager": [ ... ],
    "enterprise": { "planKey": "pm-tier-3", "contactRequired": true }
  }
  ```
  No auth required (public route). Rate-limited per existing public route middleware.

- [ ] AC-3: **Client pricing page refactor.** `client/src/pages/plan-signup.tsx`:
  - Remove the hardcoded `PLANS` constant (lines 30-87) and `SELF_MANAGED_TIERS` (lines 84-87).
  - Replace with a `useQuery` call to `GET /api/public/plans`.
  - Render plan cards from the API response. Display names, prices (formatted from cents), features, and tier boundaries come from the API.
  - Loading state: show skeleton cards while the API resolves.
  - Error state: show a graceful fallback ("Unable to load pricing — please try again").
  - The `PRICING STALE` comments are removed as they no longer apply.

- [ ] AC-4: **Client pricing page (`/pricing`) refactor.** If `PricingPage` also hardcodes plan data, refactor it to consume `GET /api/public/plans` as well. Both `/pricing` and `/signup` must render from the same API source.

- [ ] AC-5: **Server signup endpoint alignment.** `server/routes.ts` `/api/public/signup/start`:
  - The Stripe price ID resolution at lines 12706-12712 must query `planCatalog` for the matching plan row (by `planKey` or by `accountType` + unit count within `unitMin`/`unitMax` range) instead of using the hardcoded `30` unit boundary.
  - The Stripe price ID itself still comes from the secrets store (`STRIPE_PLAN_PRICE_IDS`), but the plan key used to look it up is derived from the `planCatalog` match, not hardcoded.
  - If no matching `planCatalog` row exists (or row is not `active`), return 503 with "Plan not available".

- [ ] AC-6: **Feature list in planCatalog.** Plan feature lists (the bullet points shown on plan cards) should be stored in `planCatalog.metadata` as a JSON array under key `"features"`. The seed migration populates features from the current hardcoded `PLANS` constant. The API endpoint returns them. The client renders them.

- [ ] AC-7: **Tests.** Using the Vitest infrastructure from Task 0:
  - A server-side test that verifies `GET /api/public/plans` returns the seeded plan data in the correct shape.
  - A source-scan test that verifies `plan-signup.tsx` does NOT contain any hardcoded price strings (`$30`, `$50`, `$89`, `$139`, `$199`, `$449`, `$450`).
  - A source-scan test that verifies `server/routes.ts` does NOT contain hardcoded unit boundary (`units >= 30` or equivalent) in the signup handler.

- [ ] AC-8: **npm run check** passes. No new TypeScript errors.

- [ ] AC-9: **billingFrequencySupported update.** Update the seed data to include `["monthly", "annual"]` for all self-managed tiers (annual pricing is specified in the canonical doc). PM tiers start with `["monthly"]` only.

## Constraints

- Do NOT wire `signupPlanSelections`, `billingAccounts`, or `billingSubscriptions` — those are 4.4 Q4 scope (separate task).
- Do NOT change Stripe integration patterns (raw `fetch` to `api.stripe.com` stays).
- Do NOT change the trial period, payment method collection, or checkout session creation logic.
- Do NOT modify any route paths or auth middleware.
- Pre-existing TypeScript failures (`IStorage` mismatch, `matchAll` iterator) are known — do not fix them.
- The `planCatalog` table already exists in the schema — do NOT alter the table definition. The seed migration only INSERTs rows.
- Enterprise/PM Tier 3 is a "Contact us" plan — no Stripe price, no self-serve signup. The API should return it with `contactRequired: true` so the client can render appropriately.

## Required Proof

- PR URL with all 9 acceptance criteria verified
- `npm run test` output showing all tests pass (including new tests)
- `npm run check` output showing no new TypeScript errors
- Screenshot or log showing `GET /api/public/plans` returns seeded data

## Scope Boundary

This task wires `planCatalog` as pricing source of truth ONLY. It does NOT:
- Migrate from `platformSubscriptions` to Phase 0 billing tables (that's 4.4 Q4)
- Add upgrade/downgrade paths (that's 4.4 Q6)
- Add an onboarding wizard (that's 4.4 Q2)
- Change the post-checkout session flow (that's 4.4 Q7)
- Update the live pricing page layout/design — only the data source changes
- Add billing interval selection UI (annual vs monthly) — that's a downstream task after the data is wired
