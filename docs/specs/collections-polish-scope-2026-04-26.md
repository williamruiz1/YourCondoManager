# Phase 3B — Collections Polish — Scope Questions (2026-04-26)

**PPM:** 73ce3d18-a3ab-422d-85d9-d67420244703
**Status:** Awaiting founder + legal input
**Authored:** 2026-04-26 by background research agent

## Context

Phase 3 core already shipped delinquency classification, retry handling,
and notice-record bookkeeping. Phase 3B is the **polish layer**: late-fee
configuration that actually fires, live notices that actually deliver,
and aging exports the board can read. Work is gated on a founder + legal
session because late-fee rules and notice formats are
**Connecticut-jurisdiction-specific** (CIOA — Connecticut Common
Interest Ownership Act, Title 47 Ch. 828). This doc is the question set
for that session — **not** the spec. A follow-up will translate answers
into acceptance criteria.

---

## What we have today

### Schema (`shared/schema.ts`)

- `late_fee_rules` (343–355): `feeType` (`flat | percent`), `feeAmount`,
  `graceDays`, `maxFee`. Per-association.
- `late_fee_events` (357–368): applied events with `referenceType /
  referenceId` (free-text, no FK to ledger), `balanceAmount, dueDate,
  asOfDate, calculatedFee`.
- `delinquency_thresholds` (2334–2347): per-stage rule with
  `minimumBalance, minimumDaysOverdue, actionType` (notice / late_fee /
  lien / collections), `noticeTemplateId` FK, `lateFeePct / lateFeeFlat`
  (duplicate of `late_fee_rules` shape — currently unused).
- `delinquency_escalations` (2352–2367): per-`(personId, unitId)` row
  with `currentStage, balance, daysPastDue, status` (active / resolved /
  referred / on_payment_plan), `lastNoticeAt, nextActionAt`.
- `delinquency_settings` (3224–3234): per-association (or null = global)
  `gracePeriodDays` (15), `bucketBoundariesJson` (`[30,60,90]`),
  `noticeStagesJson`, **`autoLateFeeEnabled`** (Finding 2).
- `delinquency_notices` (3248–3267): `noticeStage` enum
  (`payment_failed_notice | delinquency_notice_1 | delinquency_notice_2
  | final_notice`), `triggerDaysPastDue, amountOwedCents, escalationId,
  noticeSendId`, `status` (queued / sent / skipped / failed),
  `delinquencyPeriodKey` (`YYYY-MM`) with unique index on
  `(association, person, unit, stage, periodKey)`.
- `notice_sends` (1116–1134): outbound channel record —
  `recipientEmail, subjectRendered, bodyRendered, provider` (default
  `internal-mock`), `providerMessageId, status, sentAt, deliveredAt,
  openedAt, bouncedAt`.
- `collections_handoffs` (2544–2563): outside-agency referral with
  `referralDate, referralAmount, status` (referred / active / settled /
  withdrawn / judgment), `agency*` contacts, `settlementAmount`.

### Server endpoints

- Late-fee rules + activity (`server/routes.ts:3743–3858`): GET/POST/
  PATCH `/late-fee-rules`, GET `/late-fee-events`, POST
  `/late-fees/calculate` (single-account; `apply: true` inserts
  `late_fee_events` row).
- Delinquency thresholds (3861–3909): full CRUD.
- Delinquency escalations (3912–4019): GET/PATCH; POST
  `/delinquency-escalations/run` scans ledger, opens/advances
  escalation rows.
- Collections aging dashboard (4066–4169): GET
  `/collections-aging` — buckets `current / 31-60 / 61-90 / 91-120 /
  120+`, per-unit rows w/ days past due, owner, last payment, notice
  stage, next retry, autopay flag. Bucket math derived from
  `escalations.daysPastDue` (only includes units that already have an
  escalation row).
- AR aging report (6197–6292): GET `/reports/ar-aging` — separate
  endpoint; buckets by **charge date** with boundaries `30/60/90/120`.
  Returns `summary + byUnit`. Coexists with `collections-aging`
  (Finding 1).
