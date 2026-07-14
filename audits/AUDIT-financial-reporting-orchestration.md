# AUDIT — Financial Reporting + Operational Orchestration (Hardened Gap Analysis + Patch)

**Audited:** 2026-06-20 · **Target:** `~/code/YourCondoManager` @ `b7dd349` (branch `main`) · **Benchmark report:** `~/Downloads/Paddlers Cove Informational Meeting Notice.pdf` (CAMS-managed NC POA; CINC-class `V3.11` financials — 2026 Proposed Budget w/ FY2024 actual / FY2025 budget+YTD / FY2026 proposed, Operating + Reserve fund accounting; Balance Sheet as of 10/31/2025). · **Method:** running code + schema (`shared/schema.ts`) + routes (`server/routes.ts`, `server/routes/*.ts`) + services. Evidence pointers cited inline; ratings taken from code, not README. Builds on `audits/AUDIT-HOA-001-results.md` (F1/F2/F3/F7 verdicts).

> **Hardening note (per HARDENED-DESIGN CHECKLIST):** the benchmark report is a *fund-segregated, interfund-balanced, multi-year* statement. Every patch below is designed so the new fund/GL layer is **additive** (new columns default to `operating`, existing rows untouched), **reconcilable** (interfund must net to zero — a hard check), and **fail-safe** (a missing fund tag degrades to `operating`, never crashes a report). No destructive migration; no in-place rewrite of `owner_ledger_entries`.

---

## 0. BLUF — can YCM produce the Paddlers Cove report today?

**NO.** Two independent blockers:

1. **No general ledger for association-level income/expense.** YCM's financial reports (`/api/financial/reports/profit-loss`, `routes.ts:6438`) are computed **exclusively from `owner_ledger_entries`** — the per-unit dues subledger. They sum owner *payments* as "income" and owner *adjustments* as "expense." They have **no concept of the 40+ expense GL accounts** (Landscape Contract, Pool Service, Insurance, Management Fees, etc.) that make up 95% of the Paddlers Cove statement. The vendor/expense side lives in `vendor_invoices` (`schema.ts:562`) and the bank feed, and **neither is wired into any report.** You cannot produce a budget-vs-actual expense statement from a dues ledger.
2. **No fund segregation balances + no balance sheet.** `financial_accounts.accountType` *can* hold the string `"reserve"` (`routes.ts:17312`), but **balances are never stored against accounts** — the portfolio summary literally does `totalReserveFunds += 0; // balances aren't stored on account rows` (`routes.ts:17313`) and the dashboard returns `reserveBalance: 0` (`routes.ts:17375`). There is **no balance-sheet route** anywhere (`grep balance-sheet → 0 hits`), no reserve-fund balance store, no interfund tracking, no AP/prepaid/deferred-liability rollup.

**Single highest-leverage patch:** **Gap F1 — add a fund-aware double-entry GL** (`gl_accounts` + `gl_entries` with a `fund` dimension). It is the foundation the budget-vs-actual statement (F7a), the balance sheet (F7b), reserve segregation, and interfund balancing all sit on. Without it, every downstream report is a placeholder.

**Amenity orchestration verdict:** **Absent end-to-end.** Booking exists (`amenities`/`amenity_reservations`); **fee charge, deposit hold, deposit refund, and ledger posting are entirely unbuilt** — `amenity_reservations` has no `feeAmount`/`depositAmount`/`depositStatus`/`ledgerEntryId` columns (`schema.ts:3172-3192`), the approve handler writes only status (`routes/amenities.ts:143-170`), and `server/services/` contains **zero** amenity references. The Paddlers Cove "Amenity Refundable Deposits — $2,625" liability line cannot be produced.

**Plaid production:** the rails are **production-capable but not production-correct.** Link-token/exchange/sync/webhook are all built (`plaid-provider.ts`), but three concrete blockers: (a) defaults to `sandbox` (`plaid-provider.ts:37`); (b) uses the **deprecated `/transactions/get`** (`transactionsGet`, `plaid-provider.ts:194`) instead of the canonical `/transactions/sync`; (c) **webhook JWT verification is stubbed out** (`plaid-provider.ts:215-228`, `void rawBody; void headers;`) — a security gap that must close before production. Recommendation: **flip env + add JWT verification + migrate to `/transactions/sync` — do NOT go live on the stubbed webhook verifier.**

---

## 1. Task 1 — Financial reporting (fully wired?)

### 1a. Budget-vs-actual multi-year statement with Operating/Reserve segregation

**Current state (with file evidence):**

