# YCM Production-Readiness Queue — 2026-05-29

**Compiled by:** YCM management-team exercise (4 personas: Product Manager / Engineering Lead / Treasurer-Customer / QA-Release)
**Repo:** `~/code/YourCondoManager` · **First customer:** Cherry Hill Court (18-unit HOA, New Haven CT)
**William's go-live gate (verbatim):** *"I need to know my balance and be able to pay it on the platform."*

---

## Method + substrate read

Reviewed: the four 2026-05-25 billing-pipeline gap audits (`working/audit-2026-05-25/gap-1..4.md`); recent merged PRs #177-#195; the repo route surface (612 routes in `server/routes.ts`); the page inventory (78 client pages); the canonical readiness map in `server/services/go-live-checks.ts` (Tiers A-G, 36 gates); prod config (`fly.toml`); the test surface (`tests/` + `server/**/__tests__`).

**The four 2026-05-25 gaps are MERGED:**
- Gap 1 (recurring schedule + wizard gate) → PR #182
- Gap 2 (Plaid auto-sync + auto-reconcile in sweep + webhook trigger) → PR #183
- Gap 3 (admin manual-payment recording surface) → PR #186
- Gap 4 (broadened auto-match + descriptor→owner suggestions) → PR #187

**ALREADY IN MOTION — do NOT re-file (referenced as "in flight"):**
- **Agent A** — automated Plaid bank-feed sync into the 5-min sweep + webhook-driven sync (Gap 2 deepening) + recurring-schedule health check (Gap 1 tail).
- **Agent B** — reconciliation auto-match breadth: Zelle/check/external-credit → owner fuzzy matching + descriptor-alias table (Gaps 3+4 tail).

Everything below is NET-NEW work not covered by the merged PRs or the two in-flight agents.

---

## P0 — blocks the balance / pay / reconcile loop (William's go-live gate)

### P0-1 — End-to-end money-loop verification on Cherry Hill real data *(QA / Treasurer)*
**Why:** Every individual piece (recurring schedule, Plaid sync, reconcile, owner portal balance, Stripe pay) is built and merged, but no single test confirms the *whole loop* works on CHC's real 18-unit ledger: schedule fires → owner sees balance → owner pays → payment reconciles → balance zeroes. The go-live gates A.6/A.7/A.8/B.2/B.3 are all `manual` + unverified.
**Acceptance:**
- A documented run on CHC prod (sandbox payment rail) where one unit's quarterly dues assessment posts, appears in the owner portal as the correct balance, is paid, and auto-reconciles to zero — with the trace captured.
- The 5 manual go-live gates (A.6, A.7, B.2, B.3, F.2) flipped with attestation evidence.
**Size:** M · **Deps:** none (all code merged) · **Buildable** (agent-driven verification, sandbox only)

### P0-2 — Payment receipt + confirmation email on successful payment *(Treasurer / PM)*
**Why:** After an owner pays, there is no receipt. `payment-service.ts` settles the intent but no transactional receipt email is sent, and there's no in-portal "payment confirmed" artifact the owner can keep. A treasurer/owner needs proof of payment. This is part of "be able to pay it on the platform" being *trustworthy*.
**Acceptance:**
- On `payment_intent.succeeded` (Stripe webhook) → send a branded receipt email (amount, date, unit, balance-after) via the existing nodemailer/SMTP provider.
- Portal shows a downloadable/printable receipt for each settled payment.
**Size:** M · **Deps:** transactional email infra live (gate B.5; see W-2) · **Buildable**

### P0-3 — Owner-facing account statement (period summary) *(Treasurer / Customer)*
**Why:** William's gate is "know my balance." Today the portal shows a live balance + activity feed, but there's no statement — the document a treasurer produces for an owner ("here's your Q1 charges, payments, and ending balance"). No PDF/printable owner statement exists (only admin report HTML print-to-PDF). This is the treasurer's most common real-world deliverable.
**Acceptance:**
- `GET /api/portal/statement?period=` and an admin equivalent that renders an owner's opening balance, charges, payments, late fees, ending balance for a date range.
- Printable/PDF-able (print-CSS acceptable for v1, matching the existing report pattern).
**Size:** M · **Deps:** none · **Buildable**