- Delinquency settings (4173–4209): GET/POST upsert.
- Delinquency notices (4213–4234): GET history, POST `/generate` calls
  the notice service.
- Collections handoffs (4022–4064): GET/POST/PATCH.

### Client surfaces

- `client/src/pages/financial-late-fees.tsx` (1,400 LoC). Tabs: **Rules
  & Calculator**, **Fee Activity**, **Recovery**. Bulk run = client-side
  loop of N×`POST /late-fees/calculate` calls; no server-side bulk
  endpoint. No CSV export.
- `client/src/pages/financial-delinquency.tsx` (1,149 LoC). Tabs:
  thresholds / escalations / **aging** / notices / settings. Aging tab
  has **client-side CSV export** via `<ExportCsvButton>` (columns: unit,
  owner, balance, bucket, days past due, last payment, notice stage,
  next retry, autopay). Manual "Run Retries" + "Generate Notices"
  buttons.

### Existing late-fee logic

`storage.calculateLateFee` (`server/storage.ts:6853–6908`):
- Hard-coded math: `flat → rule.feeAmount`,
  `percent → balance × feeAmount / 100`, then min with `rule.maxFee`.
- Honors `graceDays` (returns 0 inside grace).
- With `apply: true`, inserts `late_fee_events` row only — **does not
  write to `owner_ledger_entries`** (Finding 3).

No scheduled trigger. No association-wide "run late fees on the 16th"
job. `delinquencySettings.autoLateFeeEnabled` exists but is not read
by any code path (verified via `grep -rn autoLateFeeEnabled server`).

### Existing notice generation

`server/services/delinquency-notice-service.ts` (172 LoC):
- Iterates active escalations past grace.
- Stage selection by hard-coded thresholds: `≥90 → final_notice`,
  `≥60 → delinquency_notice_2`, `≥30 → delinquency_notice_1`, else
  `payment_failed_notice`.
- Idempotent on `(association, person, unit, stage, YYYY-MM)`.
- Inserts `notice_sends` with `provider: "internal-mock"`, hand-rolled
  body string, **no template rendering**, **never calls
  `sendPlatformEmail`**. Notice is "queued" forever (Finding 4).
- `delinquency_thresholds.noticeTemplateId` is unused by this service.

A parallel `paymentReminderRules.run` flow (`server/routes.ts:4499–
4598`) **does** render templates and call `sendPlatformEmail`, but
targets any delinquent balance and is not wired to the staged
delinquency-notice flow.

### Existing aging report

Two endpoints (Finding 1):
- `/api/financial/collections-aging` — backs the UI; needs an
  escalation row to include a unit; carries notice/autopay context.
- `/api/financial/reports/ar-aging` — clean by-charge-date math;
  no notice context.

Neither has server-side CSV/PDF export. The CSV download is a
client-side stringify of in-memory rows.

### Existing tests

**Zero direct tests** for `calculateLateFee`,
`generateDelinquencyNotices`, escalation-run, `collections-aging`, or
`ar-aging`. Verified:
`grep -rln "calculateLateFee\|generateDelinquencyNotices\|collections-
aging\|ar-aging" tests server` returns only implementation files. The
nearest tests are alert-source unit tests
(`server/alerts/__tests__/unpaid-late-fees.test.ts`,
`delinquent-ledger-balances.test.ts`) which cover the alert engine, not
domain logic.

---

## Open questions for founder + legal session

### Q1 — Late-fee structure

**Question:** What late-fee calculation model does v1 ship?

**Options:**
- A. **Flat fee** (e.g. $25 after grace). Already supported.
- B. **Percentage of overdue balance** (e.g. 1.5% per month). Already
  supported.
- C. **Tiered**: $X after 30 days, $Y after 60 days, capped at $Z.
  Requires new `late_fee_rule_tiers` child table.
- D. **Per-association choice** of A / B / C, plus existing `maxFee`.

**Connecticut context:** CIOA § 47-244 caps late fees at the greater of
$25 OR 5% of the overdue assessment per month, **unless the declaration
provides otherwise**. Most CT condo declarations carry forward the
statutory default. Flat $25 or 1.5% rules fit inside the cap; tiered
rules generally do not without explicit declaration support.

