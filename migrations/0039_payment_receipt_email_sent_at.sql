-- Migration 0039 — payment_receipt_email_sent_at (P0-2 / Issue #205)
--
-- Adds an idempotency guard column to payment_transactions so that
-- re-delivered Stripe webhook retries do not trigger duplicate receipt emails.
-- NULL = not yet sent; non-NULL = receipt email dispatched at this timestamp.

ALTER TABLE payment_transactions
  ADD COLUMN receipt_email_sent_at TIMESTAMP;
