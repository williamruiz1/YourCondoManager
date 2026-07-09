#!/usr/bin/env bash
#
# refresh-staging-from-prod.sh — clone the REAL Cherry Hill production data into
# the isolated staging review database, then SCRUB every dangerous credential so
# the cloned data can never reach the real world. (founder-os#10193 F0)
#
# WHAT IT DOES
#   1. pg_dump the PRODUCTION database (a point-in-time snapshot).
#   2. Restore that snapshot into the SEPARATE staging database (drops+recreates
#      objects with --clean --if-exists). Staging is a COPY — this never writes
#      back to prod.
#   3. SCRUB the cloned `platform_secrets` table in STAGING: delete/neutralize the
#      Twilio, VAPID (push) and LIVE Stripe credentials the clone carried over, so
#      even the DB-fallback credential path (getSecret is env-first, DB-second)
#      cannot text/push/charge a real owner. The code kill-switch
#      (server/staging-guard.ts) is the primary guard; this scrub is defence in depth.
#
# SAFETY INVARIANTS
#   * Refuses to run unless STAGING_DATABASE_URL clearly points at a *staging* DB.
#   * Refuses if PROD and STAGING URLs are identical (never restore onto prod).
#   * The dump is read-only against prod; only STAGING is written.
#
# USAGE
#   PROD_DATABASE_URL=...      (prod app's DATABASE_URL — read-only source)
#   STAGING_DATABASE_URL=...   (staging DB — the clone target; must contain "staging")
#   scripts/refresh-staging-from-prod.sh
#
# Getting the URLs (Fly Postgres) — run each in a separate terminal:
#   flyctl proxy 6432:5432 -a yourcondomanager-db          # prod cluster
#   flyctl proxy 6433:5432 -a yourcondomanager-staging-db  # staging cluster (if separate)
# then build the two postgres:// URLs against localhost:6432 / :6433 with the
# cluster password (flyctl secrets / `flyctl postgres` operator creds).
#
# Or, if staging is a separate DATABASE on the SAME cluster, both URLs share the
# host and differ only in the trailing /<dbname> (e.g. .../ycm vs .../ycm_staging).

set -euo pipefail

PROD_URL="${PROD_DATABASE_URL:-}"
STAGING_URL="${STAGING_DATABASE_URL:-}"

fail() { echo "ERROR: $*" >&2; exit 1; }

[ -n "$PROD_URL" ]    || fail "PROD_DATABASE_URL is required (read-only source)."
[ -n "$STAGING_URL" ] || fail "STAGING_DATABASE_URL is required (clone target)."

# --- Safety guards (fail closed) ---
[ "$PROD_URL" != "$STAGING_URL" ] || fail "PROD and STAGING URLs are identical — refusing to restore onto prod."
case "$STAGING_URL" in
  *staging*) : ;;
  *) fail "STAGING_DATABASE_URL does not contain 'staging' — refusing (safety guard). Rename the staging DB/host to include 'staging'." ;;
esac

command -v pg_dump    >/dev/null || fail "pg_dump not found (install postgresql client tools)."
command -v pg_restore >/dev/null || fail "pg_restore not found."
command -v psql       >/dev/null || fail "psql not found."

DUMP="$(mktemp -t ycm-prod-snapshot.XXXXXX.dump)"
trap 'rm -f "$DUMP"' EXIT

echo "==> [1/3] Dumping PRODUCTION (read-only) → $DUMP"
pg_dump --no-owner --no-acl --format=custom --file="$DUMP" "$PROD_URL"
echo "    dump size: $(du -h "$DUMP" | cut -f1)"

echo "==> [2/3] Restoring snapshot into STAGING (clean + if-exists) …"
# --clean --if-exists drops existing objects first so the restore is a full refresh.
# A few benign NOTICE/DROP errors on first run are expected; --exit-on-error is off.
pg_restore --no-owner --no-acl --clean --if-exists --dbname="$STAGING_URL" "$DUMP" || {
  echo "    (pg_restore reported non-fatal errors — typical on a full clean+restore; continuing)"
}

echo "==> [3/3] Scrubbing dangerous credentials from the STAGING clone …"
psql "$STAGING_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Neutralize outbound + money credentials carried over from the prod clone.
-- The code kill-switch already blocks these, but we also strip them from the DB
-- so the DB-fallback credential path is empty in staging. Idempotent.
DELETE FROM platform_secrets
 WHERE key IN (
   'twilio.accountSid', 'twilio.authToken', 'twilio.fromNumber', 'twilio.statusCallbackUrl',
   'vapid.publicKey', 'vapid.privateKey', 'vapid.subject'
 );

-- Remove any LIVE Stripe secret carried in the clone (test keys, if present, are safe to keep).
DELETE FROM platform_secrets
 WHERE key = 'platform_stripe_secret_key'
   AND value LIKE 'sk_live_%';

SELECT 'remaining platform_secrets rows:' AS note, count(*) AS n FROM platform_secrets;
SQL

echo "==> DONE. Staging now holds a fresh clone of real CHC data with outbound/money creds scrubbed."
echo "    Re-run this script any time to refresh staging from the latest prod snapshot."