**Recommendation:** D — but with **cap enforcement** in the rule editor:
client + server validator that flags any rule exceeding the statutory
floor. Don't auto-block (some declarations override) — require explicit
acknowledgement on save.

**Why it matters:** Decides whether we add a tier table (+1 migration).
Compliance-flag UX touches the rule-edit dialog.

---

### Q2 — Late-fee triggering

**Question:** When and how does a late fee actually post?

**Today:** Manager opens Late Fees → Bulk Run → previews → applies.
Each apply inserts a `late_fee_events` row but **does not post to
`owner_ledger_entries`** (Finding 3). No scheduled trigger.

**Options:**
- A. **Manual-only** (status quo + Finding-3 fix).
- B. **Scheduled per-association**: daily sweep on rule's `dayOfMonth`,
  gated by the dormant `autoLateFeeEnabled` flag.
- C. **Manager-approved batch**: scheduled sweep generates a draft
  batch; manager reviews + approves before posting.
- D. **Hybrid**: B for tenants who flip `autoLateFeeEnabled = 1`,
  A for everyone else.

**Connecticut context:** CIOA's "reasonable opportunity to cure"
language permits automatic application **if the declaration provides**.
Manager-in-the-loop is the lowest-risk default.

**Recommendation:** D. Honors the dormant flag, keeps unsophisticated
tenants on manual, gives sophisticated ones the sweep. Auto-mode
requires a per-rule `dayOfMonth` column.

**Why it matters:** Ledger-write is **required** regardless. Scheduled
trigger reuses the autopay-sweep machinery (`server/index.ts:167–233`).
C is the highest-effort option.

---

### Q3 — Notice generation triggers

**Question:** When do live (delivered) notices auto-generate?

**Today:** Manager-button-only and never delivered (Finding 4).

**Options:**
- A. **On stage cross** — escalation `currentStage` advances → emit
  notice inline in the escalation-run endpoint.
- B. **Manager-triggered batch** (status quo, but make it real:
  honor `noticeTemplateId`, render, call `sendPlatformEmail`).
- C. **Scheduled daily sweep**, idempotent on `delinquencyPeriodKey`.
- D. **A + C**: stage-cross emits immediately; nightly catches gaps.

**Recommendation:** D. The dedup index already makes the redundancy
safe. A alone has gaps if escalation isn't run; C alone is sluggish on
the human-facing "we just escalated to final notice" moment.

**Why it matters:** Wires `noticeTemplateId` to the staged flow
(currently disconnected) and adds a sweep job. Switching `internal-mock`
to a real provider also means real emails go to real owners — a
**GO/NO-GO founder call** independent of architecture.

---

### Q4 — Notice channels

**Question:** What delivery channels does a notice support in v1?

**Today:** Email-only via `internal-mock` (nothing ships). No
notice-specific portal-inbox surface (general inbox at
`/app/communications/inbox` exists). No USPS or certified-mail.

**Options:**
- A. **Email only** (real send via `sendPlatformEmail`).
- B. **Email + portal inbox** (notice mirrored to owner's portal inbox;
  survives bounce).
- C. **B + USPS first-class** via Lob / PostGrid (vendor + per-piece
  cost).
- D. **C + certified mail** for `final_notice` (lien-precondition).

**Connecticut context:** CIOA § 47-258(m) requires **certified mail,
return receipt requested, to the owner's address as shown on the books
of the association** at least 60 days before recording a statutory
lien. Email alone does not satisfy the lien-precondition.

**Recommendation:** B for v1. Flag C/D as **REQUIRES_LEGAL_REVIEW** and
defer to a Phase 3C / "Legal & reconciliation foundations" workitem.
B keeps notices reliably visible without taking on a postal vendor or
claiming lien-precondition compliance we can't audit. D specifically
should not ship without counsel signing off on the certified-mail
tracking schema and retention policy.

**Why it matters:** Channel scope is the biggest cost driver. B is
~200 LoC. D is multi-month (vendor integration, returns/receipts,
evidence-grade audit trail).

