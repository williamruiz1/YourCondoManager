# Admin Financials — Information-Architecture Audit & Proposal (2026-06-30)

**Author:** financials audit agent · **Trigger:** William walked the admin Financials section live and found it broken + confusingly structured.
**Status:** AUDIT + PROPOSAL. The clear bugs are fixed in this PR; the accounting-structure decisions are surfaced for William — **not** unilaterally redesigned.

---

## TL;DR

- The financials nav has **7 top-level pages** but they overlap: "recurring HOA dues" is surfaced under **both** "Chart of Accounts" **and** "Assessment Rules," and "Assessment Rules" mixes recurring HOA dues with one-time special assessments. That conflation is the confusion William hit.
- The conflation is a **naming / placement** problem at the surface, and a **GL income-account** question underneath (dues + special assessments both post to one income account today — a held decision).
- Proposal: rename + re-place so the three concepts are cleanly separated — **Recurring HOA Dues** vs **Special Assessments** vs the **Chart of Accounts (general ledger)** — and surface the GL income-account split as a genuine decision for William.

---

## 1. What each page actually does today (mapped from the routes + components)

Nav is defined in `client/src/lib/sub-page-nav.ts` (`financeSubPages`). Each tab and its real content:

| Nav label (route) | Page file | Tabs / content it actually renders |
|---|---|---|
| **Chart of Accounts** (`/app/financial/foundation`) | `financial-foundation.tsx` | **Accounts** (GL chart of accounts — add account: expense/income/asset/liability), **Account Activity** (GL account ledger), **Recurring Charges** → `FinancialRecurringChargesContent` |
| **Billing** (`/app/financial/billing`) | `financial-billing.tsx` | **Ledger** (`financial-ledger`), **Assessments** (`financial-assessments` = special assessments), **Late Fees**, **Delinquency** |
| **Assessment Rules** (`/app/financial/rules`) | `financial-rules.tsx` | **Recurring** → `FinancialRecurringChargesContent` (same component as under Chart of Accounts), **Special Assessments** → `FinancialAssessmentsContent`, **Run History** |
| **Payments** (`/app/financial/payments`) | `financial-payments.tsx` | Record payments, payouts, reconcile |
| **Expenses** (`/app/financial/expenses`) | `financial-expenses.tsx` | Invoices, Utilities, Budgets |
| **Reports** (`/app/financial/reports`) | `financial-reports.tsx` | Reconciliation + owner reconciliation reports |
| **Statement** (`/app/financial/statement`) | `financial-statement.tsx` | Per-owner printable account statement |

### The data model underneath (where the truth lives)

- **Recurring HOA dues** → `recurring_charge_schedules` + `recurring_charge_runs` (a cadence that posts a `charge` ledger entry per unit each period). UI: `FinancialRecurringChargesContent`.
- **Special assessments** → `special_assessments` (a one-time or installment levy with `totalAmount`, `installmentCount`, allocation method, etc.). UI: `FinancialAssessmentsContent`.
- **Chart of accounts / general ledger** → `server/services/gl/posting.ts` chart + GL postings. UI: the "Accounts" + "Account Activity" tabs of `financial-foundation.tsx`.
- **Owner ledger** (`owner_ledger_entries`, `ownerLedgerEntryTypeEnum`: `charge` / `assessment` / `payment` / `late-fee` / `credit` / `adjustment`) is the subledger that both dues and special assessments write into.

---

## 2. The conflation (root of William's confusion)

Three distinct concepts are tangled across the nav:

1. **Recurring HOA dues** (the monthly/quarterly assessment every owner pays — the lifeblood of the HOA) live as `recurring_charge_schedules`, surfaced as `FinancialRecurringChargesContent`.
2. **Special assessments** (a one-time / installment levy for a specific project — an $80k driveway repair, etc.) live as `special_assessments`, surfaced as `FinancialAssessmentsContent`.
3. **Chart of Accounts** (the general-ledger account list — income/expense/asset/liability) is the accounting backbone, surfaced in `financial-foundation.tsx`.

The specific tangles:

- **(A) Recurring HOA dues appear in TWO places.** `FinancialRecurringChargesContent` is rendered both under **"Chart of Accounts"** (foundation → "Recurring Charges" tab) **and** under **"Assessment Rules"** (rules → "Recurring" tab). Two doors to the same thing → "which one is canonical?" confusion.
- **(B) "Recurring charges" under "Chart of Accounts" reads like HOA fees, not like the GL.** A user opening Chart of Accounts expects the account list (income/expense), and instead finds a dues-billing schedule sitting next to it. Dues billing is not a chart-of-accounts concern.
- **(C) "Assessment Rules" conflates dues with special assessments.** It groups **recurring HOA dues** ("Recurring" tab) with **special assessments** ("Special Assessments" tab) under one page literally named "Assessment Rules," and its "schedule of charges" framing makes recurring HOA dues *look like* special assessments. **HOA dues are NOT special assessments** — they are the routine operating revenue; special assessments are exceptional, project-specific levies. Putting them under one "Assessment" umbrella is the core mislabel.
- **(D) "Special Assessments" also appears under "Billing"** (`financial-billing.tsx` → "Assessments" tab renders `FinancialAssessmentsContent`) **and** under "Assessment Rules." Same two-doors problem as (A), for special assessments.

