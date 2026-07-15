-- Migration 0068 — DOWN / rollback (founder-os#10779).
--
-- Reverses 0068_ledger_integer_cents.sql: restores the float8 DOLLARS columns and drops
-- the integer-cents columns. Drizzle has no automatic down-migration runner in this repo
-- (scripts/migrate.cjs only rolls forward), so this file is the DOCUMENTED, TESTED manual
-- rollback path.
--
-- WHY IT LIVES IN `migrations/rollback/` AND NOT BESIDE THE UP-MIGRATION: it must NEVER be
-- registered in `migrations/meta/_journal.json` — drizzle's migrator would "apply" it on
-- the next deploy and instantly revert 0068. But the CI guard
-- `tests/migration-journal-alignment.test.ts` requires every `migrations/*.sql` to BE
-- journal-registered (that guard exists because six migrations were once silently skipped
-- in production — founder-os#2476). Both rules are correct; this subdirectory satisfies
-- both, since the guard scans `migrations/` non-recursively.
--
-- Apply by hand against the affected DB:
--
--   flyctl ssh console -a <app> -C 'cd /app && psql "$DATABASE_URL" -f migrations/rollback/0068_ledger_integer_cents.down.sql'
--
-- ...then deploy the previous app image (the one that reads `amount`), and delete the
-- 0068 row from drizzle.__drizzle_migrations so a later `npm run migrate` re-applies it:
--
--   DELETE FROM drizzle.__drizzle_migrations WHERE hash = (sha256 of 0068 .sql);
--   -- or, simpler: TRUNCATE-free targeted delete by created_at of the 0068 apply.
--
-- DATA NOTE: this restores dollars as `amount_cents / 100.0`, i.e. the REPAIRED values.
-- It does NOT resurrect the original float4 artifacts (1326.18994140625 comes back as
-- 1326.19). That is intentional and strictly better: the artifacts were damage, and the
-- balance of record is preserved to the cent either way. Rollback is therefore lossless
-- with respect to MONEY, and lossy only with respect to float noise.

-- ── owner_ledger_entries ─────────────────────────────────────────────────────
ALTER TABLE owner_ledger_entries ADD COLUMN amount double precision;
--> statement-breakpoint

UPDATE owner_ledger_entries SET amount = amount_cents / 100.0;
--> statement-breakpoint

-- Balance-of-record assertion on the way back down, too.
DO $$
DECLARE drift record;
BEGIN
  FOR drift IN
    SELECT association_id
      FROM owner_ledger_entries
     GROUP BY association_id
    HAVING round(sum(amount::numeric) * 100)::bigint <> sum(amount_cents)::bigint
  LOOP
    RAISE EXCEPTION '0068-down abort: balance of record drifted for association %', drift.association_id;
  END LOOP;
END $$;
--> statement-breakpoint

ALTER TABLE owner_ledger_entries ALTER COLUMN amount SET NOT NULL;
--> statement-breakpoint

ALTER TABLE owner_ledger_entries DROP COLUMN amount_cents;
--> statement-breakpoint

-- ── payment_webhook_events (amount stays NULLABLE) ───────────────────────────
ALTER TABLE payment_webhook_events ADD COLUMN amount double precision;
--> statement-breakpoint

UPDATE payment_webhook_events
   SET amount = amount_cents / 100.0
 WHERE amount_cents IS NOT NULL;
--> statement-breakpoint

ALTER TABLE payment_webhook_events DROP COLUMN amount_cents;
