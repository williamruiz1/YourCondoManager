-- Migration 0060 — money precision: real (float4) -> double precision (float8)
-- (founder-os#10755, audit finding A-LEDGER-005).
--
-- WHY: owner_ledger_entries.amount and payment_webhook_events.amount were single-precision
-- float4 (~7 significant digits / 24-bit mantissa). Money is stored in DOLLARS as float
-- (e.g. 100.10), which float4 cannot represent exactly; its absolute error exceeds $0.005
-- once an entry approaches ~$40k+, so cent recovery (Math.round(Math.abs(amount) * 100))
-- can be off by a cent, and any float sum accumulates error.
--
-- INTERIM FIX: widen both columns to double precision (float8). float4 -> float8 is a
-- lossless WIDENING cast — it does not recover precision already lost while stored as
-- float4, but it stops all future loss; combined with the round-each-term-to-cents-before-
-- summing discipline at every aggregation site, cent recovery is now exact for realistic
-- HOA amounts. The full integer-cents migration (mirroring the amount_cents convention
-- already used by newer tables) is filed as a follow-up dispatch — it touches every
-- read/write site and is out of scope here.
--
-- OPERATIONAL NOTE: `ALTER COLUMN ... TYPE` rewrites the table and takes an ACCESS
-- EXCLUSIVE lock for the duration. These are event/ledger tables (not huge), so the
-- rewrite is brief, but run this in a low-traffic window on prod. This is a schema change
-- on LIVE financial tables — a William-ratify gate before prod deploy (per the dispatch
-- MONEY-SAFETY note). Reversible: `ALTER COLUMN amount TYPE real` (re-narrows; only safe
-- because no value stored to date needs >float4 range).

ALTER TABLE payment_webhook_events ALTER COLUMN amount TYPE double precision;
ALTER TABLE owner_ledger_entries ALTER COLUMN amount TYPE double precision;
