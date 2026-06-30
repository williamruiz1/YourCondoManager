# Stripe Payment-Correctness Hardening — Scope (requirements = definition of done)

**Date:** 2026-06-30 · **Author:** payment-correctness agent (GM-authorized via William)
**Goal:** Harden Stripe payment CORRECTNESS for the first real paying HOA customer. Reversible, test-mode validated, never moves live money during validation.

Scope is the THREE build items below + one dashboard-flag item (item 4). NOT in scope (other agents own): coupons, payment-method configs, branding, per-tenant email alias, community URL.

Build order: **Idempotency (item 2, highest safety) → Refund + app-fee refund (item 1) → ACH return/dunning (item 3)**. Each: scope → build → tests → tsc clean → reversible flag where it touches the live charge path.

---

## Item 2 — Idempotency keys on every money-moving Stripe POST

**Why:** A network retry of a POST that creates/moves money can double-charge or double-refund. Stripe's `Idempotency-Key` header makes a retry return the original result instead of creating a second object.

**Requirements (= acceptance tests):**

| # | Requirement | Acceptance test |
|---|---|---|
| R2.1 | The central Connect helper `callPlatformStripe` accepts an optional `idempotencyKey` and, when present + method is POST, sets the `Idempotency-Key` header. | Unit: call with `idempotencyKey` → header present; call without → header absent; GET ignores it. |
| R2.2 | A stable deterministic key helper exists: payment-intent keyed by `assoc+unit+period+amount`; refund keyed by `charge+amount`; checkout keyed by `txn-id`; off-session charge keyed by `txn-id`. Same logical op → same key; different op → different key. | Unit: key helper returns stable keys for same inputs, distinct for different inputs. |
| R2.3 | EVERY money-moving Stripe POST passes an idempotency key: checkout-session create (payment-service + routes.ts portal), payment_intents create (off-session charge), refunds (new item-1 code). | Unit/integration: each call site sends an `Idempotency-Key` header (mock fetch asserts header). |
| R2.4 | No behavior change when the platform isn't configured / on existing happy paths. | Existing 81 payment tests still pass; tsc clean. |

**Reversibility:** Adding a header is non-destructive and additive (a key only DEDUPES a retry; it never blocks the first call). No flag needed — but the key derivation is pure + unit-tested.

---

## Item 1 — Refunds + proportional application-fee refund (issue #286)

**Why (critical Connect finding):** On Connect DIRECT charges, refunding does NOT auto-refund the application fee. Refunding a dues charge without `refund_application_fee=true` makes the HOA eat YCM's 1% platform fee. Default must refund the app fee proportionally so the HOA never loses YCM's fee on a refund.

**Requirements (= acceptance tests):**

