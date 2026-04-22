# Drizzle migration journal — drift notes

Migrations `0002`–`0006` (and `0007` once PR 4 lands) were written and applied via direct SQL before drizzle-kit was re-engaged on this repo. As a result:

- `_journal.json` entries for 0002–0006 were **added back on 2026-04-22** to document that the migrations exist and have been applied in production. `when` timestamps are synthetic (monotonic, not authoritative).
- **Snapshot files (`0002_snapshot.json` … `0006_snapshot.json`) are NOT present.** They were never generated because the migrations were authored by hand.

## Consequence

- `drizzle-kit push` (direct schema-to-DB diff) works normally — it does not consult snapshots.
- `drizzle-kit generate` (snapshot-based diff) will fail against a clean checkout because the latest known snapshot is `0001` while the real schema is well past it. Do not run `drizzle-kit generate` on this repo until snapshots are rebuilt.

## Rebuild path

When someone needs `drizzle-kit generate` to work again:

1. Start from a fresh Postgres instance.
2. Apply migrations 0000–0006 (+0007 if present) in order via raw SQL.
3. Run `drizzle-kit introspect:pg` against that DB to regenerate the current schema snapshot.
4. Commit the resulting snapshots under `migrations/meta/`.
5. Remove or update this README once the drift is closed.

## Why this wasn't rebuilt in-commit

Regenerating faithful snapshots requires a Postgres DB that matches each migration's point-in-time schema. That work is out of scope for the cherry-pick reconciliation PR that noticed the drift; documenting it here is the safe, non-fabricating fix.
