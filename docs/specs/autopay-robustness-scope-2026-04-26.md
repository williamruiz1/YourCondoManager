# Phase 2B — Autopay Robustness — Scope Questions (2026-04-26)

**PPM:** 5304044f-7bf6-4bb2-bffd-cb1a2fa28101
**Status:** Awaiting founder input
**Authored:** 2026-04-26 by background research agent

## Context

YCM has a working autopay engine: enrollment tables, a 5-min sweep,
Stripe off-session charging, and a Phase-3 retry service that classifies
failures as soft/hard. Founder flagged the implementation as "fragile" —
several robustness/safety policies are unstated or hard-coded, and the
owner-side experience around failures is silent. This doc captures the
questions a founder session needs to answer. It is **not** the spec.
A follow-up doc (`autopay-robustness-spec-...md`) will translate the
answers into acceptance criteria.

---

## What we have today

### Schema (`shared/schema.ts:1713–1754`)

`autopayEnrollments`
- `id, associationId, unitId, personId`
- `paymentMethodId` (FK → `savedPaymentMethods`, **nullable**)
- `amount` (real), `frequency` (enum: `monthly | quarterly | annual`)
- `dayOfMonth` (int, default 1), `status` (enum: `active | paused | cancelled`)
- `nextPaymentDate` (timestamp, nullable)
- `description` (default "Autopay HOA dues")
- `enrolledBy / enrolledAt / cancelledBy / cancelledAt`

`autopayRuns`
- `id, enrollmentId, associationId, amount`
- `status` (enum: `success | failed | skipped`)
- `ledgerEntryId, paymentTransactionId, errorMessage, ranAt`

`paymentTransactions` (Phase 3 columns, lines 3198–3209)
- `autopayEnrollmentId, isOffSession, attemptNumber`
- `retryOfTransactionId, failureCategory` (enum), `retryEligible`, `nextRetryAt`

`delinquencySettings` (lines 3217–3229)
- `gracePeriodDays` (default 15)
- `maxRetryAttempts` (default 3)
- `retryScheduleJson` (default `[3, 7, 14]` days)

### Server endpoints (`server/routes/autopay.ts`)

Admin:
- `GET /api/financial/autopay/enrollments` — list w/ unit + person + method
- `POST /api/financial/autopay/enrollments` — admin create
- `PATCH /api/financial/autopay/enrollments/:id` — pause/resume/cancel/edit
- `GET /api/financial/autopay/enrollments/:id/runs` — single-enrollment history
- `GET /api/financial/autopay/runs` — all runs in association
- `POST /api/financial/autopay/run` — trigger collection on demand

Portal:
- `GET /api/portal/autopay/enrollments` — list own enrollments
- `POST /api/portal/autopay/enroll` — owner self-enroll
- `PATCH /api/portal/autopay/enrollments/:id` — pause/resume/cancel own
- `GET /api/portal/autopay/enrollments/:id/runs` — own run history

### Run trigger

`server/index.ts:167–233` — `runAutomationSweep()` runs every
`AUTOMATION_SWEEPS_INTERVAL_MS` ms (default **300,000 = 5 min**).
The sweep calls **both** `runDueAutopayCharges()` (collects new
enrollments due today) and `runAutopayRetries()` (re-attempts failed
transactions whose `nextRetryAt` has elapsed). The interval has a
60-second floor and runs in-process via `setInterval`.

### Run state machine

`server/routes/autopay.ts:95–317` (`runAutopayCollectionForAssociation`):

1. Fetch active enrollments where `nextPaymentDate <= today`.
2. **Dedup**: skip if any `autopayRuns` row with `status=success` or
   any `paymentTransactions` row with status in
   `[initiated | pending | succeeded]` exists for this enrollment with
   `createdAt >= startOfMonth`.
3. Skip if `paymentMethodId` null, payment method not active, or
   gateway has no `secretKey`.
4. `createPaymentTransaction` → `chargeOffSession` (Stripe) →
   `updatePaymentTransactionStatus` → on success, write
   `ownerLedgerEntries`.
