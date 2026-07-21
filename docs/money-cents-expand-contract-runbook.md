# Money Cents Expand/Contract Runbook

This runbook changes storage compatibility only. It does not load protected
balances, repair historical owner amounts, or authorize a live payment.

## Release A — expand

1. Capture a database snapshot and deploy migration `0072_money_cents_expand`.
2. Confirm legacy writes and cents writes both succeed in staging; mismatched
   dual values must fail.
3. Run `node scripts/money-cents-expand.cjs status`.
4. Run `node scripts/money-cents-expand.cjs backfill 500`. The two backfills use
   bounded `SKIP LOCKED` batches and can be stopped and restarted safely.
5. Run `node scripts/money-cents-expand.cjs assert`. Do not continue unless all
   associations show zero missing cents, zero mismatches, and zero drift.
6. Keep legacy reads active while observing the drift view for 24 hours.

Rollback Release A only while all application reads still use legacy dollars:
run `migrations/rollback/0072_money_cents_expand.down.sql`. The rollback removes
the mirror columns and controls but does not rewrite a historical dollar value.

## Release B — read switch

Release B is authored and deployed only after the 24-hour observation gate
passes. It validates the compatibility constraints, makes the owner-ledger cents
column non-null, and switches application reads to `amount_cents`. The legacy
dollar columns and synchronization triggers remain during this release.

## Release C — contract

Remove the legacy dollar columns and compatibility triggers only in a later
release after Release B has its own observation window and rollback proof.

## Stop conditions

Stop on any missing mirror, mismatch, non-zero drift, duplicate posting,
unallocated payment, failed notification assertion, or cross-association result.
Capture the failing rows without owner-private payloads, complete root-cause
analysis, repair, and rerun the affected workflow plus the financial regression
suite before resuming.

