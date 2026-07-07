# YCM Reconciliation Logistics + One-Time Retroactive Catch-Up — Plan / Design

**Product:** YourCondoManager (YCM) · **Association:** Cherry Hill Court (CHC)
**Date:** 2026-06-30 · **Status:** DESIGN (not built) — for William to react to and ratify
**Scope:** Plan only. No code changed, no deploy. Grounded in a read of the live codebase.

---

## TL;DR (read this first)

- **The statements are NOT fed by the bank.** They are built from what we **record** in the books (dues charged, payments received, expenses entered). The Chase bank feed is the **reality-check**: reconciliation matches each real Chase transaction to a recorded entry. Matched = confirmed. The feed corrects/validates the books; it does not become the books.
- **The retroactive catch-up is a one-time "pull the MAX history, match what we can, then categorize the leftovers" pass** — plus a **future statement-upload path** for history older than the feed can reach. Path A (now): pull the **maximum** real Chase history the feed allows (~180 days), auto-match the owner payments we can, surface the **unmatched** ones in a review screen to sort into the right account (dues, special assessment, expense, transfer, other). Path B (future): a **Retroactive Accounts-Management Upload** — you submit prior bank statements (PDF/CSV) and the system parses → categorizes → records them, for history the API can't reach (or that predates the current Chase account).
- **Two things need your decision before build:** (1) confirmed as **pull MAX** — but the Chase account is relatively **new**, so the actually-available history may be short (the feed can only return what Chase has); and (2) how the unmatched history gets categorized (you review each, vs. rules auto-sort, vs. hybrid). Plus a known reality-check: the live bank provider is **Plaid**, not Stripe — the plan works either way, but the premise should be corrected.

---

## ⚠️ One correction up front (live-state check)

The task framed the live bank-feed provider as **"the Stripe FC provider now LIVE (pulls Chase `bank_transactions` + balances)."** That is **not what the code shows.** The live provider, today, is **Plaid**:

- `server/services/bank-feed/index.ts` → `export const bankFeedProvider = new PlaidProvider()`.
- There is **no Stripe Financial Connections code anywhere** in the repo (grep returns nothing).
- Recent history is all Plaid: production-harden bank feed (#262), full OAuth Link (#278), settlement-risk close (#297).

This does **not** change the design — the bank-feed layer is **provider-agnostic** behind the `BankFeedProvider` interface (`server/services/bank-feed/provider.ts`), so "pull N days of Chase history + balances + match" holds whether the implementation is Plaid or a future Stripe FC. But the lookback math, the webhook model, and the env-flip guard below are **Plaid's**, and any "Stripe" assumption should be dropped or the provider swapped first. **Flagging so the plan rests on what's actually wired.** (If a Stripe-FC swap is intended, that is its own prerequisite project, not part of this catch-up.)

---

## 1. How the financial statements get the actual transaction data — the true model

This is the crux of the confusion, so it's worth stating precisely. There are **three layers**, and they are deliberately separate:

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │  LAYER 1 — THE BOOKS (system of record)                              │
   │  owner_ledger_entries: dues charged, payments received, credits,     │
   │  late fees, adjustments.  vendor_invoices: expenses.                 │
   │  This is what we RECORD. It is authoritative.                        │
   └───────────────┬─────────────────────────────────────────────────────┘
                   │ derived from (pure, parallel, default-OFF)
                   ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  LAYER 2 — THE GENERAL LEDGER (derived, double-entry)                │
   │  posting.ts turns each recorded entry into balanced DR/CR journal    │
   │  legs. statements.ts derives Balance Sheet / Budget-vs-Actual from   │
   │  THOSE legs.  ⇒ STATEMENTS COME FROM HERE.                           │
   └─────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────────┐
   │  LAYER 3 — THE BANK FEED (reality, NOT the books)                    │
   │  bank_transactions: the real Chase transactions Plaid pulls in.      │
   │  This is the EVIDENCE that the books are right.                      │
   └───────────────┬─────────────────────────────────────────────────────┘
                   │ RECONCILIATION (auto-matcher.ts)
                   ▼
            matches each Chase transaction  ◄──►  to a recorded entry.
            Matched = confirmed.  Unmatched = an exception to resolve.
```

**The load-bearing point:** the bank feed does **not feed the statements**. Money does **not** appear on the Balance Sheet because Chase saw it — it appears because we **recorded** it (a dues charge, a payment, an expense). The statements are built strictly from recorded entries → GL journals → derived statements. Reconciliation is the **separate** loop that checks the recorded entries against the real Chase transactions and surfaces any disagreement.

**Evidence in the code:**

- `server/services/gl/statements.ts` (the pure derivation core) carries the explicit banner: *"THESE STATEMENTS ARE DERIVED. They are NOT a source of truth. The owner ledger stays the system of record; the GL is built alongside it (forward-only, parallel, GL_ENABLED default OFF)."* Its inputs are the **GL journal corpus** (`buildBalanceSheet(journals)`, `buildBudgetVsActual(budgetLines, actuals)`) — never `bank_transactions`.
- `server/services/gl/posting.ts` maps an `owner_ledger_entry` → balanced journal legs (DR Accounts Receivable / CR Assessment Income on a charge; DR Cash / CR AR on a payment). The bank feed is **not** a posting source for the live statements.
- `server/services/gl/statements-service.ts` loads GL journals + budget lines + vendor-invoice actuals — and *"NEVER writes to any table."* It is read-only and gated behind `GL_ENABLED` (`server/services/gl/flag.ts`).

> **Is it "wired"?** The statements are wired to the **books** (owner ledger → GL → statements). The bank feed is wired to **reconciliation** (`bank-feed-sync.ts` → `auto-matcher.ts` / report). The two are correctly separate. The one nuance: the GL/statements layer ships **default-OFF** (`GL_ENABLED` / `GL_ENABLED_ASSOCIATIONS` allowlist, with a reconcile-to-cent gate in `runtime-sync.ts`). So "are the statements live for CHC?" = "is CHC on the GL allowlist and does its ledger reconcile to the cent?" — that's a flag-state question, separate from the reconciliation work in this plan. **(Decision D5 below.)**

---

## 2. How it knows which transactions were "actual"

**Chase's feed IS the actual.** Plaid pulls every real transaction Chase posted into `bank_transactions` (via `/transactions/sync`, cursor-based, in `bank-feed-sync.ts`). So "actual" = "a row in `bank_transactions`." The job of reconciliation is to pair each actual Chase transaction with the recorded entry that explains it.

**The matcher** (`server/services/reconciliation/auto-matcher.ts`, `scoreCandidate`) scores each possible pairing of a Chase **credit** (owner payment in) against an unsettled **payment** ledger entry on three signals:

- **Amount** — exact match = 0.55 of the confidence; within $1 = 0.30.
- **Date proximity** — same day = 0.20; within 3 days = 0.10; hard cap 7 days.
- **Payor name** — full first+last in the bank descriptor = 0.25; partial = 0.10.
- Plus a **learned descriptor alias** (`bank_descriptor_aliases`): once a treasurer confirms "ZELLE FROM J SMITH = unit 12," the next one auto-matches at 0.99.

≥ 0.85 confidence and unambiguous → **auto-match** (sets `bank_transaction_id` + `settled_at` on the ledger entry). Tied/borderline → **manual review** queue (Tab 1). Unmatched credit with a name-in-descriptor → **owner-attribution suggestion** (Tab 4) that creates the missing payment entry in one click.

### The two exception classes (define them precisely)

| Class | What it is | What it means | Where it shows today |
|---|---|---|---|
| **(a) In-Chase-but-not-recorded** | A real Chase transaction with no recorded entry explaining it | Real money the books don't reflect — **must be categorized** to an account (dues? special assessment? expense? transfer? other?) | Reconciliation report `unmatchedBankTransactions` (`report.ts`) — but **only for credits**, and only as a list to look at |
| **(b) Recorded-but-not-in-Chase** | A recorded entry (e.g. a payment) with no matching Chase transaction | We say we got paid, but there's no bank evidence — a data-entry error, a bounced/returned item, or a not-yet-cleared deposit | Reconciliation report `unmatchedLedgerEntries` |

**The gap that matters for the catch-up:** the live matcher only ever looks at **credits** (`isCredit()` = `amountCents < 0`, owner money in) and only pairs them to **payment/credit** ledger entries. It has **no path** for:

- **Expenses** (Chase debits — money out the door) → no categorization to an expense account.
- **Transfers** (operating ↔ reserve, or to/from a sweep account) → not modeled in reconciliation.
- **Non-owner deposits** (interest, a vendor refund, a one-off) → not categorized.

So "in-Chase-but-not-recorded" today is **half-handled** (owner-payment credits get suggestions; everything else just sits in a list). The retroactive catch-up is where we close that — see §3.

---

## 3. The retroactive one-time catch-up (the core ask)

**Goal:** reconcile the historical Chase transactions the system never captured under the right account types — so the opening picture of CHC's books reflects real history, not just go-forward activity.

### Two history paths (one now, one future)

The catch-up has **two sources of history**, because the bank feed can only return what the bank has:

- **Path A — Feed API pull (BUILD NOW).** Pull the **maximum** history the bank feed allows for CHC's Chase connection (~180 days; see the caveat in D1). This is §3's main workflow below.
- **Path B — Retroactive Accounts-Management Upload (FUTURE).** For history **older than the API can reach**, or that **predates the current Chase account**, William submits prior bank statements (PDF/CSV) and the system parses → categorizes → records them into the ledger/GL — consolidating everything in one place. Scoped in §3b as a **future build, not now.**

Path A handles recent reality automatically; Path B is how we eventually get a *complete* historical record when the feed can't reach back far enough. The two converge into the same categorize-the-leftovers worklist and must **de-dupe** against each other (an uploaded statement line that overlaps a feed transaction must not double-record — see §3b).

### How the pieces already support it (Path A)

- **Pulling history is free.** `bank-feed-sync.ts` uses Plaid `/transactions/sync` with a **per-connection cursor** (`bank_connections.transactions_cursor`). The **first sync with a null cursor backfills full available history** — there is no date-window limit on the *pull* imposed by our code. (The matcher and report apply their own 30-day windows, but the raw transactions are all there.)
- **We pull MAX (ratified).** The catch-up pulls the **maximum** history the feed will return for CHC's connection (~180 days). **Caveat (call it out):** the Chase account is **relatively new**, so the *actually-available* history may be **short** — the feed can only return what **Chase itself has**. If Chase has only N weeks of history on this account, that is the ceiling, full stop. Anything older than the account, or older than the API can reach, is the job of **Path B (statement upload, §3b)** — not the feed.
- **The matcher is idempotent.** Re-running `runAutoMatch(associationId)` is a no-op on already-matched rows, so a one-time historical pass is safe to run repeatedly.

### The catch-up workflow (proposed)

```
 STEP 1 — PULL          Ensure the full available Chase history is in bank_transactions.
 (one-time)             If the connection already backfilled at link time, this is done;
                        otherwise force a cursor-null re-sync for CHC's connection.

 STEP 2 — AUTO-MATCH    Run a HISTORICAL reconciliation pass with the date window opened
 (the wide pass)        to the full pull (not the live 30-day CREDIT_SEARCH_WINDOW_DAYS).
                        Auto-match every owner-payment credit it confidently can to a
                        recorded payment entry. Surface owner-attribution suggestions
                        for credits with a name-in-descriptor but no recorded payment.

 STEP 3 — CATEGORIZE    Everything still UNMATCHED after Step 2 is the work product:
 (the leftovers —       a review list of historical transactions that need an account.
  the NEW surface)      For EACH, classify into one of:
                          • dues payment      → owner_ledger_entry (entryType 'payment')
                          • special assessment→ owner_ledger_entry ('payment' vs an SA)
                          • expense           → vendor_invoice / expense entry  (NEW path)
                          • transfer          → operating↔reserve / sweep        (NEW path)
                          • other / ignore    → tagged, excluded from matching   (NEW state)
                        Each categorized row records WHAT it is so the books + (when
                        enabled) the GL reflect real history.

 STEP 4 — CONFIRM       Re-run the reconciliation report for the historical period and
 (close it out)         confirm: every Chase transaction is either matched or
                        deliberately categorized, and the residual gap is explained.
                        That report is the artifact that says "CHC's history is reconciled."
```

### Where it lives in the UI

Extend the existing `/admin/reconciliation` surface (`client/src/pages/admin-reconciliation.tsx`) — it already has 4 tabs (auto-match, report, audit log, suggestions). Add a **"Catch-Up" / "Historical Reconciliation"** mode:

- A **date-range picker** that defaults to the full pulled history (vs. the live tabs' 30-day window).
- A **categorization worklist**: each unmatched historical transaction as a row with `date · amount · descriptor`, a **suggested category** (where a rule or the descriptor heuristic can guess), and a **dropdown** to set the account type (dues / special assessment / expense / transfer / other).
- A **"resolve" action per row** that writes the appropriate entry (owner payment, expense, transfer, or "ignore" tag) — reusing the existing `createPaymentFromSuggestion` path for owner payments and **new** paths for expense/transfer/ignore.
- A **progress counter** ("47 of 312 historical transactions categorized") and a **"reconciled" confirmation** when the residual is explained.

### Data touched

- **Read:** `bank_transactions` (the historical pull), `owner_ledger_entries` (existing recorded entries to match against), `bank_descriptor_aliases` (learned matches), `persons`/`ownerships`/`units` (payor signals), `special_assessments` (to attribute SA payments).
- **Write (per categorized row):**
  - dues / SA payment → insert `owner_ledger_entries` (`entryType: 'payment'`, `bankTransactionId` set, `settledAt` set) — the existing `createPaymentFromSuggestion` shape.
  - expense → a `vendor_invoices` / expense entry (**new** — the matcher has no expense path today; this is net-new work to scope).
  - transfer → an interfund/transfer record (**new** — not modeled in reconciliation today).
  - other/ignore → a new **"categorized: ignore"** marker on the bank transaction so it stops appearing as unmatched (**new state** — there is no such flag today; today an unmatched row just persists).
- **No deletes.** Idempotent re-runs. Tenant-scoped to CHC's `association_id` on every query (the matcher already enforces this).

### Net-new vs. reuse (honest completeness)

| Piece | State |
|---|---|
| Full-history Chase pull | **Built** — cursor-null sync backfills (`bank-feed-sync.ts`) |
| Auto-match owner-payment credits | **Built** — `runAutoMatch` (`auto-matcher.ts`) |
| Owner-attribution suggestions (name-in-descriptor) | **Built** — `findOwnerSuggestionsForUnmatchedCredits` (Tab 4) |
| Reconciliation report (matched/unmatched/by-owner) | **Built** — `buildReconciliationReport` (`report.ts`), but **30-day-windowed** |
| **Open the date window for a historical pass** | **Net-new** — parameterize `CREDIT_SEARCH_WINDOW_DAYS` / report window |
| **Categorize a non-owner-payment transaction (expense/transfer/other)** | **Net-new** — no path today; matcher is credit-only |
| **"Ignore / categorized" marker so a resolved row leaves the unmatched list** | **Net-new** — no such state on `bank_transactions` today |
| **Catch-Up UI mode** | **Net-new** — extends the 4-tab page |
| **Retroactive Accounts-Management Upload (Path B)** | **Future** — statement upload → parse → de-dupe-vs-feed → categorize → record (§3b); not part of the current catch-up |

---

## 3b. FUTURE — Retroactive Accounts-Management Upload (statement-upload path; NOT now)

**Why it exists:** the feed (Path A) can only return what Chase has on the **current** account, up to the API's reach. For CHC's older history — predating the current Chase account, or older than the API window — there is **no feed source.** The future answer is to let William **upload prior bank statements** (PDF/CSV) and have the system parse → categorize → record them, so everything lives in one place and the historical record is complete.

**Scope (future build — flagged for William, not part of the current catch-up):**

```
 UPLOAD     William submits previous bank statements (PDF and/or CSV), per account,
            per period.

 PARSE      Extract each statement line (date · amount · description · running balance)
            into a normalized staging shape. CSV is deterministic; PDF needs a parser
            (statement layouts vary by bank — a real cost to scope).

 DE-DUPE    Before recording, reconcile uploaded lines AGAINST the feed (Path A) so an
            uploaded line that overlaps a feed transaction is NOT double-recorded.
            Key on (date + amount + normalized descriptor); flag near-duplicates for
            review rather than silently dropping. This is the load-bearing safety check.

 CATEGORIZE Same categorize-the-leftovers worklist as Path A — each parsed line sorts
            into dues / special assessment / expense / transfer / other, with the same
            rules/heuristic pre-classification and the same conservative-by-default bias.

 RECORD     Write the categorized lines into the ledger/GL exactly like Path A, tagged
            with source='statement-upload' (vs source='feed') so provenance is clear and
            an upload can be re-run idempotently.
```

**Decisions this future path raises (to settle when it's built, not now):**

- **Parser scope** — CSV only first (cheap, deterministic), or PDF too (real parsing cost; layouts vary by bank)?
- **De-dupe boundary** — exact (date+amount+descriptor) vs. fuzzy near-match; what happens on a flagged near-duplicate (auto-skip vs. surface for review)?
- **Provenance + trust** — uploaded statements are user-submitted (lower trust than the bank feed); do they get the same auto-categorize confidence, or always route to manual review?
- **Overlap policy** — when an uploaded period overlaps a feed-covered period, does the feed always win (upload only fills gaps), or can an upload correct a feed transaction?
- **Opening-balance interaction** — does a full statement-upload history replace the need for an explicit opening-balance entry (D4), or do they coexist?

**Status:** DESIGN / future — this section is the *path*, not a build. The current catch-up is Path A (feed pull). Path B is the eventual complete-history mechanism.

---

## 4. Decisions for William (these need your call — I have NOT decided them)

| # | Decision | Options | Notes / lean |
|---|---|---|---|
| **D1** | **How far back to pull (Path A)** | **DIRECTION GIVEN: pull MAX** (~180 days, the most the feed allows) | Confirmed direction is **pull the maximum** the feed returns. **Caveat to keep visible:** CHC's Chase account is **relatively new**, so the *actually-available* history may be **short** — the feed only returns what Chase has. Probe the connection's true reach at build time; don't promise a span the bank can't supply. History **older than the API reach (or pre-current-account)** is **Path B (statement upload, §3b)**, not the feed. Remaining open sub-question: does the historical pass auto-match the full pulled span in one run, or page it? (mechanical, decide at build). |
| **D2** | **How unmatched history gets categorized** | (a) you manually review each · (b) rules-based auto-sort · (c) hybrid (rules pre-classify, you confirm) | Lean **(c) hybrid**: the existing descriptor heuristic + simple rules (recurring vendor names → expense, owner names → dues) pre-classify, and you approve in bulk. Conservative bias — auto-create only on high confidence, everything else to your review (mirrors how Tab 4 already works). |
| **D3** | **The held GL income split** | (a) keep dues + special assessments both in `4000 Assessment Income` (today's behavior) · (b) split SAs into a separate income account; **`4010 Reserve Fund Contributions` already exists but is unused** | Affects categorization: if you split, the catch-up worklist needs a **dues vs special-assessment** distinction at categorize-time, and SA payments post to a different income account. If you keep them merged, categorization is simpler but the statements can't tell dues income from SA income. Today **both `charge` and `assessment` entries post to `4000`** (`posting.ts`). |
| **D4** | **The test-data-era gap / opening baseline** | (a) historical pull IS the opening (reconcile from the first real Chase transaction forward) · (b) set an explicit **opening-balance** entry as of go-live and only categorize history after it · (c) hybrid: opening balance + reconcile the pre-go-live history for the record | CHC started on **seed/test data we cleared**; the real books start now. So "opening" ≠ "first Chase transaction." We should decide the **baseline date**: do we reconcile Chase history that predates the real-books start (for a complete record), or set a clean opening balance at go-live and only reconcile forward? `posting.ts` already has an `opening_balance` source type stubbed for exactly this. |
| **D5** | **Turn the GL/statements on for CHC** | (a) add CHC to `GL_ENABLED_ASSOCIATIONS` allowlist now · (b) keep statements off until the catch-up is done and the ledger reconciles to the cent | The derived statements are **default-OFF**; they only render once CHC is allowlisted **and** its ledger reconciles to the cent (`runtime-sync.ts` gate). Sequencing question: do the catch-up first (so the statements are accurate when lit), or light them now (knowing they reflect only go-forward until the catch-up lands)? Lean: **catch-up first, then light.** |

---

## 5. Sequencing (proposed, for reaction — not yet a build order)

1. **Confirm the provider reality** (Plaid, not Stripe) and **probe CHC's Chase connection** for its true history horizon (informs D1 — we pull MAX, but know the real ceiling given the new account).
2. **Decide D2–D5** with William.
3. **Build the Path A historical pass** — pull MAX feed history; parameterize the matcher/report window; add the "ignore/categorized" state on `bank_transactions`.
4. **Build the categorize-the-leftovers worklist** — the Catch-Up UI mode + the new expense/transfer/ignore write paths.
5. **Run the one-time Path A catch-up for CHC**, review/categorize, produce the "reconciled" report.
6. **Then** light the GL/statements for CHC (D5) so the statements open accurate.
7. **Later (Path B):** build the Retroactive Accounts-Management Upload (§3b) when complete pre-Chase / pre-API history is needed — parse + de-dupe-against-feed + categorize + record.

---

## Appendix — files this plan rests on (read, not changed)

- `server/services/reconciliation/auto-matcher.ts` — `scoreCandidate`, `runAutoMatch`, owner-attribution suggestions, 30-day window, alias learning, **credit-only** matching.
- `server/services/reconciliation/report.ts` — `buildReconciliationReport`: matched/unmatched/by-owner totals; the two exception lists.
- `server/services/gl/posting.ts` — chart of accounts (dues `charge` + `assessment` both → **`4000`**; `4010` reserve unused), pure double-entry mapping; `opening_balance` source type stubbed.
- `server/services/gl/statements.ts` + `statements-service.ts` — derived Balance Sheet / Budget-vs-Actual, **from GL journals, never from the bank feed**; read-only; `GL_ENABLED`-gated.
- `server/services/gl/flag.ts` — `GL_ENABLED` / `GL_ENABLED_ASSOCIATIONS` allowlist; reconcile-to-cent gate in `runtime-sync.ts`.
- `server/services/bank-feed/{index,provider}.ts` + `bank-feed-sync.ts` — **Plaid** provider (not Stripe FC), provider-agnostic interface, cursor-based `/transactions/sync`, full-history backfill, env-flip guard.
- `shared/schema.ts` — `bank_transactions`, `owner_ledger_entries` (`entryType` enum: charge/assessment/payment/late-fee/credit/adjustment), `recurring_charge_schedules`, `special_assessments`, `bank_connections`, GL tables.
- `client/src/pages/admin-reconciliation.tsx` + `server/routes/admin-reconciliation.ts` — the live 4-tab reconciliation UI the Catch-Up mode would extend.