- **Budget side exists, partially.** `budgets`/`budget_versions`(draft→proposed→ratified→archived)/`budget_lines`(`plannedAmount`, `accountId`, `categoryId`) (`schema.ts:505-539`). A budget-vs-actual roll-up exists at `/api/financial/accounts/activity` (`routes.ts:4892`) — **but "actual" = `invoicedAmount` from `vendor_invoices` only** (`routes.ts:4939`), single-period, no fund grouping, no multi-year columns.
- **Actual side is broken for a real statement.** The P&L report (`routes.ts:6438-6518`) derives:
  - `income` = `owner_ledger_entries` where `entryType ∈ {payment, credit}` (`routes.ts:6459`) — i.e. dues received, NOT the GL income accounts (Assessment Income 4000, Reserve Funding 4010, Amenity Rental 4445).
  - `expense` = `owner_ledger_entries` where `entryType = adjustment` (`routes.ts:6461`) — there is **no expense GL at all**. The 40 expense accounts in the benchmark (5040 Insurance, 5060 Mgmt Fees, 5755 Landscape, 5810 Pool…) have nowhere to post.
  - `budgetComparison` collapses to a **single total** `{planned, actual, variance}` (`routes.ts:6487-6499`) — no per-line, no per-category, no Operating-vs-Reserve split, no FY-over-FY.
- **Fund segregation: tag present, balances absent.** `financial_accounts.accountType` is a free-text string defaulting `"expense"` (`schema.ts:488`); code checks `accountType === "reserve"` (`routes.ts:17312`) but immediately `+= 0 // balances aren't stored on account rows` (`routes.ts:17313`). There is no `fund` enum, no reserve-fund balance store, no interfund.

**The patch:**

| # | Patch | Effort |
|---|---|---|
| **F1** | **Fund-aware double-entry GL.** New `gl_accounts` (code, name, `accountType` enum `asset\|liability\|equity\|income\|expense`, **`fund` enum `operating\|reserve`**, `normalBalance`) + `gl_entries` (date, `glAccountId`, `fund`, debit/credit cents, `sourceType`/`sourceId` → links to `vendor_invoices`/`owner_ledger_entries`/`bank_transactions`/`amenity_reservations`). Post from existing sources via a thin posting service (`gl-posting-service.ts`). Migration `0041_gl_fund_accounting.sql`. | **L** |
| **F7a** | **Budget-vs-actual statement generator** `/api/financial/reports/budget-vs-actual?associationId&years=2024,2025,2026`. Groups `gl_entries` by `fund` → category → account; joins ratified `budget_lines` per FY; emits the exact Paddlers Cove shape: per-account rows, FY columns (Budget/Actual), Operating Fund + Reserve Fund sections, fund net totals, grand net. | **M** |
| **F5+** | **Reserve-fund balance store** — reserve balance is the running sum of reserve-fund `gl_entries`; replace both placeholders (`routes.ts:17313`, `:17375`) with the real segregated balance. | **S** (once F1 lands) |

**Benchmark for "done":** generate a budget-vs-actual statement for one association that reproduces the Paddlers Cove layout — Operating Fund income+expense by account across FY2024/FY2025/FY2026, Reserve Fund section, **fund net totals that tie**, and a grand Net Total — from real `gl_entries` (not placeholders).

### 1b. Balance sheet (cash / AR / interfund / reserves / liabilities)

**Current state:** **Absent.** No balance-sheet route exists (`grep -c balance-sheet → 0` across all route files). AR-aging exists (`routes.ts:6520`) as the only asset-side primitive. No reserve-fund liability/equity store, no interfund balances, no AP rollup into a statement, no prepaid/deferred-assessment or amenity-deposit liability lines.

The benchmark balance sheet requires every one of: Cash (per bank account, fund-tagged) · Accounts Receivable ($29K owner + $8.5K townhome master fees) · **Interfund Receivable** (operating owes reserve $9,730.87, must net to $0) · Accounts Payable ($20.5K from `vendor_invoices`) · Pre-Paid Assessments ($24.8K) · **Amenity Refundable Deposits ($2,625 — see Task 2)** · Deferred Assessments ($91K) · Reserve Funds equity ($730K).

**The patch:**

