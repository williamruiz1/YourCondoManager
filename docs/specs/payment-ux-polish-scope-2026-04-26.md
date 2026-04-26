# Phase 1B — Payment UX Polish — Scope Questions (2026-04-26)

**PPM workitem:** `14abc92f-894d-4ff4-9508-e6f8213ced7d`
**Status:** Awaiting founder input
**Authored:** 2026-04-26 by background research agent (docs-only, no code changes)
**Branch base:** `origin/main` @ `9dd057e`

## Context

Phase 1A shipped owner-initiated ACH payments (Stripe Checkout) plus a `payment_transactions` table with status lifecycle, plus an admin transaction list. Owners and boards now report uncertainty about what happens *after* a payment is submitted: there is no in-product receipt, no per-payment status timeline, no failure-communication path, and refunds have no surface at all. This stub catalogues the open scope questions a founder session needs to resolve before Phase 1B is dispatched for implementation.

This doc is intentionally pre-decision. Q1–Q6 below are the founder's to answer.

---

## What we have today

### Server endpoints (payment-related)

Owner-facing (portal, behind `requirePortal`):
- `GET  /api/portal/balance-summary` — totals, open charges, pending payment cents
- `GET  /api/portal/payment-transactions` — owner payment history (most recent 50, all statuses)
- `GET  /api/portal/payment-transactions/:id` — single transaction detail (raw `PaymentTransaction` row)
- `POST /api/portal/pay` — initiate Stripe Checkout for an ACH payment (returns `checkoutUrl`)
- `POST /api/portal/payment-methods/setup` — Stripe Checkout in `mode=setup` to save a bank account
- `GET  /api/portal/payment-methods/setup/return` — handles Stripe redirect, persists `savedPaymentMethods`
- `POST /api/portal/payments/link/:token/checkout-session` — public-link variant for one-off pay-by-link

Admin-facing:
- `GET  /api/admin/payment-transactions` — all transactions, filterable by `associationId` + `status`
- `GET  /api/financial/payment-plans`, `POST/PATCH ...` — payment-plan CRUD (separate concept; out of scope here)

Webhook:
- `POST /api/webhooks/payments` — Stripe webhook for *owner* payments (per-association `webhookSecret` from `paymentGatewayConnections`). Updates `paymentTransactions` status, inserts `paymentWebhookEvents`, and on `succeeded` posts an `ownerLedgerEntries` row of type `payment` (negative amount). Today's path also creates an autopay-tagged ledger entry for autopay-source transactions.
- `POST /api/webhooks/platform/stripe` — separate, for *platform subscription* lifecycle (board/manager paying us). NOT used by owner payments.

### Schema

Tables that matter for this scope:
- `paymentTransactions` (server/services/payment-service.ts, shared/schema.ts:3175)
  - Status enum: `draft → initiated → pending → succeeded | failed | canceled | reversed`
  - Timestamps: `submittedAt`, `confirmedAt`, `failedAt`, `createdAt`, `updatedAt`
  - Already has `receiptReference` (e.g. `PAY-20260426-AB12CD34`, unique-indexed) and `failureCode` + `failureReason`
  - Provider IDs: `providerPaymentId` (Checkout session), `providerIntentId` (PaymentIntent), `providerCustomerId`
  - Source: `owner_initiated | autopay`; retry tracking via `attemptNumber`, `nextRetryAt`, `retryEligible`
- `paymentWebhookEvents` + `paymentEventTransitions` — full webhook audit trail
- `ownerLedgerEntries` — owner's running ledger; `payment` rows posted here on `succeeded` webhook
- `savedPaymentMethods` — last-4 + bank name only (no PCI data)
- `partialPaymentRules` — already has `sendReceiptEmail` (default 1) and `receiptEmailTemplate` columns, but NEITHER is wired to anything today (dead schema)

### Client surfaces

- `client/src/pages/portal/portal-finances.tsx` (~700 LOC)
  - "Make a payment" form (amount input + redirect to Stripe Checkout)
  - "Quick links" card (payment-methods, full ledger)
  - "Recent ledger" table (last 8 ledger entries, no per-payment detail / no per-payment status)
  - `/portal/finances/payment-methods` sub-route — saved methods CRUD
  - `/portal/finances/ledger` sub-route — full ledger
  - **No payment history page exists.** The `GET /api/portal/payment-transactions` endpoint is unused by the client today.
  - **No transaction detail page exists.** `GET /api/portal/payment-transactions/:id` is unused.
  - On Checkout return (`?payment=success&txn=...`), no toast/banner is rendered to confirm the payment was received; the user just lands back on `/portal`.