| # | Requirement | Acceptance test |
|---|---|---|
| R1.1 | A refund service `refundConnectCharge({ associationId, chargeId, amountCents?, reason?, refundApplicationFee=true })` POSTs `/v1/refunds` on the connected account (Stripe-Account header) with `charge`, optional `amount`, and **`refund_application_fee=true` by default** (proportional — Stripe refunds the app fee in proportion to the refund amount). | Unit (mock fetch): default call body contains `refund_application_fee=true`; partial refund passes `amount`; `refundApplicationFee:false` omits/sets false. |
| R1.2 | Refund routes through the platform key + connected-account header via `resolveConnectChargeRouting`. If the association has no active Connect routing → refund is rejected with a clear error (don't silently refund on the wrong account). | Unit: no Connect routing → throws "no active Connect account"; with routing → Stripe-Account header set. |
| R1.3 | Idempotency key on the refund POST keyed by `charge+amount` (item 2). | Unit: refund POST sends `Idempotency-Key`. |
| R1.4 | Admin-only route `POST /api/admin/payments/refund` gated by `requireAdmin` + `requireAdminRole(["platform-admin","board-officer","manager"])` + association scope. Body: `{ associationId, chargeId, amountCents?, reason? }`. | Integration: non-admin → 403; admin → 200 + refund created with app-fee-refund flag. Scope assertion enforced. |
| R1.5 | An audit-log entry is written for every refund (who, charge, amount, app-fee-refunded). | Integration: refund writes an audit row. |
| R1.6 | Feature flag `REFUNDS_ENABLED` (default OFF) gates the live refund POST — when OFF the route returns 503 "refunds disabled". This keeps a money-moving path reversible. | Unit: flag OFF → 503; flag ON → proceeds. |

**Test-mode validation:** create a test charge on a test connected account, refund it via the service, confirm via Stripe API the refund object has the app fee returned (`/refunds` response + the application-fee-refund). Done only if app fee is observed returned.

**Reversibility:** `REFUNDS_ENABLED` flag default OFF + admin-only route. Refunds in test mode only during validation.

---

## Item 3 — ACH return / failure + dunning handling

**Why:** ACH (`us_bank_account`) is delayed-notification — a charge can succeed at submit then fail days later with an R01 (`payment_intent.payment_failed` / `charge.failed`). ACH is the Smart-Retries exception (Stripe does not auto-retry beyond the bank return), so we must explicitly mark delinquent + trigger our retry path. The Connect webhook currently lacks failure/dispute events; the payments-webhook classifies `payment_intent.payment_failed` but takes no downstream action beyond marking the event "failed".

**Requirements (= acceptance tests):**

| # | Requirement | Acceptance test |
|---|---|---|
| R3.1 | The Connect webhook handler subscribes to + handles the robust failure/dispute event set: `payment_intent.payment_failed`, `charge.failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`. | Unit: each event type routes to a handler (not "ignored"). |
| R3.2 | On an ACH return / failed charge, the linked `paymentTransactions` row (found by `providerIntentId`/`providerPaymentId`) is marked `failed` + delinquent, and `markTransactionForRetry` is invoked (explicit retry — NOT relying on Stripe auto-retry). | Unit: simulated `payment_intent.payment_failed` for a known intent → txn marked failed + retry-eligible (soft code) OR not-eligible (hard code). |
| R3.3 | The webhook is idempotent on the provider event id (a re-delivered failure event doesn't double-process). | Unit: same event id twice → processed once. |
| R3.4 | A helper lists the exact `enabled_events` the platform Connect endpoint should subscribe to, surfaced for the dashboard item (and a script to add missing events via the Stripe API). | Unit: the enabled-events list contains the 5 events above; an idempotent "ensure events" function adds only missing ones. |
| R3.5 | No behavior change for the existing handled events (`account.updated`, `charge.succeeded`, `payout.paid`). | Existing connect tests pass; tsc clean. |

**Test-mode validation:** feed a simulated `payment_intent.payment_failed` event (signed with the test webhook secret) for a seeded transaction → assert the txn is marked failed + queued for retry.

**Reversibility:** the failure-handling branch is additive (new `case` arms); existing arms unchanged. No live-money path is altered (we only READ failure events + update our own DB).

---

## Item 4 — FLAG for William (dashboard, do NOT build)

**Assign connected-account negative-balance liability to Stripe (Connect loss settings).**
Exact setting: Stripe Dashboard → Connect → **Settings → Loss settings / Negative balances** → set **"Connected accounts are liable for negative balances"** is the default; to make the PLATFORM absorb owner-dispute/return losses instead, change the **debit/liability** assignment. The precise toggle: Connect settings `controller[losses][payments] = "application"` (platform liable) vs `"stripe"`/account-liable. **William decides** whether YCM (platform) absorbs connected-account negative balances or the HOA does. This is a money-risk policy decision — surfaced, not built.

---

## Honest completeness ladder at end
- Each item: **BUILT + VALIDATED (test-mode)** only after its acceptance tests pass AND (item 1) a test-mode refund shows the app fee returned / (item 3) a simulated failed event marks the txn for retry. Otherwise **PARTIAL/PENDING**, stated honestly.