5. Insert `autopayRuns` row. Advance `nextPaymentDate`.
6. On failure, call `markTransactionForRetry`.

### Current failure handling

The Phase-3 retry service exists and is real, but the owner experience
is silent.

- **Classification** (`retry-service.ts:29–60`):
  - `HARD_FAILURE_CODES`: `account_closed`, `invalid_account`,
    `no_account`, `account_frozen`, `bank_account_declined`,
    `debit_not_authorized`, `authentication_required`,
    `setup_intent_authentication_failure`
  - `SOFT_FAILURE_CODES`: `insufficient_funds`, `processing_error`,
    `temporary_failure`, `rate_limit`
  - Heuristic fallback on free-text reason ("network/timeout" → soft,
    "closed/not authorized" → hard)
  - Hard or `attemptNumber >= maxRetryAttempts` → `retryEligible = 0`,
    no retry scheduled.
- **Retry schedule** (`getDelinquencySettings`): default `[3, 7, 14]`
  days from failure; tenant-overridable via `delinquencySettings` row.
- **Cap**: `maxRetryAttempts` default 3, tenant-overridable.
- **Owner notification on failure: NONE.** No email, no push, no portal
  banner. (Verified by `grep -rn "autopay.*notif\|sendEmail.*autopay"`
  → no matches outside the sweep log line.) Owners only learn of a
  failed autopay if they open the portal and inspect the run history.
- **Admin notification on failure: NONE.** The sweep emits a single
  aggregate log line; per-enrollment failures are not alerted.

### Anti-double-charge guardrails

Two checks (described above): same-month run-success dedup AND
in-flight transaction dedup. Both keyed on **calendar-month boundary**
(`startOfMonth = new Date(year, month, 1)`). Implications:
- For `monthly` enrollments: works as long as everything settles inside
  one calendar month.
- For `quarterly` / `annual` enrollments: calendar-month dedup is
  stricter than necessary inside the month but does **not** protect
  across months — relies entirely on `nextPaymentDate` being advanced
  correctly.
- No DB unique constraint on `(enrollmentId, scheduledMonth)`. The
  check-then-insert pattern is not transactional, so concurrent sweep
  + manual run could in principle race.

### Cancellation safety

`PATCH /api/portal/autopay/enrollments/:id` with `status=cancelled`
sets `cancelledAt + cancelledBy`. **It does NOT**:
- Cancel any in-flight `paymentTransactions` rows.
- Refund any already-submitted Stripe charges.
- Cancel any pending retries (a `paymentTransactions` row with
  `retryEligible=1` will continue to be picked up by
  `runAutopayRetries()` even after the enrollment is cancelled).

The third point is a **silent bug today**: cancelling an enrollment
leaves orphaned retry-eligible transactions whose payment method may
still be active, and they will continue to be charged on schedule.

### Schedule edge cases

`computeFirstRunDate` / `advanceDate` use `Date.setMonth` +
`setDate(dayOfMonth)`:
- **Day 31 in 30-day month** (or Day 29–31 in Feb): `setDate` rolls
  forward into the next month (e.g. April + day 31 → May 1). Silent.
- **Weekends / bank holidays**: not considered. Sweep fires whenever
  it next runs; Stripe handles its own settlement calendar.
- **Retries `+3 / +7 / +14`**: calendar days, no business-day shift.

### Client surfaces (`client/src/pages/portal/portal-finances.tsx`)

The portal renders a **read-only autopay section**: lists enrollments
with status + frequency badge, no enroll button, no pause/cancel UI,
no failure-state surfacing, no payment-method-update prompt. The
`POST /api/portal/autopay/enroll` and PATCH endpoints exist on the
server but are **not wired to UI** in the current portal. (Admin-side
UI exists in financial routes — not investigated in detail for this
stub.)

### Existing tests

**Zero.** `find tests server/__tests__ server -name "*autopay*test*"`
returned no matches. No retry-service tests, no
`runAutopayCollectionForAssociation` tests, no portal-route tests for
autopay. This is the single biggest robustness gap and is implicit in
every Q below.

---

## Open questions for founder session

### Q1 — Retry policy authority

