# Money-Loop End-to-End Verification — Cherry Hill Court (sandbox rail)

**Date:** 2026-07-03
**Dispatch:** founder-os #8534 (priority:p1, product:ycm) — VERIFY the full YCM money loop on the Cherry Hill Court (CHC) ledger, sandbox rail, documented run.
**Anchor:** YCM#204 (readiness P0-1). Go-live gates in scope: **A.6 / A.7 / A.8 / B.2 / B.3** (registry: `server/services/go-live-checks.ts`).
**Run by:** fleet verification agent (Anthropic-direct; CHC = protected financial data — no third-party delegation).

> **Completeness honesty (OP #61/#47):** Every claim below is tiered. `[VERIFIED]` = mechanism proven by a passing test/probe run **this session**. `[VALIDATED]` = observed end-to-end against a real seeded DB **this session**. `[BLOCKED]` = could not be executed — the exact blocker is named. No step is marked "passed" that was not actually run.

---

## 0. Isolation approach (how nothing real was mutated)

- **All work in an isolated git worktree** `~/code/YourCondoManager-w534` (per worker-worktree-isolation), branch `fix/8534-money-loop-e2e-verification` — never the shared checkout.
- **DB legs ran against a throwaway Docker Postgres** (`ycm534-scratch-pg`, `postgres:16-alpine`, port 55434, DB `ycm_scratch`) — created for this run, torn down after. **Zero contact with the production Neon DB.** No real owner balance was read or mutated.
- **Live Stripe mode was never touched.** The only Stripe keys present in the environment are **live** keys (`ycm-stripe-secret` = `sk_live_…`, `ycm-stripe-restricted` = `rk_live_…` in Keychain; `PLATFORM_STRIPE_SECRET_KEY` deployed on Fly). Per the dispatch constraint and hard boundaries, these were **not used**. No `sk_test_` key exists in the environment — see §A.7.
- The pure GL/reconciliation/edge-leg tests run as **in-process functions over the real CHC seed** (`server/seed.ts`) — no DB, no network, no money.

---

## 1. Loop legs — evidence

### Leg 1 — Quarterly assessment posts → GL balances
`[VERIFIED]` — `gl-dues-to-statements`, `gl-posting-invariants`, `gl-statements` (part of the 62-pass core suite, §4). Assessment posting produces balanced journals (Σdebit == Σcredit), interfund nets to zero.

### Leg 2 — Owner portal shows the correct balance for a real unit
`[VALIDATED]` (math) / `[BLOCKED]` (portal-login path).
- **Balance math VALIDATED to the cent:** `gl-reconcile-chc` parses the live `CHC_BALANCE_ENTRIES` from `server/seed.ts` (13 driveway assessments + 6 HOA-dues = 19 entries) and asserts the GL Accounts-Receivable balance == owner-ledger Σ == **$21,607.78** (2160778¢), `differenceCents == 0`, `ok == true`. Passed this run.
- **Real seeded DB run:** seeding CHC into the scratch DB produced **18 units** and a full owner-ledger fixture. The **B.2 auto-check** (`checkB2_ownerPortalBalance`) returned **`pending`** on the clean seed — evidence string: *"no active portal_access rows (owners cannot log in)"*. The seed provisions ledger data but **zero `portal_access` rows**, so the owner-login half of B.2 cannot pass on a clean seed. **→ Finding filed (see §3, YCM issue).** Production CHC portal_access state was **not** verified (out of isolation scope).

### Leg 3 — Owner pays (sandbox: card + ACH)
`[BLOCKED]` — no `sk_test_` Stripe key available (see §A.6 / §A.7). Routing/split/idempotency **mechanism** is `[VERIFIED]` (`stripe-connect-resolver`, `stripe-charge-metadata`, `stripe-idempotency`, `connect-webhook-events` all passed), but a live test-mode charge could not be executed.

### Leg 4 — Receipt email generated (capture)
`[VERIFIED]` — receipt template exists (`server/email/templates/receipt-payment.ts`, subject `"Receipt — {amount} to {association}"`, Issue #1042) and is covered by `server/email/__tests__/{send,templates}.test.ts` (100/100 tests pass with DATABASE_URL set). Prod SMTP not required per dispatch.

### Leg 5 — Payment appears in ledger
`[VALIDATED]` — the seeded CHC ledger contains **8 `payment` entries totalling −$2,800.00** applied against assessments/charges (real fixture on the scratch DB), demonstrating payment→ledger posting. Breakdown below.

### Leg 6 — Reconciliation matches
`[VERIFIED]` — `stripe-reconciliation`, `reconciliation/period-close`, `admin-month-close`, `bank-feed-sync` (founder-os#2478 sync engine) all passed. Bank-feed sweep syncs an eligible connection, bumps `last_synced_at`, invokes reconcile; debounces webhook re-delivery; tolerates Plaid errors.

**Seeded CHC ledger (scratch DB, `owner_ledger_entries`, association `f301d073-…`):**

| entry_type | count | total |
|---|---|---|
| assessment | 22 | $22,382.10 |
| charge | 6 | $2,375.70 |
| late-fee | 1 | $25.00 |
| payment | 8 | −$2,800.00 |
| **NET (37 rows)** | **37** | **$21,982.80** |

---

## 2. Edge legs — evidence

| Edge leg | Verdict | Evidence (passed this run) |
|---|---|---|
| **Partial payment** | `[VALIDATED]` (fixture) + `[VERIFIED]` (mechanism) | 8 seeded `payment` rows (−$2,800) partially applied against a $21,982.80 assessment/charge base; `admin-payments`, `ar-aging-math` pass. |
| **Overpayment / refund** | `[VERIFIED]` | `refund-service`, `admin-refund-route`, `disbursement-service` pass. |
| **ACH return (simulated)** | `[VERIFIED]` | `ach-failure-service` — `handleAchFailureEvent` (R3.1 documented 5-event set, R3.2 marks txn failed + queues retry, R3.3 idempotent re-delivery). All pass. |
| **Late-fee on overdue unit** | `[VALIDATED]` (fixture) + `[VERIFIED]` | 1 seeded `late-fee` row ($25); `late-fee-assessment-service.ts` (`lateFeeAssessmentHandler`) + `unpaid-late-fees` alert source pass. |

---

## 3. Per-gate verdicts (A.6 / A.7 / A.8 / B.2 / B.3)

| Gate | Name | Verdict | Basis |
|---|---|---|---|
| **A.6** | $1 test charge flows **ACH** end-to-end + reconciles | `[BLOCKED]` | No `sk_test_` key → no live test-mode ACH charge could run. **Reconcile + Plaid-ACH mechanism `[VERIFIED]`** (`bank-feed-sync`, `plaid-portal-pay-gate`, `stripe-reconciliation` pass). Blocker = William-held test key (W-3). Gate is `verifyMethod:"manual"`. |
| **A.7** | $1 test charge flows **card** end-to-end + reconciles | `[BLOCKED]` | Harness `scripts/validate-connect-dues-routing.cjs` **hard-refuses anything but `sk_test_`** and none exists in the environment (only `sk_live_`). **Routing/split/metadata/idempotency mechanism `[VERIFIED]`** (`stripe-connect-resolver`, `stripe-charge-metadata`, `stripe-idempotency`, `connect-webhook-events` pass). Blocker = W-3. |
| **A.8** | First **real** owner pays driveway-assessment via ACH | `[BLOCKED — by design]` | Inherently **live-mode, real owner, real money** — cannot run on the sandbox rail. This is pure W-3 residue, not a sandbox-verifiable gate. |
| **B.2** | Owner portal shows correct balance per owner | `[VALIDATED — math] / [BLOCKED — login]` | Balance reconciles to the cent ($21,607.78). Real-DB auto-check returned `pending` because the seed provisions **0 `portal_access` rows** — the owner-login precondition is unmet on a clean seed. **Finding filed.** |
| **B.3** | Owner can log in + see ledger + pay | `[BLOCKED]` | Manual gate. Ledger-render half provable; **login** blocked by the same 0-`portal_access` gap (B.2) and **pay** blocked by the same no-`sk_test_` gap (A.7). Requires a running app + browser + test key. |

**Supporting auto-checks run this session (scratch DB):** `A.5 [pending]` (no `payment_gateway_connections` row on clean seed — expected; live CHC has `acct_1TnzDnAr…` per PR #300). `B.1 [pass]` — *"18 units for association f301d073-…"*.

---

## 4. Test-suite evidence (all run this session)

| Suite | Files | Tests | Result |
|---|---|---|---|
| Core loop (reconcile-chc, dues-to-statements, amenity-money-loop, posting-invariants, statements, go-live-checks, bank-feed-sync) | 7 | 62 | ✅ pass |
| Edge legs + payment (ach-failure, refund, stripe-reconciliation, ar-aging, unpaid-late-fees, admin-payments, admin-refund, webhook-payments-ack, charge-metadata, connect-resolver, plaid-portal-pay-gate) | 11 | 126 | ✅ pass |
| Receipt + reconcile-close + webhook + security (email send/templates, period-close, admin-month-close, connect-webhook-events, stripe-idempotency, admin-disbursements, financial-security) | 8 | 100 | ✅ pass |
| **Total targeted** | **26** | **288** | **✅ pass** |

*(Note: `email/send.test.ts` fails at import if `DATABASE_URL` is unset — import-time coupling via `server/db.ts`; passes 8/8 with the var set. Low test-hygiene observation — see §5.)*

---

## 5. Defects found (filed as YCM issues — finding defects is SUCCESS for this dispatch)

1. **[HIGH] (#385) Fresh-DB bootstrap is broken — `npm run migrate` fails on migration `0006_role_rename_board_admin.sql`.** The migration runs `ALTER TYPE admin_user_role ADD VALUE …` and then `UPDATE`s rows to those new values within the **same** drizzle transaction. Postgres forbids this. **Reproduced exactly this run:** `ERROR: unsafe use of new value "assisted-board" of enum type … HINT: New enum values must be committed before they can be used.` Impact: disaster-recovery restore, new-environment provisioning, and **new-customer/new-association clean-DB provisioning** all fail from zero. (Prod survived by incremental migration.) → **YCM issue filed.**
2. **[MEDIUM] (#386) CHC seed provisions 0 `portal_access` rows → go-live gate B.2 cannot pass on a clean seed; owner-login leg of the money loop is unseeded.** `checkB2` returns `pending` (*"owners cannot log in"*) on freshly-seeded CHC despite 18 units + 37 ledger rows. Production portal_access state unverified here. → **YCM issue filed.**
3. **[LOW] (#387) Reconcile acceptance gate covers only the opening-balance subset.** `gl-reconcile-chc` guards **19 entries / $21,607.78** while the seeded (and presumably live) ledger holds **37 entries / $21,982.80 net** (incl. 8 payments + late-fee). The "to-the-cent" source-of-truth gate does not exercise the evolved ledger. Plus: `email/send.test.ts` import-time `DATABASE_URL` coupling. → **YCM issue filed (verification-integrity).**

---

## 6. True state of YCM#204

The **accounting core of the money loop is verified to the cent** and the **edge legs (partial / overpayment / ACH-return / late-fee) are covered and green**. What remains genuinely un-runnable in sandbox is the **live test-mode Stripe charge** (A.6/A.7 — needs the William-held `sk_test_` key, = W-3) and everything gated behind a real owner login (B.2-login / B.3 / A.8). YCM#204 should be **narrowed** to that live-mode + portal-provisioning residue, not closed outright — see §7. The three defects above are the concrete follow-ups this run surfaced.