---

## 3. Proposed clean structure (the low-risk re-org)

Goal: one canonical home per concept, with names that say what the thing IS. This is a **label + placement** re-org of existing, working components — no new accounting behavior.

| Concept | Proposed nav home | Proposed label | Backed by (unchanged) |
|---|---|---|---|
| Routine monthly/periodic HOA assessment | **Billing → Recurring Dues** (single canonical tab) | **"Recurring Dues"** (not "Recurring Charges", not "Assessment Rules") | `recurring_charge_schedules` / `FinancialRecurringChargesContent` |
| One-time / installment project levy | **Billing → Special Assessments** (single canonical tab) | **"Special Assessments"** | `special_assessments` / `FinancialAssessmentsContent` |
| General-ledger account list + activity | **Chart of Accounts** (GL only) | keep "Chart of Accounts" — but it holds ONLY Accounts + Account Activity | `gl/posting.ts` chart |

Concretely:
1. **Remove "Recurring Charges" from "Chart of Accounts."** Chart of Accounts = the GL only (Accounts + Account Activity). Dues billing does not belong next to the account list.
2. **Rename "Assessment Rules" → "Billing Rules"** (or fold its two tabs into the existing **Billing** page so there is ONE billing surface). Inside it, label the two tabs clearly: **"Recurring Dues"** and **"Special Assessments"** — and never call recurring dues an "assessment."
3. **Pick ONE canonical home for Special Assessments** — it currently lives under both Billing and Assessment Rules. Recommend keeping it under **Billing** and removing the duplicate.
4. **Copy/labels:** anywhere dues are referred to as "assessments" or "charges," call them **"HOA Dues."** (The owner-facing side already did this in #308: `entryType "charge" → "HOA Dues"`, `"assessment" → "Special Assessment"`. The admin side should match.)

Net result the user sees: **Chart of Accounts** = the ledger; **Billing** = where you set up and run dues + special assessments (clearly separated tabs); no concept has two doors; nothing is mislabeled an "assessment" that is really routine dues.

---

## 4. The genuine accounting decisions for William (DO NOT guess these)

These change the **accounting model**, not just labels. Surfaced, not implemented.

### Decision 1 — Should recurring HOA dues and special assessments post to SEPARATE income accounts? (the held GL decision)

**Today** (`server/services/gl/posting.ts`): both `charge` (recurring HOA dues) and `assessment` (special assessments) post to **`4000 Assessment Income`** (operating fund). The chart already defines an unused **`4010 Reserve Fund Contributions`** (reserve fund).

- **Option A — keep one income account (status quo).** Simplest; but the income statement can't tell routine dues revenue from project-specific assessment revenue, and special-assessment funds (often legally restricted to the project / reserve) aren't segregated in the GL.
- **Option B — split: HOA dues → `4000` (operating); special assessments → a dedicated income account** (e.g. `4010 Reserve Fund Contributions` if the assessment funds reserves, or a new `4020 Special Assessment Income`). Matches the common HOA-accounting practice of segregating operating vs assessment/reserve revenue and supports fund accounting.

**Why this is William's call:** it's a chart-of-accounts / fund-accounting policy decision with downstream effects on reports, the income statement, and possibly statutory reserve segregation — exactly the kind of GL-model choice that should be ratified, not guessed. (This is the pre-existing "held decision" the owner-facing #308 also deferred: *"DISPLAY-ONLY — no GL income-account mapping change (held decision)."*)

### Decision 2 — Where should "Special Assessments" live, and should "Assessment Rules" be renamed/folded?

Proposal §3 recommends folding into **Billing** with clear tabs and renaming away from "Assessment Rules." This touches nav taxonomy that William may have an opinion on (and any saved muscle memory / deep links). Recommend ratifying the §3 nav re-org before implementing the page moves. (This PR does NOT move pages — it fixes the bugs; the nav re-org is staged behind William's ratification.)

### Decision 3 — Is "Account Activity" (GL account ledger) the right thing to surface under Chart of Accounts, or should it be its own "General Ledger" page?

Minor, but if Chart of Accounts becomes GL-only, "Account Activity" might read better as a sibling "General Ledger" view. Defer to William's preference.

---

## 5. What this PR did vs. deferred

**Fixed (clear bugs / low-risk):**
- Expenses + Reports load error — diagnosed as **stale-chunk after deploy**, not a real build break (clean build emits all chunks); added a chunk-reload guard so a post-deploy stale tab self-recovers instead of dead-screening.
- Admin **Statement renders empty** — the owner dropdown was filtering on the nullable `persons.association_id` fence (NULL for CHC), so it was empty and no owner could be picked. Fixed to scope via the server (ownership/ledger model), matching #307.
- Run History **status clarity** — "success" now reads "Charge posted · $X" with a tooltip.
- Run History **unit column** — now shows building + unit (`Building A · Unit 1`), not a bare ambiguous number.

**Deferred to William (genuine decisions, §4):** the GL income-account split (Decision 1), the nav re-org / "Assessment Rules" rename + page moves (Decision 2), and the GL-page naming (Decision 3). No accounting model or nav taxonomy was changed unilaterally.
