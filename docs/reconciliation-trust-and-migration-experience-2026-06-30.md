# YCM Reconciliation — Trust / Verification Layer + Migration Experience — Design

**Product:** YourCondoManager (YCM) · **Association:** Cherry Hill Court (CHC)
**Date:** 2026-06-30 · **Status:** DESIGN (not built) — scope for William to react to and ratify
**Scope:** Plan/design only. No code changed, no deploy. Read-only on the live codebase.
**Builds on (does NOT duplicate):**
- `docs/reconciliation-logistics-and-retroactive-plan-2026-06-30.md` (PR #318) — the reconciliation data model, the retroactive catch-up, the two history paths (feed pull + statement upload).
- `docs/financial-completeness-and-quickbooks-migration-2026-06-30.md` (PR #319) — the gap audit (expenses→GL is the #1 gap) + QuickBooks migration scope.

> This doc adds the layer those two don't fully cover: **the end-to-end migration EXPERIENCE** (one coherent onboarding journey) and **the TRUST / VERIFICATION mechanism** — how the system PROVES the books are fully and correctly reconciled, so William isn't trusting a green checkmark. Where the prior docs already settled something (the data model, the catch-up steps, the QB importer scope), this doc references it and moves on.

---

## 3-bullet plain summary

1. **The migration experience is ONE flow with five stops:** connect the bank → bring in history (feed pull + statement/QuickBooks upload) → set the opening balance → auto-match → resolve the leftovers → **"You're reconciled."** Today YCM has the *pieces* (Plaid feed, auto-matcher, owner-suggestion path, a 4-tab admin page) but they're separate surfaces a treasurer has to stitch together. The new value is wiring them into a single guided journey with a clear finish line.
2. **The trust mechanism is "prove it, don't claim it" — five proofs, no green checkmark on faith.** The word "reconciled" is only allowed to appear when: (a) the ledger ties to the bank balance **to the penny** (reuse the existing `reconcileFromOwnerLedger` cent-gate), (b) the exception count is **literally zero** (the real-state signal, never a proxy), (c) every unmatched/uncategorized transaction is listed with its **dollar impact**, (d) an **independent tie-out** anyone can run shows ledger total = bank total = sum of categorized transactions, and (e) every match/categorization/adjustment is in an **append-only audit trail** (who/what/when) a board or auditor can review. Most of these primitives already exist in code — the work is surfacing them as the verification experience.
3. **Decisions for William (in §6):** the penny-tie definition for a NEW account (no prior balance to tie to), how to treat "deliberately ignored" transactions in the zero-exception count, who can mark a period "closed/locked," whether owners ever see a reconciliation badge, and the cadence + artifact for William's own review.

---

## 0. One correction carried forward (live-state check)

Per PR #318's correction: the live bank-feed provider is **Plaid**, not Stripe Financial Connections (`server/services/bank-feed/index.ts` → `new PlaidProvider()`; no Stripe FC code in the repo). This design is provider-agnostic behind the `BankFeedProvider` interface, so "pull history + balances + match" holds either way — but every "bank balance" reference below means the balance Plaid reports for CHC's Chase connection. Flagging so the trust math rests on what's actually wired.

---

## Part A — The Migration EXPERIENCE (one coherent onboarding flow)

### A.1 The problem with today's surfaces

The capability exists but is scattered. A treasurer today would have to: connect Plaid somewhere, know to force a history backfill, open `/admin/reconciliation`, run auto-match on one tab, read the report on another, find owner suggestions on a third, and have no single place that says "you are now reconciled." There is **no opening-balance step, no QuickBooks/statement on-ramp wired into the same flow, and no finish line.** The migration experience is the missing connective tissue.

### A.2 The five-stop journey (the new guided flow)

One linear wizard — **"Get your books reconciled"** — that a treasurer/PM completes once at onboarding, with a persistent progress indicator. Each stop reuses an existing capability; the wizard is the orchestration + the finish line.

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  STOP 1 — CONNECT THE BANK                                                 │
 │  Plaid OAuth link to the Chase operating (and reserve) account.           │
 │  Reuse: the live Plaid Link flow (#278). On connect, force the cursor-null │
 │  backfill so the MAX available history lands in bank_transactions.        │
 │  Finish signal: "Connected — N transactions, <date> → <date> available."  │
 └──────────────────────────────────────────────────────────────────────────┘
                                   ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  STOP 2 — BRING IN HISTORY (the three on-ramps, one destination)          │
 │  (a) FEED PULL  — what Plaid returned (Path A, PR #318). Automatic.        │
 │  (b) STATEMENTS — upload prior bank statements for history older than the  │
 │      feed reaches (Path B / Retroactive Upload, PR #318 §3b — FUTURE).     │
 │  (c) QUICKBOOKS — upload QB chart + trial balance + open A/R-A/P + (opt)   │
 │      journal (PR #319 Part 2 — FUTURE; shares the SAME ingestion spine).   │
 │  All three converge on ONE categorize-the-leftovers worklist and MUST     │
 │  de-dupe against each other (PR #318 §3b dedupe rule).                     │
 │  Finish signal: "History loaded from <sources>; N transactions to review." │
 └──────────────────────────────────────────────────────────────────────────┘
                                   ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  STOP 3 — SET THE OPENING BALANCE (the baseline)                          │
 │  Establish "the books start HERE." For CHC (cleared seed/test data, real  │
 │  books start now) this is the clean cutover. Reuse the stubbed            │
 │  opening_balance GlSourceType (posting.ts). QuickBooks trial balance, if   │
 │  uploaded at Stop 2, posts the balanced opening journal here.             │
 │  This is the anchor the penny-tie measures against (see Part B).          │
 │  Finish signal: "Opening balance set as of <date>: $X (ties to QB / bank)."│
 └──────────────────────────────────────────────────────────────────────────┘
                                   ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  STOP 4 — AUTO-MATCH (the machine does the bulk)                          │
 │  Run runAutoMatch over the full pulled span (catch-up wide pass, PR #318  │
 │  §3 Step 2). Owner-payment credits auto-match ≥0.85 confidence; learned    │
 │  descriptor aliases auto-match at 0.99; name-in-descriptor credits become  │
 │  one-click owner suggestions.                                             │
 │  Finish signal: "Auto-matched M of N (X%). K left to review."             │
 └──────────────────────────────────────────────────────────────────────────┘
                                   ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  STOP 5 — RESOLVE THE LEFTOVERS → "YOU'RE RECONCILED"                     │
 │  The categorize-the-leftovers worklist (PR #318 §3 Step 3): each remaining │
 │  transaction sorted to dues / special assessment / expense / transfer /    │
 │  other-ignore. The EXCEPTION list shrinks to zero as you go.              │
 │  The finish line is GATED by Part B's five proofs — the wizard cannot      │
 │  declare "reconciled" until the penny-tie passes AND exceptions = 0 (or    │
 │  every residual is an explicitly-acknowledged, dollar-quantified ignore).  │
 │  Finish signal: the Trust Panel (Part B) flips to "Fully reconciled."      │
 └──────────────────────────────────────────────────────────────────────────┘
```

### A.3 Automatic vs. human — what to expect at Stop 4/5

This sets honest expectations (and is itself a trust signal — over-promising "it's all automatic" then surfacing 200 exceptions erodes trust).

| Bucket | How it resolves | Roughly |
|---|---|---|
| Owner dues payment, clean (exact amount + name in descriptor) | **Auto-matched**, no human touch (≥0.85) | the majority of recurring-dues activity |
| Repeat payer already learned (descriptor alias) | **Auto-matched at 0.99** on the 2nd+ occurrence | grows over time → less manual each cycle |
| Owner payment, name-in-descriptor, no recorded entry yet | **One-click suggestion** ("Create + match") | a click each, conservative auto-create only ≥0.95 |
| Ambiguous (two owners, same amount/day) | **Manual review** — never auto (conflict rule) | rare; protects against false matches |
| **Expense / vendor payment (debit out)** | **Manual categorize** — NEW path (no auto today; matcher is credit-only per PR #318) | every expense until expenses→GL ships (PR #319 Gap #1) |
| **Transfer (operating↔reserve)** | **Manual categorize** — NEW path | a handful |
| Truly other / one-off (interest, refund) | **Manual categorize or "ignore"** (NEW state) | a handful |

**The honest line for William:** incoming owner dues largely auto-reconcile and get *better* every cycle (alias learning). The **outgoing/expense half is manual until expenses→GL lands (PR #319's #1 priority)** — and until then a "fully reconciled" claim that includes the expense side is only true because a human categorized each debit. The trust layer must make that distinction visible, not paper over it.

### A.4 Staying reconciled (the ongoing loop, not just onboarding)

Onboarding is the one-time catch-up; the recurring cycle keeps it true:

- The feed syncs (cursor-based, `bank-feed-sync.ts`); `runAutoMatch` runs idempotently on each new batch.
- A **monthly close**: each period, the treasurer clears the new exceptions, the penny-tie re-runs for the period, and the period is marked **closed** (Part B's period-lock). A closed period's audit trail is the defensible record.
- The Trust Panel always shows the *current* real state — "Fully reconciled through <last-closed-month>; N open exceptions in the current month."

---

## Part B — The TRUST / VERIFICATION Layer (the core ask)

> William's exact concern: *"I want to make sure it is FULLY reconciled and actually doing well and properly capturing it. How do we TRUST it? How do we VERIFY?"*

The answer is a discipline, not a checkmark: **the system must PROVE reconciliation with independent, inspectable evidence — and "reconciled" is a computed verdict, never a label an agent or a status field sets on faith.** This is the [outcome-over-proxy] principle applied to money: show the TRUE reconciled state (ties to the penny, zero real exceptions), never a proxy ("auto-match ran," "looks done," "no errors thrown").

Below: what "reconciled + trusted" concretely MEANS (B.1 — the acceptance criteria), the five proofs (B.2), and how a third party verifies it (B.3). Crucially, **most of these primitives already exist in the code** — the build is surfacing them as one verification experience.

### B.1 Definition — what "reconciled + trusted" concretely MEANS (the acceptance criteria)

A period (or the whole book) is **"reconciled + trusted"** if and only if ALL of:

1. **Ties to the penny.** The GL/ledger balance equals the bank's reported balance for the account, **difference = 0 cents** — computed by the pure `reconcileFromOwnerLedger` core (which already asserts owner-ledger balance − GL Accounts-Receivable = 0 to the cent, and validates double-entry invariants). For a full bank tie, this extends to: GL cash account balance = bank-reported balance (the extension the expenses→GL work, PR #319 #1, enables).
2. **Zero unexplained exceptions.** Every bank transaction in the period is either **matched** to a recorded entry or **deliberately categorized** (including an explicit "ignore" with a reason). Count of *unexplained* (neither matched nor categorized) = **0**. (See D2 for how acknowledged "ignores" count.)
3. **Both directions clear.** No "recorded-but-not-in-bank" entry left dangling (class (b) exceptions, PR #318 §2) AND no "in-bank-but-not-recorded" transaction left uncategorized (class (a)). Reconciliation is symmetric.
4. **Double-entry holds.** Σdebits = Σcredits, interfund nets to zero, integer cents — the invariants `validateInvariants` already checks. A book that doesn't balance internally can never be "reconciled."
5. **Evidenced + reviewable.** Every state change that produced the above is in the append-only audit trail (B.2 proof 5), so the verdict is reproducible and defensible.

If any of 1–5 fails, the verdict is **NOT "reconciled"** — it is "N exceptions, $X impact" with the specifics surfaced. There is no in-between "mostly reconciled" badge; the gate is binary and honest.

### B.2 The five proofs (the verification mechanism)

#### Proof 1 — The reconcile-to-the-penny gate (REUSE — already built)

**What it is:** the books only earn "reconciled" if the ledger ties to the bank balance to the cent. **This already exists:** `server/services/gl/reconcile.ts` `reconcileFromOwnerLedger()` returns `{ ok, ownerLedgerBalanceCents, glAccountsReceivableCents, differenceCents, invariantViolations }` and `ok` is true **only when invariants are clean AND `differenceCents === 0`**. The GL won't even turn on for an association unless this passes (`runtime-sync.ts` "RECONCILE-TO-CENT GATED" guarantee #3).

**What's new:** today the cent-gate ties the *internal* GL to the *owner ledger* (two internal views agreeing). The trust layer extends it to tie the **GL cash account to the bank-reported balance** — the external reality check. That extension rides on PR #319's expenses→GL work (you can't tie cash to the bank until outflows post to the GL cash account). Until then: surface the *internal* penny-tie now (it's real and reassuring), and label the bank-balance tie as "available once the expense side posts."

**The trust value:** a single number — `differenceCents` — that MUST be 0. William can look at one figure and know the books tie out, and the figure is computed by a pure, tested function, not asserted by a status field.

#### Proof 2 — The "Fully reconciled · 0 exceptions" health indicator (the real-state signal)

**What it is:** one prominent indicator — the **Trust Panel** at the top of `/admin/reconciliation` — that shows the **true** reconciled state, computed live, never a stored boolean:

```
 ┌─────────────────────────────────────────────────────────────┐
 │  ✅  FULLY RECONCILED · 0 exceptions                         │
 │  Ledger ties to bank to the penny (difference: $0.00)       │
 │  Through: May 2026 (closed)  ·  Current month: 0 open        │
 └─────────────────────────────────────────────────────────────┘
            — OR, when not clean (the honest state) —
 ┌─────────────────────────────────────────────────────────────┐
 │  ⚠️  7 EXCEPTIONS · $4,210.00 unreconciled                   │
 │  • 4 bank transactions uncategorized      $3,100.00         │
 │  • 2 recorded payments with no bank match    $910.00        │
 │  • 1 amount mismatch                         $200.00        │
 │  Penny-tie: OFF by $4,210.00  →  not reconciled             │
 │  [ Review exceptions ]                                       │
 └─────────────────────────────────────────────────────────────┘
```

**The anti-proxy rule (load-bearing):** the indicator is computed **every render** from the live data — count of unexplained exceptions + `reconcileFromOwnerLedger().ok` — and is **forbidden from being a cached/stored "isReconciled" flag.** A green panel means the count is *actually* zero and the tie *actually* passes this moment, not that someone once marked it done. (The reconciliation report's `totals.gapCents`, `unmatchedBankTxCount`, `unmatchedLedgerEntryCount` already produce these live numbers — `report.ts`.) This is the difference between "trust the checkmark" and "the checkmark is the live truth."

#### Proof 3 — The exception report (every gap, with dollar impact)

**What it is:** a single list of **everything** standing between the current state and "fully reconciled," each row with its **dollar impact** — so "7 exceptions" is never abstract:

| Type | Transaction | Amount | Why it's an exception | Action |
|---|---|---|---|---|
| Uncategorized bank deposit | 05/12 · ZELLE 8821 | $300.00 | No recorded entry explains it | Categorize ▾ |
| Uncategorized bank debit | 05/03 · CHECK 1043 | $1,800.00 | Expense not recorded | Categorize ▾ |
| Recorded, no bank match | 05/09 · Unit 12 payment | $910.00 | We say paid; no bank evidence | Investigate ▾ |
| Amount mismatch | 05/20 · Unit 4 | Δ $200.00 | Recorded $500, bank shows $300 | Reconcile ▾ |

`Σ |dollar impact|` = the exact amount by which the books are NOT yet reconciled, and it equals Proof 1's `differenceCents`. **The two proofs reconcile to each other** — the exception list explains, line by line, the penny-tie gap. That cross-check is itself a trust property: if the exception list sums to the tie-gap, the system is internally consistent.

**Mostly built:** `report.ts` already returns `unmatchedBankTransactions[]` and `unmatchedLedgerEntries[]`. New work: add the **dollar-impact column**, the **debit/expense + mismatch classes** (depends on PR #318's non-credit categorize paths + PR #319 expenses→GL), and the "sum of exceptions = tie-gap" assertion.

#### Proof 4 — The independent tie-out (anyone can re-derive it)

**What it is:** a one-screen, self-checking statement a treasurer / William / an auditor can run that proves three totals agree **three independent ways**:

```
  INDEPENDENT TIE-OUT — <period>
  ────────────────────────────────────────────────────────────
  (1) Ledger total (sum of recorded entries)        $ 48,200.00
  (2) Bank total (sum of bank transactions)         $ 48,200.00
  (3) Sum of categorized transactions               $ 48,200.00
  ────────────────────────────────────────────────────────────
  (1) = (2) = (3)   ✅  TIES OUT
  Penny difference: $0.00
```

Plus a **side-by-side bank-statement-vs-system view**: the bank's transactions in one column, the system's matched entries in the other, line for line, so a human can scan and confirm "yes, every line on my Chase statement is here and accounted for." This is the manual auditor check, made native.

**The trust value:** it's *independent* — three different computations (the ledger sum, the raw bank sum, the categorized-transaction sum) arriving at the same number. A bug in one path won't agree with the other two. This is the "don't trust one computation, triangulate" property, and it's exactly how a human accountant proves a reconciliation by hand. **New build** (the three-way tie-out screen + side-by-side), reusing existing sums.

#### Proof 5 — The audit trail (who / what / when — REUSE, already built)

**What it is:** every match, categorization, adjustment, suggestion-accept, and reconciliation run is logged append-only with actor + timestamp + before/after — so the reconciled state is **reviewable and defensible**, not a black box. **This already exists:** `server/routes/admin-reconciliation.ts` writes to `auditLogs` on every match/manual action (lines 146, 240, 357) and the audit-log tab reads them back (`entityType: "owner_ledger_entry"` + `"reconciliation"`, actions prefixed `reconciliation.*`). `audit_logs` is in `shared/schema.ts`.

**What's new:** extend the same logging to the **new** categorize-expense / categorize-transfer / mark-ignore / set-opening-balance / period-close actions (so the catch-up and migration steps are equally traceable), and add the audit trail as a **first-class trust artifact** (exportable, filterable by period) rather than just a debug tab. An auditor's first question is "show me who changed what" — proof 5 answers it.

### B.3 How a third party (auditor / board) verifies it

The five proofs are designed so a non-builder can independently confirm reconciliation without trusting YCM's word:

1. **The board member / auditor opens the Trust Panel** → sees "Fully reconciled · 0 exceptions · ties to the penny," computed live (Proof 2).
2. **They run the independent tie-out** (Proof 4) → ledger = bank = categorized, three ways, to the penny. They can compare the side-by-side against their own copy of the Chase statement.
3. **They scan the exception report** (Proof 3) → it's empty (or every residual is an explicitly acknowledged, dollar-quantified ignore with a reason).
4. **They review the audit trail** (Proof 5) → every entry that produced the reconciled state has an actor + timestamp; nothing was changed without a record.
5. **They export the board packet** → balance sheet + reconciliation statement + exception report (empty) + audit trail for the period, as a PDF, for the minutes.

**The defensibility claim:** a closed, locked period whose tie-out passes, whose exception list is empty, and whose audit trail is complete is a reconciliation an external accountant can sign off on — because every assertion is independently re-derivable from the underlying transactions, not taken on faith.

### B.4 Why this is "trust," not "a checkmark" — the design rules

The whole point is that William asked *"how do we TRUST it?"* — so the design encodes anti-trust-erosion rules:

- **Verdict is computed, never stored.** "Reconciled" is `reconcile.ok && exceptionCount === 0`, evaluated live. There is no `isReconciled` column to drift (per [outcome-over-proxy]).
- **Binary + honest.** Either it ties to the penny with zero exceptions, or it shows the exact gap and the exact list. No "mostly reconciled," no rounding, no "~done."
- **Every number cross-checks another.** Penny-tie gap = sum of exception impacts = (ledger − bank) in the tie-out. Three independent paths must agree; disagreement is itself surfaced as an error.
- **The expense-half caveat is visible, not hidden.** Until expenses→GL ships (PR #319 #1), the bank-balance tie only covers the deposit side; the panel says so rather than claiming a full bank reconciliation it can't yet prove.
- **Nothing irreversible is silent.** Categorize/ignore/adjust are all logged + reversible; the audit trail is the proof of what happened.

---

## Part C — How + when William reviews this (the reviewable artifact)

**The artifact:** a **"Reconciliation Health" board view** (the Trust Panel, exportable as a one-page **Board Packet PDF**) that William opens to review CHC's reconciliation status WITH the treasurer. Proposed concretely:

- **Surface:** a top-of-page Trust Panel on `/admin/reconciliation` (always-live), plus an **"Export reconciliation statement (PDF)"** action that produces the board-packet (Trust Panel + tie-out + exception report + audit-trail summary for the period).
- **Cadence:** William reviews at the **monthly close** — after the treasurer clears the month's exceptions, the period-close runs the penny-tie, and the closed-period packet is the reviewable artifact. (And on-demand any time he wants the current real state.)
- **What he sees in 10 seconds:** the headline ("Fully reconciled · 0 exceptions" or "N exceptions · $X"), the penny difference, and which period is closed-through. WHAT-it-means, not HOW-it-works.
- **Self-orienting:** the packet carries the context — which account, which period, what "reconciled" means here — so William isn't relying on memory of the mechanism.

This composes with the existing admin-hub / artifact-freshness discipline: the latest closed-period packet is the current artifact; superseded ones archive.

---

## Part D — Decisions for William (these need your call — I have NOT decided them)

| # | Decision | Options | Notes / lean |
|---|---|---|---|
| **D1** | **Penny-tie baseline for a NEW account** | (a) tie to bank-reported **balance as of the opening date** (the opening balance IS the anchor) · (b) tie only the *internal* GL↔owner-ledger now, add the bank-balance tie when expenses→GL ships | CHC has no prior reconciled balance to tie to (cleared seed data). The clean answer: the **opening balance** set at Stop 3 is the anchor, and the penny-tie measures every transaction *after* it. Lean **(a)** for the anchor + surface the *internal* tie now, **bank-balance tie when PR #319 #1 lands** (you can't tie cash to the bank until outflows post). |
| **D2** | **How "deliberately ignored" transactions count toward "0 exceptions"** | (a) an acknowledged "ignore" (with a reason) counts as **resolved** → still "0 exceptions" · (b) ignores are shown separately ("0 exceptions · 3 acknowledged ignores") so they're never invisible · (c) ignores keep the count non-zero until reviewed by a second person | Lean **(b)**: an ignore is resolved enough to not block "reconciled," but it must stay **visible + dollar-quantified** so an auditor sees what was set aside and why. Hiding ignores inside "0 exceptions" is the proxy trap. |
| **D3** | **Who can mark a period "closed / locked"** | (a) any reconciliation admin · (b) treasurer-role only · (c) two-person (treasurer marks, a second admin confirms) | Closing a period freezes its audit trail as the defensible record. Lean **(b)** for CHC's scale; **(c)** is the stronger-governance option if William wants board-grade segregation of duties. (The `RECON_ROLES` gate already exists.) |
| **D4** | **Do owners ever see a reconciliation signal?** | (a) no — reconciliation is admin/treasurer-only (status quo) · (b) owners see only their OWN settled/unsettled state on their statement · (c) a building-level "books reconciled through <month>" badge owners can see | Lean **(a)/(b)**: owners shouldn't see association-level exception counts, but "your payment cleared / is pending" on their own statement is reasonable trust for them. A public "reconciled" badge (c) is a bigger trust-and-liability call — surfaced for William. |
| **D5** | **The review cadence + artifact** | (a) monthly-close packet (PDF) is the canonical review artifact · (b) live Trust Panel only, no PDF · (c) both | Lean **(c)**: live panel for any-time truth + a monthly closed-period PDF for the board minutes (the defensible record). Depends on the native-PDF-export gap (PR #319 #12 — board statements don't export natively yet). |
| **D6** | **Sequencing vs. the expenses→GL blocker** | (a) ship the trust layer NOW on the deposit side (internal tie + owner-payment exceptions), expense-half "coming" · (b) wait for expenses→GL (PR #319 #1) so the FIRST trust panel covers the full bank | Lean **(a)**: the deposit-side trust (penny-tie internal, exception report, audit trail, tie-out for owner payments) is real and valuable today and honestly labels the expense half as pending. Don't gate all trust on the biggest build. |

---

## Part E — Net-new vs. reuse (honest completeness)

| Trust/experience piece | State |
|---|---|
| Reconcile-to-the-penny gate (`differenceCents`, invariants) | **BUILT** — `reconcile.ts` `reconcileFromOwnerLedger`; gates GL flip in `runtime-sync.ts` |
| Live exception numbers (gap, unmatched bank, unmatched ledger) | **BUILT** — `report.ts` `totals` |
| Audit trail (who/what/when, append-only) | **BUILT** — `auditLogs` writes/reads in `admin-reconciliation.ts` |
| Confidence-scored auto-match + alias learning + owner suggestions | **BUILT** — `auto-matcher.ts` |
| Bank-balance penny-tie (cash account ↔ bank) | **DEPENDS** — needs expenses→GL (PR #319 #1) for the cash side |
| **Trust Panel** ("fully reconciled · 0 exceptions", live-computed, anti-proxy) | **NET-NEW** — top-of-page indicator over existing numbers |
| **Exception report with dollar impact + debit/mismatch classes** | **NET-NEW** — extends `report.ts` lists; non-credit classes depend on PR #318 categorize paths |
| **Independent three-way tie-out + side-by-side bank view** | **NET-NEW** — new screen over existing sums |
| **Migration wizard (5-stop guided flow + finish line)** | **NET-NEW** — orchestration over existing capabilities |
| **Opening-balance step in the flow** | **NET-NEW (stub exists)** — `opening_balance` GlSourceType stubbed in `posting.ts` |
| **Period close / lock + closed-period packet PDF** | **NET-NEW** — PDF export is also PR #319 #12 gap |
| Statement-upload + QuickBooks on-ramps into Stop 2 | **FUTURE** — PR #318 §3b + PR #319 Part 2 (shared ingestion spine) |

---

## Part F — Sequencing (proposed, for reaction — not a build order)

1. **Decide D1–D6** with William.
2. **Build the Trust Panel + live "reconciled" verdict** (Proof 2) over the existing report numbers — the highest-value, lowest-cost trust win; honestly labels the expense half pending (D6 lean (a)).
3. **Build the exception report with dollar impact** (Proof 3) and assert "sum of exceptions = penny-tie gap."
4. **Build the independent three-way tie-out + side-by-side bank view** (Proof 4).
5. **Extend the audit trail** to the new categorize/ignore/opening-balance/close actions (Proof 5) + make it an exportable trust artifact.
6. **Build the 5-stop migration wizard** (Part A) wiring connect → history → opening balance → auto-match → resolve → "reconciled," with the finish line gated by the five proofs.
7. **Ship expenses→GL (PR #319 #1)** → flip on the **bank-balance penny-tie** so the trust panel covers the full bank, not just deposits.
8. **Add the QuickBooks + statement on-ramps to Stop 2** (PR #318 §3b + PR #319 Part 2, one ingestion engine) + the closed-period board-packet PDF.

---

## Appendix — files this design rests on (read, not changed)

- `server/services/gl/reconcile.ts` — `reconcileFromOwnerLedger`: the penny-tie (`differenceCents === 0` + clean invariants = `ok`). **Proof 1.**
- `server/services/gl/runtime-sync.ts` — the four hard guarantees, incl. RECONCILE-TO-CENT gate #3 (GL won't post unless the association ties to the cent).
- `server/services/gl/posting.ts` — double-entry mapping, `validateInvariants`, `opening_balance` source type stubbed (Stop 3 anchor), chart (no 5xxx expenses yet — PR #319 #1).
- `server/services/reconciliation/report.ts` — `buildReconciliationReport`: live `totals.gapCents` / `unmatchedBankTxCount` / `unmatchedLedgerEntryCount` + the two exception lists. **Proofs 2 + 3.**
- `server/services/reconciliation/auto-matcher.ts` — `runAutoMatch`, `scoreCandidate`, descriptor-alias learning, owner suggestions; credit-only (the expense gap). **Stop 4.**
- `server/routes/admin-reconciliation.ts` — the live 4-tab UI's routes; `auditLogs` writes on every match/manual action + the audit-log read tab. **Proof 5.**
- `client/src/pages/admin-reconciliation.tsx` — the 4-tab page the Trust Panel + wizard extend.
- `shared/schema.ts` — `bank_transactions`, `owner_ledger_entries`, `audit_logs`, `bank_descriptor_aliases`, GL tables.
- Prior docs (the foundation this builds on, not duplicates): `docs/reconciliation-logistics-and-retroactive-plan-2026-06-30.md` (PR #318), `docs/financial-completeness-and-quickbooks-migration-2026-06-30.md` (PR #319).
