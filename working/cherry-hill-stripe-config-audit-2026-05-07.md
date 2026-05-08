# Cherry Hill — Stripe Config & Payment Flow Audit (CH-4)

**Auditor:** Founder OS Worker [015] (Builder 1 charter, dispatched per Issue
[founder-os#259](https://github.com/williamruiz1/founder-os/issues/259))
**Date:** 2026-05-07 (audited 2026-05-08)
**Scope:** Read-only. No code changes; no live Stripe API calls.
**Repo:** `williamruiz1/YourCondoManager` @ `origin/main` (`2c968e3`)

---

## 1. Association record

**Verdict:** ✅ EXISTS — and the seed has two records named "Cherry Hill", only one of which matches the dispatch context (Connecticut, 18 units).

| Field | Value | Source |
|---|---|---|
| Association ID | `f301d073-ed84-4d73-84ce-3ef28af66f7a` | `server/seed.ts:28` |
| Name | Cherry Hill Court Condominiums | `server/seed.ts:28` |
| Type | HOA | `server/seed.ts:28` |
| Date formed | 1990-07-16 | `server/seed.ts:28` |
| EIN | 06-1513429 | `server/seed.ts:28` |
| Address | 1405 Quinnipiac Ave., New Haven, CT, USA | `server/seed.ts:28` |

**Disambiguation note:** `server/seed.ts:29` has a SECOND row also named "Cherry
Hill Court" (`628b7d4b-b052-44a5-9bcc-69784581450c`, condo, NJ). The CT record
above is the dispatch target; the NJ record is unrelated and should be left
alone unless William instructs otherwise.

**Buildings** seeded under `f301d073...` (`server/seed.ts:124–134`):

| Building ID | Label | Total units |
|---|---|---|
| `b11ea5a8-d907-4063-a0ed-640874159f61` | 1415 | 1 |
| `f249583c-5d75-4865-a6ca-d01f0b4dd3a6` | 1417 | 7 |
| `8a0fafb2-cc66-400f-a3dc-74617e39eefc` | 1419 | 1 |
| `e4f64f48-6136-457c-af87-20223cfc81ef` | 1421 | 4 |
| **Total** | | **13** |

⚠️ **Gap A — unit count mismatch.** Dispatch states 18 units; seed has 13
across 4 buildings. Either (a) the seed is incomplete and additional
buildings/units need to be added before Phase 1 import, or (b) some buildings
have additional unsealed units not yet captured. Surface to William as a human
task — physical reality wins; the seed should match.

---

## 2. Payment gateway connection

**Verdict:** ❌ MISSING — no `payment_gateway_connections` row exists for the
Cherry Hill Court Condominiums association.

The seed file (`server/seed.ts`) does not call any of the gateway-creation
helpers that would write into `paymentGatewayConnections`. The schema is at
`shared/schema.ts:508–525` and is shaped (relevant subset):

```ts
paymentGatewayConnections = pgTable("payment_gateway_connections", {
  id: varchar("id").primaryKey(),
  associationId: varchar("association_id").notNull(),
  provider: paymentGatewayProviderEnum("provider").notNull().default("stripe"),
  providerAccountId: text("provider_account_id"),
  publishableKey: text("publishable_key"),
  secretKeyMasked: text("secret_key_masked"),
  webhookSecretMasked: text("webhook_secret_masked"),
  validationStatus: pgEnum(...).notNull().default("valid"),
  isActive: integer("is_active").notNull().default(1),
  // ...
});
// uniqueGatewayPerAssociationProvider: (associationId, provider)
```

Population path is `storage.upsertPaymentGatewayConnection()`
(`server/storage.ts:7440`+); admin UI calls it via `POST` /
`PATCH` on `/api/admin/payment-gateway-connections` routes
(`server/routes.ts:5208` and surrounding) which require the secret key,
publishable key, optional webhook secret, and pass key-format validation
(`secretKey.startsWith("sk_")` per `server/storage.ts:462,466`).

No row → no online ACH checkout for any owner of this association
(`server/routes.ts:5274–5283` 303-redirects with `checkout=unavailable` when
`getActivePaymentGatewayConnection({ associationId, provider: "stripe" })`
returns null or has no `secretKey`).

⚠️ **Gap B — Stripe gateway must be created before any owner attempts payment.**
Surface to William as a human task: he needs to provision a Stripe account
(or designate the platform Stripe account) for this association, then upsert
a gateway connection record via the admin UI.

---

## 3. Payment flow trace (end-to-end, read-only)

The flow William's owners will go through, in code order:

### 3.1 Owner-facing portal page (entry)

`server/routes.ts:566–574` renders an HTML payment-link landing page.
The form `POSTs` to `/api/portal/payments/link/:linkToken/checkout-session`.

Required prior state: an `owner_payment_links` row was created for this
owner's `personId` + `unitId` + `associationId` (with a `token`, `amount`,
and `status='active'`). Today these are typically created either:
- Via owner-portal route handlers
  (`server/routes.ts:5742+` parses `insertOwnerLedgerEntrySchema`), OR
- Via admin admin/financial routes when sending a payment request.

For Cherry Hill the path will be the admin creating links from the
reconciliation report (CH-3 deliverable) once Phase 1 ledger import lands.

### 3.2 Checkout session creation

`server/routes.ts:5258–5395` is the heart of the flow:

1. **Token lookup** (line 5263) → fetches `ownerPaymentLink` by token. 404 if
   missing; redirect-303 if status ≠ active.
2. **Gateway lookup** (line 5274) →
   `storage.getActivePaymentGatewayConnection({ associationId, provider: "stripe" })`.
   **No gateway → 303 to `?checkout=unavailable`** (this is where Cherry Hill
   currently terminates given Gap B).
3. **Balance compute** (line 5285) → joins `associations`, `units`, `persons`,
   `ownerLedgerEntries`. Sums all ledger entries → outstanding balance.
4. **Amount validation** (line 5301) → bounded by `min(outstandingBalance, link.amount)`.
   If `allowPartial=0` requires exact-amount match.
5. **Stripe Checkout API call** (line 5340+) → constructs `URLSearchParams`
   with `mode=payment`, `payment_method_types[0]=us_bank_account`, success/cancel
   URLs, line items, customer email, and POSTs directly to
   `https://api.stripe.com/v1/checkout/sessions` using the gateway's
   stored secret key as bearer auth. (Implementation note: this is a raw
   `fetch` call, NOT the `stripe` SDK — visible in adjacent lines.)
6. **303 redirect** to the Stripe-hosted Checkout URL on success;
   `checkout=error` on failure.

### 3.3 Webhook ingestion → ledger entry

`server/routes.ts:5495+` handles `POST /api/webhooks/payments`:

1. **Signature verification.** Multiple paths supported:
   - `Stripe-Signature` header → uses `gateway.webhookSecret` for HMAC
   - `x-webhook-hmac-sha256` → uses `webhookSigningSecrets` table per-association
   - `x-payment-webhook-secret` → falls back to `PAYMENT_WEBHOOK_SHARED_SECRET` env
   No verification configured → 403 (good — fails closed).
2. **Event normalization** (line 5538+) → produces `normalizedStripeEvent`
   with `transactionId`, `gatewayReference`, `status`.
3. **Transaction status update** (line 5547+) → calls
   `updatePaymentTransactionStatus` to set `succeeded` / `failed` / `pending` on
   the matching `payment_transactions` row.
4. **Ledger insertion (autopay only)** (line 5556+) → for `source==='autopay'`
   transitions to `succeeded`, inserts a single `ownerLedgerEntries` row with:
   - `entryType: "payment"`
   - `amount: -(amountCents/100)` (negative — paid against balance)
   - `referenceType: "autopay_payment_transaction"`
   - `referenceId: txnId`
   The `existingLedger` lookup (line 5559) prevents duplicate insertion on
   webhook retry.

⚠️ **Gap C — non-autopay payment-link checkouts may NOT auto-create ledger entries.**
The webhook handler's ledger-entry creation is gated on
`updatedTxn.source === "autopay"`. Owner payment-link Checkout sessions
(the Cherry Hill use case) will create `payment_transactions` rows but the
audit code path only writes to `ownerLedgerEntries` when source is autopay.
Either (a) there's a separate code path I missed that writes the ledger entry
for `source='owner_payment_link'` transactions, or (b) reconciliation has to
happen via the bank-statement-import flow (existing `financial-reconciliation.tsx`).
Surface this for Phase 4 implementation review — likely an additional
auto-ledger-write branch is needed for owner-payment-link checkouts to keep
balances current without bank-import lag.

### 3.4 Portal balance display

The portal balance the owner sees is derived live from
`ownerLedgerEntries` (sum of all rows for `unitId + personId`). No caching
layer was found in the audited routes; whatever's in the ledger table at
query time is what shows. So if Gap C is real, owner-visible balances
will lag until the bank-statement reconciliation page imports the matching
bank deposit and posts the offsetting ledger entry.

---

## 4. Stripe mode (test / live)

**Verdict:** ⚠️ INDETERMINATE without inspecting the production `payment_gateway_connections`
row(s); the codebase supports both modes and does not hardcode either.

The codebase deduces test/live mode at gateway-upsert time
(`server/storage.ts:466`):

```ts
const keyMode = payload.secretKey.startsWith("sk_live_")
  ? "live"
  : payload.secretKey.startsWith("sk_test_")
  ? "test"
  : "unknown";
```

This `keyMode` is stored as part of `metadataJson` on the gateway row but is
NOT exposed in any audit-friendly listing endpoint I found. To answer
"is YCM Stripe in test or live mode for Cherry Hill?", the answer depends on
which secret key gets configured when Gap B is closed.

⚠️ **Gap D — no surface for "what mode is each gateway in".** Suggest CH-3
or a follow-up dispatch add a column to the admin gateway listing
(`/api/admin/payment-gateway-connections` GET response) exposing
`metadataJson.keyMode` so William can verify at-a-glance.

The `PLATFORM_STRIPE_SECRET_KEY` referenced at `server/routes.ts:13723, 13982,
14245` is a separate platform-level key (used for subscription billing of YCM
itself), not the per-association gateway key — distinct system.

---

## 5. Gap list (consolidated)

| # | Gap | Phase | Owner |
|---|---|---|---|
| A | Cherry Hill seed has 13 units across 4 buildings; dispatch states 18 | Phase 1 (data import) | William (physical reality) |
| B | No `payment_gateway_connections` row for Cherry Hill — owners cannot pay | Phase 4 (Stripe setup) | William (Stripe account) → admin UI upsert |
| C | Non-autopay owner-payment-link webhook may not auto-write ledger entries | Phase 4 (implementation) | Builder, after Phase 1 + Gap B closed |
| D | No admin surface for "what mode is each gateway" (test/live) | Phase 3 or 4 | Builder, polish item |

None of A–D require fixes from this audit dispatch. CH-3 (admin reconciliation
report) is the next step and will exercise the empty state until Phase 1 data
imports.

---

## 6. References

- Dispatch: `dispatches/HANDOFF-FOR-COORDINATOR-014-cherry-hill-phase3-phase4-2026-05-07.md` (in `williamruiz1/founder-os` on branch `feat/77items-E-marketing-agent-charter`; not yet on main)
- Issue: [founder-os#259](https://github.com/williamruiz1/founder-os/issues/259)
- YCM seed: `server/seed.ts:28–134`
- Gateway schema: `shared/schema.ts:508–525`
- Checkout flow: `server/routes.ts:5258–5395`
- Webhook → ledger: `server/routes.ts:5495–5588`
