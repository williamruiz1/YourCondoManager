# Owner Portal — "My Finances" + Payment Rework — Scope & Requirements

**Date:** 2026-06-30
**Association under test:** Cherry Hill Court (`f301d073-ed84-4d73-84ce-3ef28af66f7a`)
**Stripe Connect:** LIVE — `acct_1TnzDnArorHrelxs`, `charges_enabled=true`, `payment_gateway_connections.is_active=1`
**Fly app:** `yourcondomanager` (auto-deploys from `main` on merge)

> Requirements ARE the definition of done. Each finding maps to a fix and an acceptance test (software → test; non-software/UI → acceptance checklist).

---

## Root-cause findings (from reading the code)

1. **Owner-pay UI surfaces PLAID prominently.** `PortalBankPaymentCard` (in `portal-finances.tsx`) is rendered on the hub and drives `/api/portal/plaid/*` ("Connect your bank" via Plaid Link). The Stripe path (`POST /api/portal/pay` → Stripe Connect Checkout, already correct server-side) is buried in a small "Make a payment" card. **The owner-facing PAY experience must be Stripe, not Plaid.**
2. **"Add method" button is dead because the SETUP endpoint is not Connect-aware.** `POST /api/portal/payment-methods/setup` requires a manual `gateway.secretKey`. CHC is on **Connect** (no manual key) → the endpoint 400s → the client `onSuccess`/redirect never fires → button "does nothing" with no visible error. Fix: make setup Connect-aware (platform key + `Stripe-Account` header, mirroring `/api/portal/pay`) AND surface errors in the UI.
3. **Balance merges HOA dues + special assessments.** Top-of-page `balance` is a single lifetime sum. Owners need: **current HOA dues due**, **current assessment installment due** (NOT the full lump), **total** — broken out.
4. **"My Finances" is one thin page.** Needs a coherent finances view: balance broken out, what's due now, upcoming installments, payment history, ledger.
5. **Ledger lacks unit clarity + uses raw type labels.** Rows say raw `entryType` ("charge") with no unit. Need human labels ("HOA Dues", "Special Assessment") + unit attribution.

---

## Requirements → Fix → Acceptance test (continuity matrix)

| # | Requirement | Fix | Acceptance test |
|---|---|---|---|
| R1 | Owner PAY flow uses Stripe (Connect Checkout), not Plaid. | Remove `PortalBankPaymentCard` (Plaid) from the owner hub. Promote a Stripe "Pay" card that calls `POST /api/portal/pay` (already Connect-routed). | Hub renders no Plaid "Connect your bank" CTA; "Pay" card present and wired to `/api/portal/pay`. Client test asserts the pay mutation POSTs `{amountCents,unitId}` to `/api/portal/pay`. |
| R2 | A CHC owner can reach a real Stripe Checkout URL (Connect live). | `/api/portal/pay` already prefers Connect routing. Validate against CHC: resolver returns active routing → checkout created with `Stripe-Account` header. | Server unit test: given an active Connect connection, `/api/portal/pay` calls `initiateStripeCheckout` with `stripeAccountHeader` set + `applicationFeeCents`. (Do NOT move real money.) |
| R3 | "Add method" works (opens Stripe payment-method setup). | Make `POST /api/portal/payment-methods/setup` Connect-aware: use platform key + `Stripe-Account` header when Connect is active; fall back to manual key. Surface setup errors in the UI (no silent dead button). | Server unit test: setup endpoint with active Connect → creates customer + setup session on the connected account. Client test: clicking "Add method" on error shows a visible message. |
| R4 | Balance separates dues vs assessment installments; shows what's due now (installment, not lump). | Add a "What's due now" breakdown: current dues + current assessment installment(s) (from `specialAssessmentUpcomingInstallments`) + total. Keep lifetime total as reference. | Client test: given dashboard with `byUnit` dues + an upcoming installment, the "due now" section shows dues, installment, and a total that = dues + installment (NOT the full assessment principal). |
| R5 | Fuller "My Finances" page. | Restructure hub: (a) "What's due now" hero (dues / installment / total), (b) lifetime balance reference, (c) paid/charged YTD, (d) Stripe pay card, (e) upcoming installments, (f) by-unit breakdown, (g) recent ledger + links to full ledger/statement/receipts/payment-methods. | Acceptance checklist: all sections render; visual review. |
| R6 | Coherent ledger: unit attribution + human type labels. | Map `entryType` → human label (charge → "HOA Dues", assessment → "Special Assessment", late-fee → "Late Fee", payment → "Payment", credit → "Credit", adjustment → "Adjustment"). Show unit label per row. Apply in hub recent-ledger, full ledger, by-unit entries. | Client test: a `charge` row renders "HOA Dues" (not "charge"); a row shows its unit label. |
| R7 | tsc clean; no new test failures; tests for the pay-flow rewire. | — | `npx tsc --noEmit` clean; `vitest` green; new tests added. |

## Explicitly OUT of scope (held / do-not-touch)
- GL income-account mapping / the deeper dues-to-GL split (separate held decision). Only owner-facing **display** label `charge`→"HOA Dues" changes.
- Admin bank-FEED / reconciliation Plaid path (`/api/admin/*`) — untouched. Plaid removal is ONLY from the owner PAY experience.
- Moving real money / live charges.
- Autopay enrollment flow logic (kept as-is; surfaced).
