## Audit finding — auto-billing scheduler runs in prod but no recurring schedules exist anywhere

**Audit:** YCM HOA-billing pipeline audit, Pass A (2026-05-25)

**Production evidence:**
- `flyctl status -a yourcondomanager` shows 1 started machine.
- Automation sweep runs every 5 min: log line `automation sweep complete :: ... assessment dispatched=0 success=0 failed=0 skipped=0` (server/index.ts:215-265 `runAutomationSweep` → `runUnifiedAssessmentSweep` from server/assessment-execution.ts:565).
- DB state queried via `flyctl ssh console`:
  - `SELECT count(*) FROM recurring_charge_schedules` → **0**
  - `SELECT count(*) FROM recurring_charge_runs` → **0**
  - `SELECT count(*) FROM hoa_fee_schedules` → **0**
  - Cherry Hill (`f301d073-ed84-4d73-84ce-3ef28af66f7a`) has 21 owner_ledger_entries but ZERO recurring schedules.

**What's wired:**
- Scheduler: `server/index.ts:293-321` `startAutomationJobs` (interval 300s, env-gated `AUTOMATION_SWEEPS_ENABLED`).
- Handler: `server/assessment-execution.ts:251-285` `recurringChargesHandler` — derives ledger payload, requires active ownership.
- Lister: `server/assessment-execution.ts:182-245` `recurringChargesLister` — selects active schedules with `nextRunDate IS NULL OR <= now`, expands per-unit if `unitId` is null.
- Admin CRUD: `server/routes.ts:4420-4524` (GET/POST/PATCH `/api/financial/recurring-charges/schedules`, retry endpoint for runs).
- Admin UI: `client/src/pages/financial-recurring-charges.tsx` (queries + mutations to those endpoints).

**The gap:**
The plumbing works. The data is missing. Cherry Hill (the only paying property) has no recurring schedule rows, so the scheduler legitimately has nothing to fire. There is no onboarding step or seed path that auto-creates a "Monthly HOA dues for $X / unit" schedule when an HOA goes live.

**Recommended dispatch:**
1. Manually create the Cherry Hill recurring schedule via admin UI (or seed script) — one quarterly schedule per HOA fee tier.
2. Wire a "Recurring schedule" prompt into the onboarding wizard (already in flight per #1616) so future associations don't ship without it.
3. Add a /api/admin/health check that warns when an association has owner_ledger_entries of type "assessment" but zero active recurring schedules.

**Authorization:** read-only audit. No code changes made.