| # | Patch | Effort |
|---|---|---|
| **F7b** | **Balance-sheet generator** `/api/financial/reports/balance-sheet?associationId&asOf=YYYY-MM-DD`. Two-column (Operating / Reserve) + Total. Assets from fund-tagged cash (`bank_connections`/`bank_accounts` balances) + AR (owner-ledger summary, already exists) + interfund (from `gl_entries`); Liabilities from `vendor_invoices` open (AP), new `prepaid_assessments`/`deferred_assessments`/amenity-deposit liability accounts; Reserve Funds equity = reserve-fund GL balance. **Hard check: interfund column nets to $0; Assets = Liabilities + Equity** (assert + flag, never silently publish an unbalanced sheet). | **M** |
| **F7c** | **Liability sub-ledgers** — `prepaid_assessments` + `deferred_assessments` tables (or GL liability accounts), fed from the existing dues/autopay flow; amenity-deposit liability fed from Task 2. | **M** |

**Benchmark for "done":** produce a balance sheet as-of a chosen date for one association with Operating/Reserve columns, an interfund line that nets to zero, an amenity-deposit liability that matches outstanding held deposits, and a footer where **Total Assets = Total Liabilities + Equity to the cent.**

---

## 2. Task 2 — Operational orchestration: amenity rentals end-to-end

**Verdict: the booking loop exists; the MONEY loop is entirely absent.**

**Current state (with file evidence):**

- **Booking (built):** `amenities`(`bookingWindowDays`, `requiresApproval`, `capacity`) + `amenity_reservations`(`startAt`/`endAt`/`status`/`approvedBy`) + `amenity_blocks` (`schema.ts:3151-3209`); admin + portal routes incl. conflict detection (`routes/amenities.ts:309`, 409 on overlap).
- **Charge (absent):** `amenities` has **no `rentalFee` / `depositAmount` columns**; `amenity_reservations` has **no `feeAmount` / `depositAmount` / `depositStatus` / `feeLedgerEntryId` / `depositPaymentId` / `refundedAt`** (`schema.ts:3172-3192`). The approve handler (`routes/amenities.ts:143-170`) writes only `status`/`approvedBy`/`approvedAt`. The portal create handler (`routes/amenities.ts:309`) writes a reservation with **no payment step.**
- **Deposit hold + refund (absent):** no Stripe manual-capture / hold, no deposit-held liability, no refund path. `grep amenity server/services/ → 0 hits`. The benchmark's "Amenity Refundable Deposits $2,625" liability is unrepresentable.
- **Ledger posting (absent):** no `owner_ledger_entries` row is created for a rental fee; "Amenity Rental Income 4445" in the benchmark has no source in YCM.

**The full loop YCM must administer (reserve → charge → hold deposit → refund → ledger):**

| # | Patch | Effort |
|---|---|---|
| **A1** | **Schema** — add `amenities.rentalFeeCents`, `amenities.depositCents`, `amenities.depositRefundable` (bool); add `amenity_reservations.feeAmountCents`, `depositAmountCents`, `feeLedgerEntryId`(→`owner_ledger_entries`), `depositStatus`(enum `none\|held\|refunded\|forfeited`), `depositPaymentIntentId`, `depositRefundedAt`. Migration `0042_amenity_billing.sql` (all nullable/defaulted — fail-safe, no existing-row impact). | **S** |
| **A2** | **Charge on approval** — when a reservation is approved (or created if `requiresApproval=0`), post a `charge` `owner_ledger_entry` (entryType already supports `charge`, `schema.ts:712`) for the rental fee + (optionally) generate an owner payment link via the **existing** Stripe Connect direct-charge flow (`payment-service.ts`). Reuses the live dues rail — no new processor work. | **M** |
| **A3** | **Deposit hold + refund** — take the refundable deposit via a Stripe PaymentIntent with `capture_method=manual` (authorization hold) OR a captured charge booked to a **deposit-held liability** GL account (Task 1b line); on completion+inspection, **refund** (cancel the auth or issue a Stripe refund) and clear the liability. `depositStatus` drives the lifecycle. This produces the benchmark's "Amenity Refundable Deposits" liability line directly. | **M** |
| **A4** | **GL/report wiring** — fee posts to income account 4445-equivalent; held deposits roll into the balance-sheet liability (F7b). Closes the loop from booking → financial statement. | **S** (after F1) |

