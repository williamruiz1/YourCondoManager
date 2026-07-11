-- Migration 0049 — Connecticut CIOA reserve disclosure fields (#8016)
--
-- From the #1035 YCM↔CT-CIOA compliance audit (§Area 1). Connecticut does NOT
-- mandate a reserve study or a minimum reserve-funding level — that is Delaware
-- (DUCIOA §81-315). CT requires DISCLOSURE only:
--   * the annual budget summary must STATE the reserve amount + the basis on
--     which reserves are calculated and funded (CGS §47-261e(a)); and
--   * the resale certificate must state the reserve amount (CGS §47-270(a)(5)).
--
-- Two additive, nullable columns on associations hold the board-declared
-- disclosure figure — replacing the hardcoded `reserveBalance: 0` / `reserveFund: 0`
-- placeholders in the portfolio summary, association list, and resale certificate.
-- These are a STATED disclosure (board-declared), NOT a live bank balance and NOT
-- a funding-mandate gate. No CT funding-mandate validator is built (CT has none).
--
--   reserve_balance_cents — the stated reserve amount, in cents (matches the cents
--                           convention used by financial_accounts.current_balance_cents).
--                           Null = not yet stated.
--   reserve_basis         — the §47-261e(a) narrative: the basis on which reserves
--                           are calculated and funded. Null = not yet stated.

ALTER TABLE "associations" ADD COLUMN IF NOT EXISTS "reserve_balance_cents" integer;
ALTER TABLE "associations" ADD COLUMN IF NOT EXISTS "reserve_basis" text;