### Existing receipt mechanisms

- **Stripe's default email receipt:** Stripe sends its own ACH-payment receipt by default to the `customer_email` set on the Checkout session. We DO set `customer_email` to the owner's email in `initiateStripeCheckout` (server/services/payment-service.ts:106). So owners are already receiving the standard Stripe email "Receipt from `<gateway-account-name>`" with the amount and last-4 of the bank account, sourced from the connected Stripe account.
- **YCM-sent receipts:** zero. No `sendPlatformEmail` call fires on payment success. No PDF generator exists. The `partialPaymentRules.sendReceiptEmail` + `receiptEmailTemplate` columns are not consumed anywhere (greppable: zero call sites).
- **In-product receipt surface:** there is a `receiptReference` column populated on every transaction, but it is not surfaced in the UI. There is no "Payment History" page, no per-payment detail page, and no "download receipt" affordance.
- **Failure communications:** none. On `failed` status, `failureCode` + `failureReason` are persisted but the owner is not emailed and there is no UI surface that exposes the failure reason. ACH returns / declines today are silent from the owner's perspective.

### Pre-existing observations (relevant; no fixes here)

- The Phase 1A status lifecycle IS persisted (status enum + `submittedAt` / `confirmedAt` / `failedAt`), so a status timeline UI can read straight from the row; no server work is required just to *display* status. Good news for Q3.
- The Stripe webhook only posts a ledger entry on `succeeded`; `failed`/`pending` only update the txn row. So an "in-flight" payment is visible only by reading `paymentTransactions`, not the ledger. Status timeline UX must read both sources.
- There is no `refund` status today. `paymentTransactions.status` includes `reversed`, but no code path sets it; no Stripe `charge.refunded` handler exists in `/api/webhooks/payments`. Q5 will surface this.
- `paymentTransactions` has `currency` (defaults USD) but the client always assumes USD. Out of scope for Phase 1B unless Q1's answer touches receipt content.

---

## Open questions for founder session

### Q1 — Receipt format

**Question:** What format does a YCM-issued receipt take, given that Stripe is already sending its standard email receipt?

