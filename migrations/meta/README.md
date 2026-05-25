# Drizzle migration journal — drift notes

This repo's migrations are applied by `scripts/migrate.ts` (drizzle-orm's
`migrate()`), invoked on every Fly deploy via `release_command` in `fly.toml`.
See founder-os Issue #2476.

## Snapshot drift (historical)

Migrations `0002`–`0006` (and `0007`) were written and applied via direct SQL
before drizzle-kit was re-engaged on this repo. As a result:

- `_journal.json` entries for the hand-applied migrations have **synthetic
  `when` timestamps** (monotonic, not authoritative).
- **Snapshot files (`0002_snapshot.json` … `0006_snapshot.json`, plus
  `0007_snapshot.json` and `0022_snapshot.json` … `0032_snapshot.json`) are
  NOT present.** They were never generated because the migrations were
  authored by hand.

## Consequence

- `drizzle-kit push` (direct schema-to-DB diff) works normally — it does not
  consult snapshots.
- The runtime migrator (`scripts/migrate.ts`) does **NOT** consult snapshots
  either — it only reads `_journal.json` + the `.sql` files + hashes them. So
  hand-authored migrations work fine as long as they're registered in the
  journal.
- `drizzle-kit generate` (snapshot-based diff) will fail against a clean
  checkout because the latest known snapshot is `0001` while the real schema
  is well past it. Do not run `drizzle-kit generate` on this repo until
  snapshots are rebuilt.

## Journal ordering quirk

`0007_onboarding_dismissed_at` was added to the journal AFTER `0021_...`
(idx=21) rather than at chronological position 7. This was intentional: an
existing test (`tests/admin-role-backfill-migration.test.ts`) asserts that
`0019_backfill_legacy_board_admin` has `idx=18`, so we preserved that
contract by appending 0007 at the end.

On a fresh database the migrator would apply migrations in journal order,
which means 0007's `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS
onboarding_dismissed_at` runs after 0021. The migration is idempotent and
its column is independent of every other migration, so order doesn't matter.

## Rebuild path

When someone needs `drizzle-kit generate` to work again:

1. Start from a fresh Postgres instance.
2. Run `npm run migrate` against that DB to apply all migrations in order.
3. Run `drizzle-kit introspect:pg` against that DB to regenerate the current
   schema snapshot.
4. Commit the resulting snapshots under `migrations/meta/`.
5. Remove or update this README once the drift is closed.

## Why this wasn't rebuilt in-commit

Regenerating faithful snapshots requires a Postgres DB that matches each
migration's point-in-time schema. That work is out of scope for the
migration-runner PR; documenting it here is the safe, non-fabricating fix.
