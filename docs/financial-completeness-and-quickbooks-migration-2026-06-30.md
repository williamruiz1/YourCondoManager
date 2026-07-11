# YCM Financial Completeness vs. QuickBooks + QuickBooks-Migration Path

**Date:** 2026-06-30 · **Target:** `~/code/YourCondoManager` @ branch `docs/reconciliation-retroactive-plan`
**Method:** read the live financial code — `server/services/gl/*`, `server/services/reconciliation/*`, `shared/schema.ts`, `server/routes.ts` financial routes, `client/src/pages/financial-*` — every HAVE/PARTIAL/GAP is cited to a file. Builds on the 2026-06-20 audit (`audits/AUDIT-financial-reporting-orchestration.md`) and live-state-checks it against what is now built.
**Scope:** AUDIT + PLAN. Read-only on code. No implementation.

---

## 3-bullet plain summary

- **Can YCM replace QuickBooks for an HOA today? Not yet — but it's close on the dues/A-R side and has a real double-entry engine built.** YCM has a fund-aware double-entry general ledger, a balance sheet, a budget-vs-actual statement, owner ledgers, A/R aging, recurring dues, special assessments, late fees, and a live bank feed. The blocker is that **the ledger only knows the money OWNERS pay** — the **expense / accounts-payable side (vendor bills) never posts to the general ledger**, so the income statement and balance sheet are missing ~95% of a real HOA's expenses.
- **The single biggest missing piece: vendor expenses → general ledger.** Vendor invoices exist as a list but don't post journal entries, so the GL has no expense accounts, no real income statement, no accounts-payable balance, and no full bank reconciliation (it only matches incoming deposits, never outgoing payments). Close behind: **no reserve study / reserve-component tracking** and **no cash-flow statement** — both things a QuickBooks-using HOA treasurer expects. The new GL is also still **parallel and flag-OFF** (it shadows the books; it isn't the source of truth yet).
- **The QuickBooks migration is a one-time importer that reuses the bank-statement-upload path already on the roadmap.** Ingest QB exports (chart of accounts, trial balance / opening balances, customers/owners, vendors, A/R, A/P, and the general journal), map QB accounts → YCM's chart, and post opening balances + history into the GL. It shares its parsing/mapping/dedupe spine with the already-scoped "Retroactive Accounts-Management Upload" (bank statement PDF/CSV import) — build them as one ingestion engine.

---

## Part 1 — Financial-completeness gap audit

### How YCM's money model actually works (the key to every verdict below)

There are **three layers**, deliberately separate (confirmed in `docs/reconciliation-logistics-and-retroactive-plan-2026-06-30.md` and the code):

1. **The books / system of record** = `owner_ledger_entries` (per-unit dues, payments, credits, late fees, adjustments) + `vendor_invoices` (expenses entered as a list). This is what YCM *records*.
2. **The general ledger** (`server/services/gl/*`, tables `gl_accounts` / `gl_entries`) = a **DERIVED, parallel, double-entry GL**. It is built *alongside* the owner ledger, **default OFF** (`GL_ENABLED`), and is **NOT the source of truth** (`posting.ts:16-18`, `runtime-sync.ts:16-38`). Critically, **only owner-ledger (dues) entries post to it today** (`runtime-sync.ts:54-66`) — vendor invoices do not.
3. **The bank feed** (Plaid today; Stripe Financial Connections built + flag-OFF) = the *reality check* — it matches real bank transactions to recorded entries. It does not become the books.

This three-layer model is sound and conservative. The gaps below are almost all the same root cause: **the GL is dues-only and parallel-only.**

### Gap-audit table (ranked worst-impact-first for "replace QuickBooks")