---

### Q5 — Aging report format and exports

**Question:** What does the aging export look like, and where?

**Today:** Two divergent server endpoints (Finding 1) + client-side CSV
stringify. No server-rendered CSV. No PDF. No scheduled email.

**Options:**
- A. **Consolidate to one server endpoint** + emit CSV at
  `?format=csv`. Columns: unit, owner, current, 0–30, 31–60, 61–90,
  90+, last payment date.
- B. **A + PDF** export.
- C. **B + drill-down** per unit (click → ledger detail view).
- D. **C + scheduled monthly email to board** (reuses
  governance-reminder cadence pattern).

**Recommendation:** A for v1 with the `collections-aging` shape (it
carries notice-stage + autopay context the board cares about; the
`ar-aging` endpoint is the cleaner skeleton — merge them). B/C/D defer
unless founder pushes back; existing pages already print-to-PDF.

**Why it matters:** Endpoint consolidation is a Finding-1 fix
regardless of export choice. D duplicates governance-reminder
infrastructure.

---

### Q6 — Compliance and legal scope

**Question:** Which CT statutory requirements does v1 explicitly meet,
and which are explicitly deferred?

**Today:** No statutory-compliance posture is encoded. Notice templates
are free-text; nothing checks for required content (account number,
cure-rights statement, lien-warning language).

**Options:**
- A. **Basic notice content** baked into template defaults (owner name,
  unit, balance, days past due, due date, payment options, dispute
  contact).
- B. **A + cure-rights language** for stages ≥ `delinquency_notice_2`.
- C. **B + lien-precondition trail** at `final_notice` (depends on
  Q4-D).
- D. **C + CIOA-specific helper bundle** for boards (preflight checklist
  with statute citations per stage).

**Recommendation:** **REQUIRES_LEGAL_REVIEW.** Founder + counsel call.
Agent's rough cut: A for v1 with a `[Compliance: not legal advice]`
banner on every template editor. B is achievable but the language
itself needs counsel sign-off (the words become part of any future
lien-action evidence). C/D are out of scope — "close but not quite
right" costs more than "deferred."

**Why it matters:** This question gates phase scope. A-only = small
phase. B+ correctly = 2–3× scope and external legal review pass on
templates.

---

### Q7 — Per-association configurability

**Question:** Are late-fee rules and notice cadence per-association or
platform-wide?

**Today:** `late_fee_rules` and `delinquency_thresholds` are
per-association (NOT NULL `associationId`). `delinquency_settings`
allows null = global default. No platform-level late-fee policy.

**Options:**
- A. **Status quo**: per-association rules + thresholds, null-default
  for settings only.
- B. **Platform default + per-association override** for all three
  tables.
- C. **Fully per-association** (drop null-default support).
- D. **Tiered defaults**: platform → portfolio (manager group) →
  association.

**Connecticut context:** CIOA is state-level; every CT association is
governed by it. A statewide default is meaningful; a national one isn't
(YCM is CT-only in v1).

**Recommendation:** A. Already supported for settings. Adding
platform-default rules ahead of the second jurisdiction (D) is
premature.

