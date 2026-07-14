## Audit finding — Plaid auto-match scope is too narrow: only matches portal-initiated pay-intents

**Audit:** YCM HOA-billing pipeline audit, Pass B/C cross-cut (2026-05-25)

**Code evidence:**
- `server/services/plaid-reconciliation.ts:84-95` eligible-ledger-entries query:
  ```ts
  .where(and(
    eq(ownerLedgerEntries.associationId, associationId),
    eq(ownerLedgerEntries.referenceType, "plaid-pay-intent"),  // ← too narrow
    isNull(ownerLedgerEntries.settledAt),
    isNull(ownerLedgerEntries.bankTransactionId),
  ))
  ```
- Production state: 2 plaid-pay-intent entries exist (William's test payments — `68580bb1...` and `ccf2f0fd...`), both with `settled_at: null` and `bank_transaction_id: null`. They will settle ONLY when (a) Plaid syncs the corresponding Chase credit AND (b) someone hits `POST /api/plaid/reconcile`. Per Gap #2, that endpoint is never auto-called.

**The gap (architectural):**
Auto-match is hard-coded to one referenceType. Any other payment path that lands in the HOA's bank account — owner pays via Zelle directly → bank credit arrives via Plaid sync → no `plaid-pay-intent` entry exists for it → auto-match skips it. The treasurer is forced to manual-match it via the admin UI (`financial-bank-connections.tsx:175-187`).

This breaks William's "no manual identification" requirement for the Zelle / external-ACH / check-deposit channels. Even with Plaid sync auto-firing (Gap #2 fixed), those credits will pile up unmatched.

**The deeper issue:**
Auto-matching arbitrary bank credits to owners requires SOMETHING to identify the payer. Bank-tx description fields (Plaid `name`, `merchantName`) for Zelle transfers usually include the sender name; for checks, the memo or check number; for external ACH, the originator name. The current `bank_transactions` schema captures `name` + `merchantName` but NO heuristic matches them to known owners (person names, emails, unit numbers).

**Recommended dispatch:**
1. Extend `reconcileBankTransactions` to also walk unmatched-credit ↔ owner heuristics: for each unmatched credit, fuzzy-match `name`/`merchantName` against `persons.firstName + lastName + email-local-part` for the association. If exact-or-near match + amount sanity-check (≥$50, ≤$5k by default), auto-create a `referenceType='auto-identified-bank-credit'` ledger entry linked to the bank_tx with `settled_at=now`.
2. For ambiguous matches (multiple owner candidates), do NOT auto-create — surface as "Identify this payment" in the admin UI with the candidates pre-ranked.
3. Capture admin manual-match decisions as training signal: when a treasurer matches "Z. RUIZ" to William Ruiz / Unit 1421-C, store the descriptor → person mapping in a new `bank_descriptor_aliases` table so subsequent credits with the same descriptor auto-match without asking.

**Authorization:** read-only audit. No code changes made.