| # | Capability | Verdict | Evidence | Why it ranks here |
|---|---|---|---|---|
| 1 | **A/P + vendor bills → GL (expense side of the books)** | **GAP** | `vendor_invoices` table exists (`schema.ts:578`) but is a flat list — `status` enum has no real bill lifecycle wired to postings; `runtime-sync.ts:54-66` posts **only** owner-ledger rows; GL `GlSourceType` *declares* `vendor_invoice` (`posting.ts:115-120`) but **nothing maps a vendor invoice to journal legs** and the seeded chart (`posting.ts:60-80`) has **zero 5xxx expense accounts**. | This is THE blocker. Without expenses in the GL there is no real income statement, no A/P balance on the balance sheet, no full bank reconciliation. ~95% of a real HOA's GL activity is missing. |
| 2 | **Income statement / P&L (real, GL-based, by account)** | **PARTIAL** | Live route `/api/financial/reports/profit-loss` (`routes.ts:6583`) is **owner-ledger-only**: "income" = owner `payment`+`credit` rows, "expense" = owner `adjustment` rows (`routes.ts:6604-6606`); `budgetComparison` collapses to a single planned/actual/variance total (`:6632-6644`). The GL-based **budget-vs-actual** statement (`statements.ts:285`) is real and per-category — but its "actuals" come from **vendor_invoices grouped by vendor name** (`statements-service.ts:123-136`), not GL expense postings, and it's flag-gated. | A board-grade income statement needs real expense accounts (Insurance, Landscaping, Mgmt Fees, Pool…). Today the only "expense" the live P&L sees is owner adjustments. The pieces exist (budget-vs-actual generator) but aren't fed real expense data. |
| 3 | **Bank reconciliation (full statement reconciliation)** | **PARTIAL** | `reconciliation/report.ts` + `auto-matcher.ts` are real and weighted, and the bank feed went live. BUT the report **only matches inbound deposits (credits) to owner-ledger payments** (`report.ts:87-90` — `bankCredits = bankRows.filter(amountCents < 0)`); there is **no matching of outgoing debits to vendor payments / expenses**, and no reconciliation against a GL cash account. | It's a *dues-collection* reconciliation, not a *bank-statement* reconciliation. A QuickBooks user reconciles the whole statement (deposits AND checks/withdrawals) to the cash account. The expense half is unbuilt (depends on #1). |
| 4 | **Reserve fund tracking / reserve study** | **GAP** | The GL has a `reserve` fund dimension (`glFundEnum`, `schema.ts:3973`) and reserve accounts in the chart (`4010`, `3910`, `posting.ts:69,79`), so reserve *balances* can be derived once posted. But there is **no reserve study, no reserve components, no funding plan, no % funded** — `grep reserve shared/schema.ts` returns only the GL fund enum + chart comments (5 hits, all GL plumbing). No reserve-component table anywhere. | HOA-specific and board-critical. A treasurer leaving QuickBooks (or a spreadsheet reserve study) expects component tracking + a funding plan. The fund *segregation* exists; the *reserve study* does not. |
| 5 | **General ledger + chart of accounts (double-entry)** | **HAVE (parallel) / PARTIAL (live)** | A genuine fund-aware double-entry engine exists: `posting.ts` (balanced legs, Σdebit==Σcredit, interfund-nets-to-zero, integer cents), `gl_accounts`/`gl_entries` (`schema.ts:3983-4050`, idempotent source-leg unique index), reconcile-to-the-cent gate (`reconcile.ts`). BUT it is **DERIVED, parallel, flag-OFF, dues-only, and never source-of-truth** (`runtime-sync.ts:16-38`). The user-facing "Chart of Accounts" screen reads a *different* table — manual `financial_accounts` (`schema.ts:483`) — not the GL (`statements-service.ts:180-190` documents this seam). | The hard part (a correct double-entry core) is genuinely built and well-tested. But two charts of accounts coexist (manual `financial_accounts` vs GL `gl_accounts`), the GL is off by default, and it only carries dues. "Have the engine, haven't turned it on for the whole business." |
| 6 | **Balance sheet (fund-segregated, balances to the cent)** | **PARTIAL** | Real generator: `buildBalanceSheet` (`statements.ts:113`) — per-fund assets/liabilities/equity, rolls income−expense into equity, asserts Assets = Liabilities + Equity to the cent (`:194-202`), exposed at `/api/financial/statements/balance-sheet` (`routes.ts:4227`). BUT it's derived from the **dues-only** GL, so it shows A/R + cash + reserve but **no A/P, no prepaid/deferred assessments, no real expense-driven equity** — and it's flag-gated. | The statement *engine* is correct and balances. It just has almost nothing to show until expenses/A-P/liability sub-ledgers feed it (depends on #1). |
| 7 | **Owner/unit ledgers + A/R aging** | **HAVE** | `owner_ledger_entries` (`schema.ts:729`) is the per-unit subledger; per-owner printable **statement** (opening→activity→closing) at `/api/financial/owner-ledger/statement` (`routes/account-statement.ts`, page `financial-statement.tsx`); **A/R aging** at `/api/financial/reports/ar-aging` (`routes.ts:6665`) + **collections aging** dashboard with 0-30/31-60/61-90/91-120/120+ buckets (`routes.ts:4442-4460`); delinquency page. | This is the strongest area — genuinely on par with or better than a QB-for-HOA setup. "Who owes what" is fully answered. |
| 8 | **Recurring dues + special assessments** | **HAVE** | `recurring_charge_schedules` + `recurring_charge_runs` (cadence posts a `charge` per unit, `schema.ts:771`); `special_assessments` with installments, allocation methods, loan-style terms, unit-scope modes (`schema.ts:427`); late-fee rules + events (`schema.ts:457,470`). | Fully built. Note one held decision: dues + special assessments both post to **one** income account `4000` today (`docs/financials-ia-audit-2026-06-30.md` §4 Decision 1) — a chart-of-accounts policy choice surfaced for William, not a gap. |
| 9 | **Budgets + budget-vs-actual** | **PARTIAL** | Real budget model: `budgets`/`budget_versions` (draft→proposed→ratified→archived)/`budget_lines` (`schema.ts:521-555`); GL-based budget-vs-actual generator with operating/reserve fund sections, per-category variance, unbudgeted-spend surfacing (`statements.ts:285`); optional `budget_line_gl_mappings` (`schema.ts:4076`). | The budget side is solid. The "actual" side is the weak link — it reads vendor invoices grouped by vendor name as a proxy, not real GL expense postings (depends on #1 to be a true budget-vs-actual). |
| 10 | **Cash flow / cash position statement** | **GAP** | No cash-flow statement route or generator anywhere (`grep cash.flow → 0 hits` in services). Cash *balances* exist via the bank-feed → COA bridge (`financial_accounts.current_balance_cents`, `schema.ts:500`) and a reconciliation gap figure (`report.ts:41`). | A treasurer expects a statement of cash flows / cash position. Bank balances are visible but there's no period cash-flow statement. Lower rank: many small HOAs skip a formal cash-flow statement, but QB produces one. |
| 11 | **Amenity money loop (fee + refundable deposit → GL)** | **HAVE (built, flag-gated)** | Phase 3 is built: `amenities.usageFeeCents`/`depositCents` + `amenity_reservations.feeChargedCents`/`depositHeldCents`/`depositRefundedCents`/`depositForfeitedCents` (`schema.ts:3214-3258`); GL posting service for amenity fees + deposit-held liability + refund/forfeit (`gl/amenity-posting-service.ts`, chart account `2300 Amenity Deposits Held`, `posting.ts:76`). | Not a QuickBooks-parity item per se, but worth noting it's built — it produces the "amenity refundable deposits" liability the benchmark report needed. |
| 12 | **Reporting / exports (PDF / CSV)** | **PARTIAL** | CSV export exists for the reports page (`financial-reports.tsx:61 downloadCsv`) + vendor/work-order/maintenance reports (`storage.ts:15251+`); per-owner statement is **printable HTML** (browser → PDF), not a native PDF. No native PDF/CSV export of the board statement set (balance sheet / budget-vs-actual). Audit trail exists (`audit_logs`, `schema.ts:356`). | A board packet usually wants a clean PDF of the balance sheet + income statement + budget-vs-actual. Today those are JSON endpoints / on-screen tables. The per-owner statement prints; the association statements don't export natively. |

### Plain verdict — can YCM replace QuickBooks today?

**Not yet — but the foundation is real, and the gap is well-defined and bounded.**

What YCM *already does as well as or better than* QuickBooks-for-an-HOA: per-unit owner ledgers, A/R aging + collections, recurring dues, special assessments with installment/allocation logic, late fees, a live bank feed, and a **correct double-entry GL engine** with fund segregation and a balance sheet that ties to the cent. The dues/receivables side is credibly QB-replacing.

What blocks "credibly replace QuickBooks" — ranked:

1. **Expenses / accounts payable don't post to the general ledger.** This single gap cascades into a hollow income statement, a balance sheet with no A/P, and a half bank reconciliation. **Fix this first.**
2. **No reserve study / reserve-component tracking.** HOA-board-critical; QB users often keep this in a spreadsheet, so parity here is a differentiator, not just a gap.
3. **The GL is parallel + flag-OFF + dues-only, and there are two charts of accounts** (manual `financial_accounts` vs GL `gl_accounts`). To *be* the books, the GL has to carry the whole business and become source-of-truth (the reconcile-to-cent gate is the proven path to flip it).
4. **No cash-flow statement; no native PDF/CSV export of the board statement set.**

Everything else is HAVE or a small, well-scoped PARTIAL. The honest framing: **YCM has built the hard accounting engine; what's missing is wiring the expense/A-P side into it, adding reserve tracking, and flipping the GL on as source-of-truth.**

---

## Part 2 — QuickBooks migration path (scope, not build)

### What a QuickBooks-leaving HOA brings

QuickBooks (Desktop or Online) exports the following, which an HOA/PM would hand us:

| QB artifact | Format | Maps to (YCM) |
|---|---|---|
| **Chart of Accounts** | IIF / CSV / QBO | YCM GL `gl_accounts` (account code, name, type, fund) — the mapping spine |
| **Trial Balance** (as-of date) | CSV / PDF | **Opening balances** — one balanced opening journal per account (`GlSourceType "opening_balance"` already exists, `posting.ts:120`) |
| **Customers** (= owners/units) | IIF / CSV | `persons` + `units` + owner A/R opening balances |
| **Vendors** | IIF / CSV | `vendors` (`schema.ts:559`) |
| **A/R aging / open invoices** | CSV | `owner_ledger_entries` opening charges per unit |
| **A/P aging / open bills** | CSV | `vendor_invoices` open balances (and GL A/P once #1 ships) |
| **General Journal / transaction detail** | IIF / CSV | Historical GL entries (optional full history vs opening-balance-only) |
| **Budget** | CSV | `budgets` / `budget_lines` |

QB's native interchange is **IIF** (tab-delimited, Desktop) and **CSV** (both); QBO has a REST API but the realistic path for a one-time HOA migration is **export-file ingestion**, not a live QBO API integration.

### The migration workflow (design)

```
QB exports (IIF/CSV)
   → 1. UPLOAD + PARSE        (per artifact type; detect IIF vs CSV)
   → 2. MAP accounts          (QB account → YCM chart code+fund; assisted, persisted)
   → 3. RESOLVE entities      (QB customers→owners/units, vendors→vendors; fuzzy + confirm)
   → 4. DEDUPE                (against existing YCM data; skip/merge)
   → 5. CHOOSE depth          (opening-balances-only  OR  full transaction history)
   → 6. POST                  (balanced opening journal from trial balance, into the GL)
   → 7. RECONCILE-TO-CENT     (reuse reconcile.ts gate: imported balances must tie)
   → 8. REVIEW + COMMIT       (treasurer confirms; nothing live until confirmed)
```

**The decisions this raises (for William):**

1. **Opening-balances-only vs full history?** Opening-balances-only (from the trial balance as of a cutover date) is far simpler, sufficient for going-forward books, and the common professional migration approach. Full general-journal history is heavier (entity resolution for every line) and rarely needed. **Recommend: opening-balances-only as the default; full-history as an optional advanced path.**
2. **Account mapping: assisted or auto?** QB charts vary wildly. Recommend an **assisted mapper** (suggested matches by name/type, treasurer confirms, mapping persisted per association) over silent auto-mapping — wrong account mapping corrupts every downstream statement.
3. **Cutover date / freeze.** A clean migration needs a "books closed in QB as of date X; YCM is authoritative from X+1." Surface this as an explicit cutover step.
4. **This depends on Gap #1 (expenses→GL).** Importing A/P and expense history is only meaningful once vendor expenses post to the GL. **Sequence: ship expenses→GL first, then the QB importer can carry the expense side.** (Owner A/R + opening balances could import sooner.)

### Overlap with the already-backlogged bank-statement upload — build them as ONE engine

The roadmap already has a **"Retroactive Accounts-Management Upload"** (Path B in `docs/reconciliation-logistics-and-retroactive-plan-2026-06-30.md`): submit prior **bank statements (PDF/CSV)** → parse → categorize → record, for history the bank API can't reach.

That is the **same ingestion spine** as the QB importer: **upload → parse → map/categorize → dedupe → review → post.** The two differ only in the *source schema* (a bank statement's transaction rows vs QB's accounts/balances/journal). **Recommendation: build one ingestion engine with pluggable source-parsers** — `bank-statement-parser`, `qb-iif-parser`, `qb-csv-parser` — feeding a shared mapping/dedupe/review/post pipeline. This avoids two parallel importers and lets the QB migration reuse the categorization-review UI the bank-statement upload needs anyway.

### Migration "done" benchmark

An HOA exports its QuickBooks chart of accounts + trial balance (and optionally vendors/customers/open A-R/A-P), uploads them to YCM, confirms the account mapping, and YCM posts a balanced opening journal into the GL that **reconciles to the cent** (reusing `reconcile.ts`) — so the HOA's first YCM balance sheet matches its last QuickBooks balance sheet, and it operates going forward in YCM with no QuickBooks.

---

## Sequencing recommendation (the one-line plan)

1. **Expenses / A-P → GL** (vendor invoices post journal entries; seed the 5xxx expense chart). Unblocks a real income statement, A-P on the balance sheet, and full bank reconciliation. **#1 priority — same conclusion as the 2026-06-20 audit's F1, now narrowed to the expense half since the dues half is built.**
2. **Reserve study / reserve-component tracking** (HOA-specific differentiator vs QuickBooks).
3. **Flip the GL to source-of-truth** (the reconcile-to-cent gate is the proven gate) + unify the two charts of accounts.
4. **Cash-flow statement + native PDF/CSV export** of the board statement set.
5. **One ingestion engine** → QB importer + bank-statement upload (shared spine), after #1.

*Effort framing only — sized by build effort, not calendar.*