**Why it matters:** Affects rule-edit UI ("inherit from platform
default" toggles), seed-data story for new associations, and shape of
any future multi-jurisdiction expansion.

---

## Out-of-scope for Phase 3B (don't bring up)

- **Lien filing automation** — separate "Future — Legal &
  reconciliation foundations" workitem. No lien-form generation, no
  CT Land Records integration in v1.
- **Bank reconciliation** — same future workitem.
- **Multi-jurisdiction support** — CT only for v1.
- **Owner payment plans** — `escalations.status` has `on_payment_plan`
  but no plan-management UI; defer to Phase 3C.
- **Collections-agency integration** — `collections_handoffs` is a
  manual-entry record table; no agency API integration in v1.
- **Refund/dispute flow** for late fees applied in error — manual
  ledger adjustment is the workaround.
- **i18n** of notice templates — English only.

---

## Suggested architecture sketch (post-decisions)

Rough sizing assuming the recommendations above are accepted:

- **Schema (~40 LoC):** `late_fee_rules.dayOfMonth` (Q2-D enables
  scheduled mode); rationalize the two aging endpoints.
- **Server (~600–900 LoC):**
  - Wire `calculateLateFee.apply: true` to insert `owner_ledger_entries`
    (Finding-3 fix).
  - New `POST /api/financial/late-fees/run` server-side bulk endpoint
    (replaces the N-call client loop).
  - New `runScheduledLateFees()` sweep gated by `autoLateFeeEnabled`
    (Q2-D).
  - Hook `delinquency-escalations/run` to emit notices on stage advance
    (Q3-A).
  - New `runScheduledNotices()` daily sweep (Q3-C).
  - Replace `internal-mock` provider with `sendPlatformEmail` + template
    rendering using the `noticeTemplateId` already wired on
    `delinquency_thresholds` (Q3-B).
  - Portal-inbox notice mirror (Q4-B): one new table, one portal route.
  - Server CSV export `/reports/ar-aging?format=csv` (Q5-A).
  - Default template seed pack with required CIOA fields (Q6-A).
- **Client (~250–400 LoC):** statutory-cap warning banner (Q1);
  scheduled-mode `dayOfMonth` field (Q2-D); aging server-CSV link
  (Q5-A); portal inbox notice list (Q4-B).
- **Tests (~700–1100 LoC):** unit suites for `calculateLateFee` (rule
  application, cap, grace), `generateDelinquencyNotices` (idempotency,
  stage selection), aging bucket math; integration for scheduled
  sweeps, ledger-write idempotency, template rendering with fixtures.

**Total expected diff:** ~1,700–2,500 LoC over 3–4 PRs. Q4-D and
Q6-C/D are excluded; either inclusion roughly doubles the total.

---

## Stop-and-surface notes (per scope-questions protocol)

- **Finding 1 — Two divergent aging endpoints.**
  `/collections-aging` only includes units with an existing escalation
  row; `/reports/ar-aging` includes any unit with an outstanding
  charge. Same association can show two different totals. Existing
  inconsistency; should be reconciled in Phase 3B regardless of
  founder export decisions.

- **Finding 2 — `autoLateFeeEnabled` is dormant configuration.**
  Editable via `/delinquency-settings`, but no server code reads it.
  Tenants who flip it expecting automation get nothing. Either remove
  the column or wire it (Q2-D).

- **Finding 3 — Late-fee apply does not write the owner ledger.**
  `calculateLateFee` with `apply: true` inserts a `late_fee_events`
  row but **never inserts into `owner_ledger_entries`**. The fee shows
  on Late Fees → Fee Activity and triggers alerts, but **the owner is
  not actually billed** and AR aging does not include applied late
  fees. Behavior bug — fix in Phase 3B regardless of which Q2 option
  is chosen.

- **Finding 4 — Notices are created but never delivered.**
  `delinquency-notice-service.ts` writes
  `notice_sends.provider = "internal-mock"` and never calls a real
  provider. `delinquency_thresholds.noticeTemplateId` is unused. Core
  gap behind Q3 — surfaced separately because the symptom (notices
  appear "queued" forever) is itself a user-visible defect.

- **No security gap surfaced.** All admin endpoints use `requireAdmin`
  + role-gating, and `assertAssociationScope` is consistently applied
  on read and write. Late-fee rule writes are scoped by body
  `associationId` and re-checked.

- **Test coverage is zero** for the entire collections subsystem
  (`calculateLateFee`, `generateDelinquencyNotices`,
  `collections-aging`, `ar-aging`, escalation-run). This is a finding,
  not a question — implies any v1 cut should ship with at least the
  unit-level coverage above.

- **CT statutory depth.** This doc summarizes CIOA at the level needed
  to frame Q1, Q2, Q4, Q6. It is **not** a legal opinion. Founder +
  counsel session should treat the statute references as starting
  points, not authoritative readings — particularly the
  lien-precondition (§47-258) and late-fee cap (§47-244) citations.