### P0-4 — Reconciliation source-of-truth consolidation (Plaid vs CSV dual-pipeline) *(Engineering / Treasurer)*
**Why:** Gap 3 flagged TWO parallel reconciliation systems — Plaid (`bank_transactions` + `plaid-reconciliation.ts`) and CSV (`bank_statement_transactions` + inline match) — with different match algos and no UX guidance on which is canonical. A treasurer facing three valid paths to reconcile one Zelle deposit is a correctness and trust risk on the money loop. The merged PRs broadened matching but did NOT pick a canonical surface.
**Acceptance:**
- Decision documented + enforced: Plaid is canonical for HOAs with a bank connection; CSV scoped explicitly to "no Plaid connection."
- Admin reconciliation page surfaces ONE canonical workflow; CSV path either de-emphasized or gated behind "no bank connection."
**Size:** M · **Deps:** none · **Buildable** (note: do not re-implement Agent B's match-breadth work; this is the UX/source-of-truth consolidation on top)

---

## P1 — blocks a real owner / treasurer using it day-to-day

### P1-1 — Production observability live (Sentry DSN + GA4) *(Engineering)*
**Why:** `server/observability.ts` is Sentry-wired but a no-op until `SENTRY_DSN` is set (gate E.1 HARD, unverified). GA4 (E.2) similarly. With real owners touching money flows, an unobserved 500 on a payment is unacceptable. Code is done; config + verification is the gap. *(Partially a William-action: needs the DSN secret set — see W-4.)*
**Acceptance:** Sentry capturing a deliberately-triggered prod error; gate E.1 auto-check green. **Size:** S · **Deps:** W-4 · **Buildable** (post-secret) + William-action for the secret

### P1-2 — Uptime/health monitoring + alert on the single Fly machine *(Engineering)*
**Why:** `fly.toml` runs `min_machines_running = 1` on one `shared-cpu-1x` / 512MB machine with `auto_stop_machines = "stop"`. The prod Postgres outage (postmortem 2026-05-25, `docs/incidents/`) showed single-node fragility. There is no external uptime monitor or alert if the app/DB goes down — William finds out when an owner can't pay.
**Acceptance:**
- External uptime check (e.g. against `/api/health` or the go-live readiness ping) with alert to William on downtime.
- Document Neon's resilience posture (managed, separate from the crashed single-node Fly PG — verify the migration to Neon is complete and the old Fly PG is gone; see W-5).
**Size:** S · **Deps:** none · **Buildable** (monitor) + William-action (alert destination)

### P1-3 — DB backup verification + restore runbook *(Engineering)*
**Why:** Prod is on Neon (managed PITR) but there's no documented/verified backup posture for the money data, and only a one-off `backup_before_switch.dump` exists. Before real owners' financial records live here, a tested restore path is table stakes.
**Acceptance:** A documented + once-tested restore of a Neon branch/snapshot to a scratch DB; runbook in `docs/`. **Size:** S · **Deps:** none · **Buildable** (read-only verification against Neon)

### P1-4 — API rate-limiting coverage beyond public/portal-login *(Engineering / Security)*
**Why:** `createRateLimiter` exists but is applied to only 3 surfaces (public + 2 portal-login routes) out of 612 routes. The financial-write and admin endpoints (payments, ledger, reconcile) are unthrottled. Single-instance in-memory limiter also won't survive a second machine.
**Acceptance:** Rate limits on financial-mutation + auth-adjacent endpoints; documented limiter strategy for the multi-instance future (Redis-backed when scaled). **Size:** M · **Deps:** none · **Buildable**

### P1-5 — Automated late-fee assessment in the sweep *(Treasurer / PM)*
**Why:** Delinquency *notices* auto-generate in the sweep (`generateDelinquencyNotices`), and a `late-fee` ledger entryType exists, but there is no automated late-fee *charge* posting per the association's rules. A treasurer expects overdue balances to accrue the configured late fee without manual posting. CT CIOA also constrains late-fee mechanics.
**Acceptance:** Sweep task that posts late-fee charges per `financial-rules` config for delinquent balances past grace, idempotently; surfaced in the owner ledger. **Size:** M · **Deps:** financial-rules config present · **Buildable**

### P1-6 — Owner onboarding completeness check (all 18 units have accounts + can log in) *(PM / QA)*
**Why:** Gate B.1 (all owners have YCM account) is `auto` but unverified for CHC's real roster; B.3 (owner can log in + see ledger + pay) is `manual`. For pilot day one, every CHC owner needs a working login → balance → pay path, OTP/email delivery confirmed. Onboarding wizard (#1616) is built but gate F.2 "tested end-to-end" is unverified.
**Acceptance:** Confirmed: 18/18 units have a person with an account + a verified login + a portal balance; OTP/magic-link email delivered to a test owner. **Size:** M · **Deps:** W-2 (email) · **Buildable** (verification, sandbox) + possible William-action for real owner emails

### P1-7 — Board roles / permissions audit on financial-mutation routes *(Engineering / Security)*
**Why:** A self-managed HOA has board members (treasurer, president) with different authority. Before real money flows, confirm tenant isolation + role-gating on the payment/ledger/reconcile mutation routes — a non-treasurer board member shouldn't be able to post payments or alter ledgers. `admin-access-review.tsx` exists; the verification doesn't.
**Acceptance:** Documented role→capability matrix for financial routes; automated test asserting a non-privileged role is rejected on a financial-mutation endpoint + tenant-isolation holds. **Size:** M · **Deps:** none · **Buildable**

### P1-8 — Email deliverability verification (SPF/DKIM/DMARC + test send) *(Engineering / QA)*
**Why:** Email infra is real (nodemailer/SMTP, Gmail-capable) and gate B.5 is HARD, but deliverability to real owner inboxes (not landing in spam) is unverified — receipts, OTPs, delinquency notices, and announcements all depend on it. *(Partly William-action: domain DNS records — see W-2.)*
**Acceptance:** A test transactional email delivered to an external inbox landing in primary (not spam); SPF/DKIM/DMARC documented as configured for the sending domain. **Size:** S · **Deps:** W-2 · **Buildable** (test + verify) + William-action (DNS)

---

## P2 — polish / post-pilot hardening

### P2-1 — Partial-payment / overpayment / refund edge-case handling on the ledger *(QA / Treasurer)*
**Why:** Real owners underpay, overpay, and occasionally need refunds. Confirm the ledger + reconcile logic handles these without leaving orphaned unmatched amounts (overpayment → credit balance; partial → remaining due; refund → reversing entry).
**Acceptance:** Tests covering partial / over / refund against an owner ledger; correct resulting balances. **Size:** M · **Deps:** P0-1 · **Buildable**

### P2-2 — Mobile/responsive pass on the owner portal money screens *(QA / Customer)*
**Why:** Owners will check their balance and pay from a phone. There's a `verify:mobile` script but no confirmation the balance/pay/statement screens are clean on small viewports.
**Acceptance:** Owner portal balance + pay + statement screens verified responsive (run `verify:mobile` + manual spot-check). **Size:** S · **Deps:** P0-3 · **Buildable**

### P2-3 — Document storage surface for HOA governing docs *(PM)*
**Why:** A self-managed board needs to store bylaws, CC&Rs, meeting minutes, insurance certs. `documents.tsx` exists; confirm it's owner-accessible and covers the day-one document set. Not on the money path, so P2.
**Acceptance:** Board can upload + owners can view the core governing-doc set; access-controlled. **Size:** S · **Deps:** none · **Buildable**

### P2-4 — Announcements / communications to all owners verified end-to-end *(PM / Treasurer)*
**Why:** "Send a dues reminder to all owners" is a core treasurer job. Community announcements + bulk-email plumbing exist; confirm the all-owners send actually delivers and respects consent/unsubscribe.
**Acceptance:** A test announcement → email to all CHC owners delivered; consent/opt-out respected. **Size:** S · **Deps:** W-2, P1-8 · **Buildable**

### P2-5 — Reconciliation "month-close" workflow for the treasurer *(Treasurer)*
**Why:** A treasurer closes the books monthly: confirm all bank transactions matched, flag stragglers, lock the period. No explicit month-close exists — reconciliation is transaction-by-transaction.
**Acceptance:** A "close month" view showing unmatched count + a one-action attestation that the period is reconciled. **Size:** M · **Deps:** P0-4 · **Buildable**

---

## William-action items (credential / signup / external — NOT buildable)

> Each is filed as a `[William action]` issue, not as buildable work.

- **W-1 — Plaid production access** *(already surfaced by William).* Sandbox → production approval so real CHC bank data flows. Gate A.4 dep.
- **W-2 — Transactional email production setup.** Confirm sending domain + SPF/DKIM/DMARC DNS records + provider credentials (SMTP/Gmail or Resend per gate B.5). Unblocks P0-2, P1-6, P1-8, P2-4.
- **W-3 — Stripe Connect platform onboarding live + CHC connected account** (gates A.1/A.5). Confirm the CHC association has a connected Stripe account so payments route. (May already be done — verify.)
- **W-4 — Set `SENTRY_DSN` (+ GA4 ID) as Fly secrets.** Unblocks P1-1 (gate E.1/E.2).
- **W-5 — Confirm Neon migration complete + destroy the old single-node Fly Postgres.** Removes the crashed-DB fragility and stops any residual billing. (Newly surfaced here — flag to William.)
- **W-6 — CT CIOA compliance + security baseline attestation** (gates E.4/E.5, manual). Legal/compliance sign-off William owns. (Pre-existing, lower urgency for the pilot-of-one.)

---

## Cross-reference to go-live gates (`server/services/go-live-checks.ts`)

| Gate | Status driver | Queue item |
|---|---|---|
| A.6/A.7/A.8 (test + first real payment) | manual, unverified | **P0-1** |
| B.2/B.3 (owner balance + login+pay) | manual, unverified | **P0-1, P1-6** |
| B.5 (email infra) | auto | **W-2, P1-8** |
| E.1/E.2 (Sentry/GA4) | auto, needs DSN | **P1-1, W-4** |
| E.4/E.5 (CIOA/security) | manual | **W-6, P1-7** |
| F.2/F.3 (wizard tested / board walkthrough) | manual | **P0-1, P1-6** |

---

## Summary counts

- **P0:** 4 · **P1:** 8 · **P2:** 5 · **William-actions:** 6
- **Total buildable issues to file:** 17 (P0-1..4, P1-1..8, P2-1..5) + 6 William-action = within the ~20 cap.