**Options:**
- **A. Lean on Stripe's email receipt only; build only an in-product "Payment History" page that surfaces `receiptReference` + status + a printable browser view.** No new email path, no PDF generator. Smallest scope.
- **B. YCM-sent HTML email on success** (in addition to Stripe's), branded for the association, sent via existing `sendPlatformEmail` (`server/email-provider.ts`, nodemailer/SMTP). No PDF.
- **C. HTML email + attached PDF receipt** (PDF generator added; e.g. a server-side renderer like `pdfkit` or HTML-to-PDF via headless Chrome / a hosted service).
- **D. All three: Stripe email + branded YCM email + downloadable PDF from "Payment History".**

**Recommendation:** **A**, unless Q6 (compliance) forces specific fields Stripe's receipt cannot provide. Stripe already covers the legally-defensible "you paid us" artifact; the gap owners describe is more "where do I see this in my YCM portal" than "I never got a receipt." A is also the cheapest path (~3–5 days of UI vs. 2+ weeks for a PDF generator + email template system).

**Why this matters:** Adding PDF generation introduces a new dependency (PDFKit / Puppeteer / external service) and an async generation pipeline. Adding YCM email layers our brand on top of Stripe's, which can be confusing (owner gets two receipts for one payment). Founder should weigh association branding desire vs. complexity.

---

### Q2 — Triggering events

**Question:** Which payment lifecycle events generate a YCM-side notification (UI banner / email / push)?

**Options:**
- **A. In-product surface only** — owner sees status changes by visiting Payment History; no proactive push.
- **B. + email on success** — branded "your payment was received" email on `succeeded`.
- **C. + email on failure** — "your payment failed: `<reason>`" with retry CTA.
- **D. + email on settlement delay** — ACH typically takes 3–5 business days; notify when status transitions `pending → succeeded` if it took longer than X days.
- **E. + monthly statement** — a per-month rollup regardless of activity (separate from per-payment).
- **F. + ad-hoc "email me a copy" button** on the Payment History page.

**Recommendation:** **A + C** for Phase 1B. Failure communications are the highest-leverage gap; today owners don't know their payment failed. Success-on-email is lower leverage because Stripe sends one already. Monthly statements (E) are a separate workstream — out of scope here. Settlement-delay notifications (D) can wait until autopay polish (Phase 2B).

**Why this matters:** Each trigger added means a new email template, a new test surface, and a new place a regression can break. C alone fixes the most-cited owner-experience complaint with the smallest blast radius.

---

### Q3 — Status timeline UX

**Question:** Where do owners see the per-payment status timeline (`submitted → pending → cleared → posted`)?

**Options:**
- **A. Inline on a Payment History row** — small status badge + tooltip showing the timestamps. Compact; no new page.
- **B. Dedicated detail page** at `/portal/finances/payments/:id` — full timeline with each status, timestamp, and explanatory copy ("Your bank typically takes 3–5 business days to clear an ACH payment.").
- **C. Real-time toast on submission only** — show "We received your payment, here's your reference" on the post-Checkout return; rely on the ledger for everything else.
- **D. A + B** — list view with badges, click-through to full detail.

**Recommendation:** **D**. The endpoint `/api/portal/payment-transactions/:id` already exists and is unused; building a detail page is mostly client work. Inline badges in the list give at-a-glance status without forcing a click; the detail page handles the explanatory load.

**Why this matters:** This is the cheapest highest-impact piece of Phase 1B. No backend work; pure client. Good candidate to ship first if the wave is split.

---

### Q4 — Failure communications

**Question:** When a payment fails (insufficient funds, R01–R09 ACH return, card declined), how does the owner find out and what do we tell them?

**Options:**
- **A. UI-only failure surface** — Payment History row shows "Failed: `<friendly reason>`"; no email.
- **B. + branded email** with the failure reason translated to plain English (e.g. R01 "insufficient funds" → "Your bank reported insufficient funds.") + retry CTA linking back to portal.
- **C. + retry suggestion** — if the failure category is `soft` (per existing `failureCategoryEnum`), offer a one-click retry from the email/UI; if `hard`, prompt to update payment method.
- **D. + admin / manager notification** — also notify the board/manager so they can follow up.

**Recommendation:** **A + B + C**. The friendliness of B+C is the difference between "I think my payment didn't go through?" and "I know what to do next." D adds noise for managers; defer unless they explicitly ask. Mapping ACH return codes to friendly strings is a small lookup table — the existing `failureCode` column already captures the raw Stripe code.

**Why this matters:** The schema already has `failureCategory` (`soft`/`hard`/`unknown`), which means the retry-eligibility logic from Phase 2 autopay can be reused for this. Coupling this work with autopay's existing retry primitives keeps the surface coherent.

---

### Q5 — Refund visibility

**Question:** When a refund happens (manager initiates from Stripe dashboard, or owner requests one), how does it surface in the owner's view?

**Options:**
- **A. Out of scope for 1B.** Refunds are handled today via manual ledger adjustment (admin posts a credit). Don't change this in 1B.
- **B. Listen to `charge.refunded` webhook** — flip the corresponding `paymentTransactions.status` to `reversed`, post a `credit`-type `ownerLedgerEntries` row, render in Payment History as "Refunded".
- **C. + email notification** to the owner when a refund posts.
- **D. + an in-portal "request refund" CTA** that opens a manager-side request (separate workstream).

**Recommendation:** **A** for Phase 1B; tag B as a Phase 2 candidate. Refund volume is low at YCM's current scale, the manual-adjustment path works, and `charge.refunded` requires careful idempotency (we'd be inserting a credit ledger entry that could double up with the manager's manual adjustment). Don't ship until autopay's failed-charge dunning is also in place — same plumbing.

**Why this matters:** This is the one place where "polish" can introduce real correctness risk if rushed. Worth a separate spec session if founder picks B.

---

### Q6 — Compliance fields

**Question:** What must appear on a YCM-rendered receipt (whether email, PDF, or in-portal printable view)?

**Stripe's default receipt already includes:** payee (the connected Stripe account's business name), amount, date, last-4 of bank account, transaction ID. So this question is only "live" if Q1 answer is B/C/D.

**Candidate fields:**
- Association legal name + mailing address
- Owner name + unit number
- Amount, date, payment method (bank name + last-4)
- `receiptReference` (YCM-side ID, already generated)
- Stripe `providerPaymentId` (cross-reference)
- Description / what the payment was for (e.g. "April 2026 HOA dues")
- For Florida (jurisdiction-specific): per FS 718.111(15), receipts for assessments may require itemization of which assessment was paid — TBD whether this is a "must" for our customer base
- Disclaimer / "questions? contact `<association-email>`"

