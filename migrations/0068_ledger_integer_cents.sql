-- Migration 0068 — money precision: DOLLARS-as-float8 -> INTEGER CENTS
-- (founder-os#10779; the follow-up 0060_money_float8.sql explicitly deferred).
--
-- WHY: 0060 widened owner_ledger_entries.amount and payment_webhook_events.amount from
-- float4 to float8. That was an INTERIM fix: it stopped future precision loss but left
-- money stored in DOLLARS as a BINARY FLOAT, which cannot exactly represent most cent
-- values (0.10 is not representable in base-2). Every read therefore had to recover cents
-- via `Math.round(Math.abs(amount) * 100)`, and every aggregation had to remember to
-- round-each-term-before-summing. That discipline is unenforceable by the type system —
-- one forgotten round() silently reintroduces drift into a financial balance.
--
-- THIS MIGRATION: store money as INTEGER CENTS (`amount_cents`), mirroring the convention
-- already used by newer tables (disbursements.amount_cents, gl_entries, stripe payouts).
-- Integer cents are exact by construction: no rounding discipline, no drift, no recovery
-- step. This removes the failure mode rather than documenting it.
--
-- COLUMN RENAME IS DELIBERATE (amount -> amount_cents). Keeping the name `amount` while
-- changing its UNIT from dollars to cents would leave every existing reader compiling
-- cleanly while silently reading a 100x-wrong number — the worst possible outcome on live
-- financial data. Renaming makes every unconverted read site a COMPILE ERROR, so the type
-- checker exhaustively finds them for us. The rename is the safety mechanism.
--
-- BACKFILL / DATA REPAIR: `ROUND(amount::numeric * 100)`. Casting float8 -> numeric BEFORE
-- multiplying avoids introducing a fresh float multiply error, and numeric ROUND is exact
-- decimal rounding (half away from zero). This also REPAIRS the float4 damage 0060 could
-- not undo: 14 of the 93 live rows are float4 artifacts of real cent amounts
-- (e.g. 1326.18994140625 is the damaged `$1326.19`; 415.70001220703125 is `$415.70`), and
-- ROUND recovers the intended cents exactly. Verified against live production before
-- authoring: both the float and numeric formulas agree on all 93 rows (0 disagreements),
-- and the per-association balance of record is UNCHANGED —
--   sum(amount) = 39796.77996826172 -> 3979678 cents
--   sum(round(amount::numeric * 100)) = 3979678 cents   (identical)
-- payment_webhook_events is EMPTY in production (0 rows), so its backfill is a no-op there.
--
-- The two DO blocks below are ASSERTIONS, not decoration: they abort the migration (and
-- therefore the deploy) if the balance of record shifts by even one cent, or if any value
-- overflows int4 ($21,474,836.47). Fail loudly on financial data; never half-apply.
--
-- OPERATIONAL NOTE: ADD COLUMN + UPDATE + DROP COLUMN takes an ACCESS EXCLUSIVE lock and
-- rewrites the table. These are small ledger/event tables (93 rows / 0 rows), so the
-- rewrite is brief — but this is a schema change on LIVE financial data, so run it in a
-- low-traffic window, same as 0060. DEPLOY-ORDERING HAZARD: `migrate.cjs` runs from
-- fly.toml `release_command` BEFORE the new app machines come up, so for the duration of
-- the deploy the OLD code (reading `amount`) is live against the NEW schema (where
-- `amount` is gone) and will error on ledger reads. This is the same brief-outage class
-- 0060 already accepted for these tables; it is why this migration carries a
-- William-ratify gate before prod deploy (per the founder-os#10779 MONEY-SAFETY note).
-- A zero-downtime alternative (expand/contract across two deploys: add+dual-write, then
-- drop in a later deploy) is available if that window is judged unacceptable.
--
-- REVERSIBLE: see migrations/rollback/0068_ledger_integer_cents.down.sql. The down path
-- re-adds the float8 dollars column and backfills `amount_cents / 100.0`. Note it restores
-- REPAIRED values (the recovered cents), not the original float4 artifacts — i.e. rollback
-- returns the intended money, which is strictly better data than what it replaces.
-- Verified both directions against a copy of real production data (see the PR).
--
-- The rollback lives in `migrations/rollback/`, NOT beside this file, on purpose: the
-- CI guard `tests/migration-journal-alignment.test.ts` requires every `migrations/*.sql`
-- to be journal-registered (it exists because six migrations were once silently skipped
-- in production — founder-os#2476). A down-migration must NEVER be journal-registered —
-- drizzle would "apply" it on deploy and instantly revert this migration. The
-- subdirectory keeps that guard strict while keeping the rollback next to the migrations.

-- ── owner_ledger_entries (93 live rows, NOT NULL) ────────────────────────────
ALTER TABLE owner_ledger_entries ADD COLUMN amount_cents integer;
--> statement-breakpoint

-- Abort before writing anything if any value cannot fit int4.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad FROM owner_ledger_entries
   WHERE abs(round(amount::numeric * 100)) > 2147483647;
  IF bad > 0 THEN
    RAISE EXCEPTION '0068 abort: % owner_ledger_entries row(s) exceed int4 cents range ($21,474,836.47)', bad;
  END IF;
END $$;
--> statement-breakpoint

UPDATE owner_ledger_entries SET amount_cents = round(amount::numeric * 100)::integer;
--> statement-breakpoint

-- Balance-of-record assertion: the cents total must equal the dollars total, per
-- association, to the cent. Aborts the migration (and the deploy) on any drift.
DO $$
DECLARE drift record;
BEGIN
  FOR drift IN
    SELECT association_id,
           sum(amount_cents)::bigint                     AS cents_total,
           round(sum(amount::numeric) * 100)::bigint     AS dollars_total
      FROM owner_ledger_entries
     GROUP BY association_id
    HAVING sum(amount_cents)::bigint <> round(sum(amount::numeric) * 100)::bigint
  LOOP
    RAISE EXCEPTION '0068 abort: balance of record drifted for association % (cents=%, dollars=%)',
      drift.association_id, drift.cents_total, drift.dollars_total;
  END LOOP;
  IF EXISTS (SELECT 1 FROM owner_ledger_entries WHERE amount_cents IS NULL) THEN
    RAISE EXCEPTION '0068 abort: owner_ledger_entries.amount_cents has NULLs after backfill';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE owner_ledger_entries ALTER COLUMN amount_cents SET NOT NULL;
--> statement-breakpoint

ALTER TABLE owner_ledger_entries DROP COLUMN amount;
--> statement-breakpoint

-- ── payment_webhook_events (0 live rows; amount is NULLABLE — audit record of
--    what the gateway reported, so NULL "gateway sent no amount" is meaningful
--    and must stay distinguishable from 0 cents) ───────────────────────────────
ALTER TABLE payment_webhook_events ADD COLUMN amount_cents integer;
--> statement-breakpoint

DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad FROM payment_webhook_events
   WHERE amount IS NOT NULL AND abs(round(amount::numeric * 100)) > 2147483647;
  IF bad > 0 THEN
    RAISE EXCEPTION '0068 abort: % payment_webhook_events row(s) exceed int4 cents range', bad;
  END IF;
END $$;
--> statement-breakpoint

UPDATE payment_webhook_events
   SET amount_cents = round(amount::numeric * 100)::integer
 WHERE amount IS NOT NULL;
--> statement-breakpoint

-- NULL-preservation assertion: a row with a gateway amount must end with cents, and a
-- row without one must stay NULL. Guards the audit meaning of the column.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad FROM payment_webhook_events
   WHERE (amount IS NULL) <> (amount_cents IS NULL);
  IF bad > 0 THEN
    RAISE EXCEPTION '0068 abort: % payment_webhook_events row(s) lost NULL-ness in backfill', bad;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE payment_webhook_events DROP COLUMN amount;