**Question:** Today the retry policy is global with per-tenant
override (`delinquencySettings.retryScheduleJson` and
`maxRetryAttempts`). Defaults are `[3, 7, 14]` days, max 3 retries.
Is this the right shape, or do we want different defaults / a different
override model?

**Options:**
- A. Keep current shape; just document defaults and expose admin UI
  to edit per-association.
- B. Reduce defaults to `[1, 3]` (max 2 retries) — typical SaaS pattern
  is fewer retries, faster manual escalation.
- C. Increase to `[1, 3, 7, 14]` (max 4) — more chances on transient
  failures.
- D. Make schedule configurable per-enrollment (owner-level), not just
  per-association.

**Recommendation:** A. Keep tenant-level config; current defaults are
reasonable industry middle. Per-enrollment is overkill.

**Why this matters:** Sets the contract for "how long until manual
intervention?" — affects every other failure-handling answer. Also
sets admin UI scope (none vs association-config form).

---

### Q2 — Failure-mode classification trust

**Question:** The hard/soft classifier (`retry-service.ts:29–60`) uses
a fixed list of Stripe failure codes plus reason-text heuristics. Do
we trust this list as-is, or do we want explicit per-tenant overrides
("our gateway returns code X for what is actually a soft failure")?

**Options:**
- A. Trust the list; treat unknown codes as soft (current behavior).
- B. Trust the list; treat unknown codes as **hard** (fail-safe; never
  retry something we don't understand).
- C. Add a per-tenant `failureCodeOverridesJson` column on
  `delinquencySettings` mapping `code → "soft" | "hard"`.
- D. Log unknown codes for human review and treat as hard until
  classified.

**Recommendation:** B + D. Fail-safe on unknown is the financially
conservative choice; logging gives us a feedback loop for the static
list.

**Why this matters:** Misclassifying hard as soft = repeatedly hitting
a closed account with charge attempts → bank fees, complaints, possible
fraud signals to the processor. Default behavior here is a real
financial risk, not just a UX risk.

---

### Q3 — Owner notification cadence on failure

**Question:** Today the owner is told **nothing** when autopay fails.
When should we notify, on which channel, and at what cadence?

**Options:**
- A. Immediately on first failure (email) + portal banner; no further
  emails until status changes (final-failed or recovered).
- B. Only on **final failure** (after retries exhausted) — minimize
  email volume.
- C. Each attempt: failure email per retry attempt + per final state.
- D. Daily digest email summarizing all failed attempts of the prior
  24h, plus an immediate notification for hard failures.
- E. Channel mix: portal banner always; email only on final failure;
  push (where enrolled) on hard failure or final.

**Recommendation:** A — immediate on first failure (with "we'll retry
on <date>"), plus a final-failed email when retries exhaust. Portal
banner persists until the enrollment is healthy. This matches owner
expectation ("tell me my payment didn't go through") without being
noisy.

**Why this matters:** Comms scope. Affects email-template work, push
integration scope, portal-banner work. Determines whether we touch
the notifications subsystem at all in this phase.

---

### Q4 — Admin/manager notification on failure

**Question:** Today the manager is told **nothing per-enrollment** —
only an aggregate sweep log line. When should the association
admin/manager hear about failures?

**Options:**
- A. No per-failure notification; managers see failures via the existing
  alerts inbox (would need new alert source: "autopay-failed").
- B. Daily digest email to association manager: failed-this-day list.
- C. Immediate email/push to manager for hard failures only.
- D. A + C: alert source for visibility, immediate ping for hard
  failures.

**Recommendation:** D. Hard failures are actionable (call the owner,
pause enrollment). Soft failures self-heal in most cases — surface in
inbox but don't ping.

**Why this matters:** Adds an alerts source (new file in
`server/alerts/sources/`), possibly an email-notification path. Scope
size: small (alert source) to medium (digest + push).

---

### Q5 — Manual fallback threshold

**Question:** When exactly does the system stop trying and require
human action? Today: after `maxRetryAttempts` (default 3) OR on the
first hard-classified failure.

**Options:**
- A. Keep current: retry-count OR hard-classification, whichever first.
- B. Add a hard time bound: "after N days from first failure, stop
  regardless of retry count." (Prevents `[3, 7, 14]` from stretching
  over 30+ days if combined with another retry bump.)
- C. Add a payment-method-status guard: any failure transitions the
  payment method to a "needs verification" state; blocks future
  charges until owner re-confirms.

**Recommendation:** A + C. The hard-bound time-window in B is implied
by the retry schedule itself; the payment-method-quarantine in C is the
cleanest user-facing escape hatch.

**Why this matters:** Affects `savedPaymentMethods` schema
(potentially a new `needsVerification` flag) and the
enrollment-cancellation flow. C is the largest single scope item if
chosen.

---

### Q6 — Anti-double-charge guardrails

**Question:** Current guardrails are calendar-month-boundary checks
(see "Anti-double-charge guardrails" above). Are they sufficient, or
do we need stronger guarantees?

**Options:**
- A. Status quo. Risk is theoretical — `nextPaymentDate` is advanced
  before any second pass would fire.
- B. Add a database unique constraint on
  `autopayRuns(enrollmentId, scheduledMonth)` where `scheduledMonth`
  is a derived `YYYY-MM` column — bypass-proof.
- C. Use an explicit idempotency key on the Stripe `chargeOffSession`
  call (`(enrollmentId, scheduledDate)`) so even a double-execute on
  our side would be a no-op at Stripe.
- D. Move the "find due enrollments → charge" loop into a row-level
  `SELECT … FOR UPDATE SKIP LOCKED` so two workers can't pick up the
  same enrollment.
- E. Combine B + C — defense in depth.

**Recommendation:** E. B is cheap (one migration); C is cheap (we
already pass a transaction id). Together they make a double-charge
require simultaneous DB and Stripe failures.

**Why this matters:** This is the highest-stakes scenario for
cardholder trust and chargeback risk. Worth over-engineering. Scope is
small (1 migration + 1 idempotency-key string change).

---

### Q7 — Cancellation safety: in-flight charges

**Question:** When an owner cancels mid-cycle, today we set status =
cancelled but **leave any retry-eligible failed transactions alive**
(see "Cancellation safety" above — this is a silent bug). What's the
right behavior?

**Options:**
- A. Cancellation cancels all open retries on that enrollment
  immediately (`retryEligible = 0` on every txn with matching
  `autopayEnrollmentId`). Already-submitted/succeeded charges stand.
- B. A + auto-refund any successful charge submitted in the last
  N hours from the cancellation timestamp.
- C. A + admin-approval-required refund flow (no automatic refunds).
- D. Status quo (no change) — owners are responsible for understanding
  that "cancel" is forward-looking only.

**Recommendation:** A + C. A fixes the silent bug. C avoids us writing
an automatic-refund path with all its dispute exposure; admin can
issue refunds via existing tooling if needed.

**Why this matters:** A is **a silent-bug fix** that should land
regardless of B/C choice. The refund question is the real founder
call.

---

### Q8 — Schedule edge cases

**Question:** How do we handle Day-31 in 30-day months, Feb 29, and
banking calendars?

**Options:**
- A. Status quo: forward-roll into next month (current `setDate`
  behavior is "April + day 31 → May 1"). Silent.
- B. Clamp: if `dayOfMonth > daysInMonth`, fire on the last day of the
  month instead. Owner-stable.
- C. Owner-configurable preference (`day31Behavior: "clamp" | "skip" |
  "next-month"`).
- D. Same as B, plus banking-calendar awareness: if scheduled day
  falls on a Saturday/Sunday/US-bank-holiday, shift to the next
  business day.

**Recommendation:** B for v1. D is appealing but adds a
banking-calendar dependency we don't have today and is mostly
cosmetic for ACH (Stripe handles settlement timing). Revisit D in a
later phase if owners complain.

**Why this matters:** B is a 5-line code change in `advanceDate` and
`computeFirstRunDate`. D is a multi-day project (calendar source,
holiday data, business-day math). Picking B keeps Phase 2B tight.

---

### Q9 — Owner self-service: enroll/pause/cancel UI

**Question:** Server endpoints exist (`POST /api/portal/autopay/enroll`,
PATCH for pause/resume/cancel) but the **portal UI is read-only**.
Should Phase 2B include the missing UI?

**Options:**
- A. Yes — a Phase-2B robustness story is incomplete if owners can't
  self-cancel a misbehaving enrollment.
- B. No — keep Phase 2B focused on backend safety rails; UI is its
  own phase.
- C. Minimal subset: cancel-only button on existing enrollments
  (matches the "I need to stop this" robustness need), defer enroll/
  edit UI to a separate phase.

**Recommendation:** C. The robustness rationale demands cancel; enroll
UX deserves its own design pass.

**Why this matters:** Determines whether this work touches the client
at all. C is ~50 LoC; A is ~400 LoC of forms + validation +
confirmation flows.

---

### Q10 — Test coverage requirements

**Question:** Today there are **zero autopay tests**. What's the
minimum coverage bar for this phase?

**Options:**
- A. Unit tests for `runAutopayCollectionForAssociation`, `markTransactionForRetry`,
  `runAutopayRetries`, and `classifyFailure`. ~6–10 test files.
- B. A + integration tests against a mocked Stripe gateway covering
  the full failure → classify → retry → succeed loop.
- C. A + B + portal-route tests (auth scoping, can't modify someone
  else's enrollment).
- D. A only; integration + portal in a follow-up.

**Recommendation:** C. Autopay is money. The portal-scoping tests
specifically should land alongside any UI work in Q9.

**Why this matters:** The largest single LoC contributor of any answer
above. Could double the implementation scope on its own.

---

## Out-of-scope for Phase 2B (don't bring up)

- **ACH return handling** — separate finance-foundations work; depends
  on webhook event types we don't fully wire today.
- **Multi-currency** — USD-only for v1.
- **Payment-method update flows** (changing card / bank on an existing
  enrollment) — Phase 1B work; the cancel-and-re-enroll path is the
  fallback.
- **Stripe Customer Portal integration** — separate phase if pursued.
- **Late-fee automation tied to autopay failures** — covered by
  `delinquencySettings.autoLateFeeEnabled` already; not Phase 2B.

---

## Suggested architecture sketch (post-decisions)

Once Q1–Q10 are locked, implementation likely looks like this. Numbers
are rough and assume Recommendations are taken.

- **Schema (~80 LoC):** `savedPaymentMethods.needsVerification` (Q5-C),
  `autopayRuns.scheduledMonth` derived `YYYY-MM` + unique index on
  `(enrollmentId, scheduledMonth)` (Q6-B).
- **Server (~600–900 LoC):** idempotency key on Stripe charge (Q6-C),
  unknown-code-as-hard (Q2-B), day-clamp (Q8-B), payment-method
  quarantine on hard failure (Q5-C), cancellation cleanup of
  `retryEligible` (Q7-A), new alerts source `server/alerts/sources/
  autopay-failures.ts` (Q4-A), owner notification hook (Q3-A).
- **Client (~50–100 LoC, Q9-C only):** Cancel button + confirmation
  dialog; failure banner on portal-finances.
- **Tests (~600–1000 LoC):** unit suites for runner / retry /
  classifier, mocked-Stripe integration, portal-route auth scoping.

**Total expected diff:** 1300–2000 LoC over ~3–5 PRs. Parallelizable
with Phase 1B unless Q5-C is taken (then sequential).

---

## Stop-and-surface notes (per scope-questions protocol)

- **Silent bug found** — Q7 documents that cancelling an enrollment
  does not stop already-scheduled retries on existing
  `paymentTransactions` rows. This bug exists today regardless of
  founder decisions on the rest of the doc and should be fixed in
  Phase 2B even if every other Q is deferred.
- **No security gap** in autopay endpoints surfaced during the scan:
  portal routes scope by `req.portalPersonId` and cross-check
  payment-method ownership before enrollment; admin routes use
  `assertAssociationScope`.
- **Test coverage is zero** for the entire autopay subsystem. This is
  a finding, not a question — Q10 frames the scope decision but the
  finding itself is unambiguous.