**Benchmark for "done":** an owner books the clubhouse → is charged the rental fee (appears on their unit ledger + the association's amenity-income line) → a refundable deposit is held (appears as a balance-sheet liability) → after the event the deposit is refunded (liability clears, owner made whole) — all visible on the ledger and the two financial statements.

---

## 3. Task 3 — Online research: best practices + competitor benchmarks

**HOA financial-statement generation (fund accounting):** The board-grade statement set is **balance sheet + income statement (budget-vs-actual) + general ledger + bank reconciliation + AR aging + reserve-fund balance**, with **operating and reserve funds held and reported separately** ("fund balance accounting"). This is exactly the Paddlers Cove (CINC `V3.11`) output, and exactly what YCM cannot yet produce because it lacks the GL + fund dimension. ([CINC — What Is an HOA Financial Statement](https://cincsystems.com/resources/blog/what-is-an-hoa-financial-statement), [Buildium — HOA Reserve Fund Accounting](https://www.buildium.com/blog/hoa-reserve-fund-accounting/))

**What the competitors do here:**
- **CINC** — cloud association-management with a full GL producing "timely and crystal-clear financial statements"; the engine behind the Paddlers Cove report. ([CINC — Complete Guide to HOA Financial Management](https://cincsystems.com/resources/guides/the-complete-guide-to-hoa-financial-management))
- **Vantaca** — AR, AP, budgeting, and **financial reporting tied directly to the work that drives them** (work-order → AP → GL). YCM has the work-order half but not the AP→GL half (F4 thin, no GL). ([Vantaca product](https://www.vantaca.com/product))
- **Buildium** — accounting module: automated dues, bank reconciliation, board financial reports; **amenity booking gated to higher tiers.** ([Buildium — best HOA accounting software](https://www.buildium.com/blog/best-hoa-accounting-software/))

**Amenity-booking-to-billing automation:**
- **Amenity Boss (Community Boss)** — the category benchmark: reserve amenity spaces, **securely charge usage fees, with optional automatic refundable deposits**, double-booking prevention. This is precisely the reserve→charge→deposit loop YCM is missing. ([Amenity Boss — HOA](https://www.communityboss.com/amenity-boss/hoa))
- **PayHOA / Buildium** — bundle amenity booking with the accounting ledger so a rental charge lands on the unit's account automatically. ([Condo Control — best HOA software 2026](https://www.condocontrol.com/blog/best-hoa-management-software/))

**Plaid production best practices (2025):**
- **Use `/transactions/sync`, not `/transactions/get`** for new integrations — simpler state handling; listen for `SYNC_UPDATES_AVAILABLE`, call `/transactions/sync` on receipt; you must call sync once before any sync webhook. YCM currently uses the deprecated `get`. ([Plaid — Transactions Sync migration](https://plaid.com/docs/transactions/sync-migration/), [Plaid — Transactions webhooks](https://plaid.com/docs/transactions/webhooks/))
- **Link tokens** (already used) are mandatory post-Jan-2025; migrate per-environment to test safely. ([Plaid — Link token migration](https://plaid.com/docs/link/link-token-migration-guide/))
- **Production launch checklist:** encrypted token storage (HSM/KMS), webhook **signature verification**, caching + webhooks over polling. YCM encrypts tokens (`token-crypto.ts`) but **skips webhook JWT verification** — a launch-checklist blocker. ([Plaid — Launch checklist](https://plaid.com/docs/launch-checklist/))

---

## 4. Task 4 — Plaid production plumbing (YCM is approved for prod)

**Current state (with file evidence):** the integration is real and broad — `createLinkToken`/`exchangePublicToken`/`getAccounts`/`getTransactions`/`verifyWebhook`/`removeConnection` (`plaid-provider.ts:127-258`); a webhook route with debounced async sync (`routes.ts:18939`); a per-connection advisory-locked sweep with its own run-log (`bank-feed-sync.ts`); token encryption (`token-crypto.ts`); ledger ↔ bank-tx matching (migration `0026`, `bankTransactionId` on `owner_ledger_entries`, `schema.ts:723`). **But it is not production-correct.**

**The three blocking gaps + the migration:**

| # | Gap (file evidence) | Patch | Effort |
|---|---|---|---|
| **P-1** | **Defaults to sandbox** — `process.env.PLAID_ENV ?? "sandbox"` (`plaid-provider.ts:37,49`); reads `PLAID_SECRET_SANDBOX` by default. | **Env cutover:** set `PLAID_ENV=production` + `PLAID_SECRET_PRODUCTION` + `PLAID_CLIENT_ID` (prod) in the Fly secrets; the switch already routes to `PlaidEnvironments.production` (`plaid-provider.ts:51`). No code change — config only. Verify the link product/country/webhook config in `createLinkToken` (`plaid-provider.ts:127`) matches the prod app. | **S** |
| **P-2** | **Webhook JWT verification stubbed** — `verifyWebhook` does `void rawBody; void headers;` and just JSON-parses; comment: *"a future Production cutover should add JWT verification"* (`plaid-provider.ts:215-228`). In production this accepts **unauthenticated** webhook bodies. | **Implement JWT verification** via Plaid's `/webhook_verification_key/get` (JWK) → verify the `Plaid-Verification` JWT against the raw body (ES256, key-cached). Reject on failure (do NOT 200). **This is a security gate — must land before flipping P-1.** | **M** |
| **P-3** | **Deprecated `/transactions/get`** — `transactionsGet` with offset paging (`plaid-provider.ts:194`); webhook already listens for `SYNC_UPDATES_AVAILABLE` (`routes.ts:18972`) but the sync still calls `get`, not `sync`. | **Migrate to `/transactions/sync`** — store a per-connection `transactions_cursor`; on `SYNC_UPDATES_AVAILABLE`, call `/transactions/sync` with the cursor, apply added/modified/removed deltas, persist the new cursor. Drop the listen-for-`INITIAL/HISTORICAL/DEFAULT_UPDATE` branches per Plaid guidance. | **M** |

**Migration `0043_plaid_transactions_cursor.sql`:** add `bank_connections.transactions_cursor` (text, nullable) for P-3.

**Transaction-sync → reconciliation:** the existing pipeline already feeds the weighted auto-matcher (`reconciliation/auto-matcher.ts`) and writes `bankTransactionId` onto matched `owner_ledger_entries` — P-3 only changes *how* transactions arrive (cursor-delta vs date-window), not the downstream matcher. Low blast radius.

**Plaid-production recommendation (one line):** **Land P-2 (webhook JWT verification) and P-3 (`/transactions/sync`) FIRST, then flip P-1 (`PLAID_ENV=production`) — never go live on the stubbed webhook verifier; effort is S+M+M ≈ one focused sprint, mostly inside `plaid-provider.ts` + one migration.**

---

## 5. Ranked patch list (worst-impact-first)

| Rank | Patch | Why | Effort | Deps |
|---|---|---|---|---|
| 1 | **F1 — fund-aware double-entry GL** (`gl_accounts`+`gl_entries`, `fund` dimension) | Foundation for every statement; without it reports are placeholders. | **L** | none |
| 2 | **F7a — budget-vs-actual statement** (multi-year, fund-segregated) | The headline deliverable; reproduces the Paddlers Cove income statement. | **M** | F1 |
| 3 | **F7b — balance sheet** (interfund-balanced, two-column) | The second benchmark artifact; ties Assets=L+E. | **M** | F1, F7c |
| 4 | **P-2 + P-3 — Plaid webhook JWT verify + `/transactions/sync`** | Production-correctness + security before go-live. | **M** | none |
| 5 | **A1–A4 — amenity charge + deposit hold/refund + ledger** | Closes the operational loop; produces the deposit liability line. | **M** | F1 (for A4/balance-sheet line); A2/A3 reuse live Stripe rail |
| 6 | **F7c — prepaid/deferred/AP liability sub-ledgers** | Completes the balance-sheet liability side. | **M** | F1 |
| 7 | **P-1 — `PLAID_ENV=production` cutover** | Config-only; gated behind P-2. | **S** | P-2 |

---

## 6. "Done" benchmark for the whole assignment

A board member opens YCM for one real association and can: (a) **download a budget-vs-actual income statement** with Operating + Reserve fund sections, per-account line items, and FY2024/FY2025/FY2026 columns whose fund net totals tie; (b) **download a balance sheet** as-of any date with Operating/Reserve columns, an interfund line netting to $0, an amenity-deposit liability matching held deposits, and Assets = Liabilities + Equity to the cent; (c) **book the clubhouse**, get charged the fee (on the unit ledger + amenity-income line) and have a refundable deposit held (balance-sheet liability) then refunded; (d) all of it fed by **live production Plaid** transactions arriving via verified webhooks and `/transactions/sync`, reconciled against the ledger. That is parity-or-better with the CAMS/CINC report — fully wired.

---

*Method notes: every "Absent"/"placeholder" claim is backed by a quoted line. The single most important refinement vs. AUDIT-HOA-001: fund segregation is not merely "Absent" — the `accountType="reserve"` tag exists (`routes.ts:17312`) but **fund balances are never stored** (`routes.ts:17313` `+= 0`), so the fix is a balance-bearing GL with a fund dimension, not just a new column. The P&L report being **owner-ledger-only** (no expense GL) is the deeper, less-obvious blocker for Task 1 and is the reason F1 ranks #1.*