**Recommendation:** Defer the jurisdiction question. If Q1 lands on A (Stripe-only emails + in-portal page), the in-portal view should display all candidate fields above for completeness; no legal review needed because Stripe's email is the authoritative receipt. If Q1 lands on B/C/D, schedule a separate 30-minute legal-review pass before locking the template.

**Why this matters:** "Compliance" is a yes/no gate on shipping a YCM-issued receipt. If we don't ship one (Q1 = A), it's a non-issue.

---

## Out-of-scope (explicit)

- **Autopay UX polish** — separate workstream, Phase 2B. Don't conflate.
- **ACH return-code handling depth** — beyond rendering a friendly reason and offering retry. Full R-code automation (e.g. auto-disable methods on R02 "account closed") is a Phase 2 concern.
- **Monthly statement generation** — Q2 option E. Different artifact, different cadence, different audience (owner vs. all-units).
- **Late-fee triggering** — already in `delinquencySettings`. No changes here.
- **Manager / admin payment-management tooling** — only `/api/admin/payment-transactions` (exists) is in play. New admin actions are a separate spec.
- **Multi-currency** — out of scope until a real customer needs it.
- **Refund initiation from within YCM** — Q5 option D. Separate spec.
- **Payment-plan UI polish** — separate domain (`paymentPlans` table).

---

## Suggested architecture sketch (post-decisions)

Once Q1–Q6 are answered, the implementation likely looks like:

**If founder picks the "lean" path (Q1=A, Q2=A+C, Q3=D, Q4=A+B+C, Q5=A, Q6=defer):**

Server (small):
- New friendly-reason mapper for `failureCode` → owner-readable string (server/services/payment-service.ts, ~50 LOC)
- New `sendPaymentFailureEmail` helper using existing `sendPlatformEmail` (~80 LOC + a template)
- Wire it into the webhook path at `/api/webhooks/payments` after `updatePaymentTransactionStatus` returns `failed` (~10 LOC)
- One new endpoint: `POST /api/portal/payment-transactions/:id/retry` for soft-failure retries (~60 LOC; reuses existing `createPaymentTransaction` + `initiateStripeCheckout`)

Client (most of the work):
- New page `/portal/finances/payments` (Payment History) reading `GET /api/portal/payment-transactions` — list view with status badges (~250 LOC)
- New page `/portal/finances/payments/:id` (Payment Detail) reading `GET /api/portal/payment-transactions/:id` — timeline + receipt-style fields + retry CTA when applicable (~300 LOC)
- Toast on portal-finances post-Checkout return (`?payment=success&txn=...`) confirming receipt (~30 LOC)
- Translation strings (`i18n` keys for new UI)

Schema:
- No new tables. The `partialPaymentRules.sendReceiptEmail` column can be wired up if the founder wants per-association opt-out, otherwise leave dormant.

Testing:
- New unit tests for the failure-reason mapper
- New integration test for `POST /api/portal/payment-transactions/:id/retry`
- New e2e tests for Payment History + Detail pages

**Estimated total LOC:** ~700–900 across server + client. ~1 week of focused execution. No migration. No new infra.

**If founder picks the "branded" path (Q1=B+, Q2=A+B+C, etc.):** add ~400 LOC for templated success email + per-association branding controls; another ~3–5 days. PDF (Q1=C+) adds the PDF library + storage discussion (separate spec recommended).

---

## Notes flagged for founder during research

- **Stripe IS already sending email receipts** — confirmed in `initiateStripeCheckout` (line 106 of `payment-service.ts`). If the founder's working assumption was "owners get nothing today," that needs adjusting before Q1 is answered. The complaint may be more "I can't see this in YCM" than "I have no receipt at all."
- **`partialPaymentRules.sendReceiptEmail` + `receiptEmailTemplate` are unused dead schema.** A YCM-sent email path was anticipated by an earlier spec but never wired. Deciding whether to wire those columns or ignore them is a sub-decision of Q1.
- **No payment-history client surface exists at all today.** The `paymentTransactions` data is only reachable via the admin list. This is the single biggest "polish" opportunity.
- **Refunds are not modeled in code today.** The schema has `reversed` status but it is never set. If Q5 lands on B, this is real net-new work, not polish — flag for separate spec.
