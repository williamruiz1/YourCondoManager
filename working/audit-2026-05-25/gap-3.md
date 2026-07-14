## Audit finding — no admin "record incoming payment" surface for Zelle / check / cash / external-ACH; only generic ledger-entry post

**Audit:** YCM HOA-billing pipeline audit, Pass C + Pass D (2026-05-25)

**Production evidence:**
- Existing admin endpoint: `POST /api/financial/owner-ledger/entries` (`server/routes.ts:5916-5926`) accepts the generic `insertOwnerLedgerEntrySchema` (associationId, unitId, personId, entryType, amount, postedAt, description, referenceType, referenceId). No payment-method, no bank-tx link.
- Admin UI: `client/src/pages/financial-ledger.tsx:250-286`. Form fields: associationId, unitId, personId, entryType, amount, postedAt, description. **No payment-method dropdown. No "match against bank credit" action.**
- The auto-match algo (`server/services/plaid-reconciliation.ts:91`) ONLY matches ledger entries with `referenceType='plaid-pay-intent'`. A treasurer manually posting a "payment" ledger entry will have `referenceType: null` or `"import"` — auto-match will NEVER consider it. So a check posted to the ledger + a corresponding Chase deposit synced via Plaid will sit as TWO unreconciled records.
- Bank-statement CSV import path exists in parallel (`server/routes.ts:6009-6056`, `client/src/pages/financial-reconciliation.tsx`). Its auto-match (`server/routes.ts:6078-6115`) walks `bank_statement_transactions` against `ownerLedgerEntries` with ±$0.01 / ±5 days. So CSV imports ARE matched to manual payment entries. BUT the bank-statement path and the Plaid path are TWO SEPARATE SYSTEMS — same data goal, two different `bank_*` table sets, two different match algos.

**The gap:**
1. There is no single "Record incoming payment" admin form that captures method (cash/check/Zelle/external-ACH), check number / Zelle reference / payer note, owner/unit, amount, posted date — and then attempts to match against synced Plaid bank credits.
2. The dual-pipeline (Plaid bank_transactions + CSV bank_statement_transactions) creates confusion. Plaid auto-reconcile ignores admin-posted payments; CSV auto-reconcile is the only path that does the cross-side matching.
3. A treasurer who receives a Zelle deposit and reads the bank statement has no canonical workflow: post a manual ledger payment? Wait for Plaid sync + run manual-match in bank-connections page? Upload a CSV and run CSV auto-match? Three valid paths, no UX guidance, ambiguous source of truth.

**Recommended dispatch:**
1. Build a `POST /api/financial/payments/record` endpoint + admin UI that captures: method (`cash | check | zelle | external-ach | other`), reference (check# / Zelle handle / memo), owner+unit (auto-suggest from name/email), amount, date. Creates a ledger entry with `referenceType='manual-payment'` + a structured `payment_method` field (new column or in description JSON).
2. On creation, attempt auto-match against unmatched `bank_transactions` for the same association + amount + ±5 days. If exactly one match: auto-link. If multiple: show candidate list. If none: post unmatched, will be linked when Plaid sync brings in the corresponding credit (extend `reconcileBankTransactions` to also consider `referenceType='manual-payment'`).
3. Decide canonical reconciliation surface: Plaid (`bank_transactions` + `plaid-reconciliation.ts`) or CSV (`bank_statement_transactions` + inline auto-match). Recommend deprecating CSV path now that Plaid is wired, OR explicitly scope CSV as "for HOAs without Plaid connection."

**Authorization:** read-only audit. No code changes made.
