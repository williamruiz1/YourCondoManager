#!/usr/bin/env bash
# 02-export-fly-postgres.sh — pg_dump from the Fly Postgres app into a local file.
#
# Usage:
#   ./scripts/neon/02-export-fly-postgres.sh                  # normal run
#   ./scripts/neon/02-export-fly-postgres.sh --dry-run        # show what would happen
#   FLY_APP=yourcondomanager FLY_DB_APP=yourcondomanager-db ./scripts/neon/02-export-fly-postgres.sh
#
# Output:
#   /tmp/ycm-prod-dump-<YYYYMMDD-HHMMSS>.sql  (custom-format pg_dump → uncompressed text)
#   /tmp/ycm-prod-dump-<YYYYMMDD-HHMMSS>.counts.txt  (row counts per key table)
#
# Idempotency:
#   If a dump from the last 60 minutes exists, this script skips re-dumping
#   and reuses it (prints the path). Use --force to override.
#
# Approach:
#   The Fly Postgres image (flyio/postgres-flex:17.x) ships pg_dump at /usr/bin/pg_dump.
#   We `flyctl ssh console -C` into the DB app and pipe the dump out to stdout, then
#   capture it locally. This avoids cross-version mismatch (local pg_dump 18 vs server 17)
#   AND avoids needing a public DB port.
#
# Auth:
#   pg_dump inside the machine reads $DATABASE_URL (set by Fly Postgres on the app machine).
#   We pass --no-owner --no-privileges so the dump replays cleanly on Neon (different role
#   names; no superuser on Neon).

set -euo pipefail

DRY_RUN=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    -h|--help)
      grep -E '^# ' "$0" | head -40 | sed 's/^# //; s/^#//'
      exit 0
      ;;
    *)
      echo "[error] unknown arg: $arg" >&2
      exit 64
      ;;
  esac
done

FLY_APP="${FLY_APP:-yourcondomanager}"
FLY_DB_APP="${FLY_DB_APP:-yourcondomanager-db}"
OUT_DIR="${OUT_DIR:-/tmp}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${OUT_DIR}/ycm-prod-dump-${STAMP}.sql"
COUNTS_FILE="${OUT_DIR}/ycm-prod-dump-${STAMP}.counts.txt"

# Reuse window: 60 minutes
RECENT_DUMP=""
if [ "$FORCE" = "0" ]; then
  # find newest dump from last 60 min
  RECENT_DUMP="$(find "$OUT_DIR" -maxdepth 1 -name 'ycm-prod-dump-*.sql' -mmin -60 2>/dev/null | sort -r | head -1)"
fi

if [ -n "$RECENT_DUMP" ] && [ -s "$RECENT_DUMP" ]; then
  echo "[skip] recent dump exists (<60min): $RECENT_DUMP"
  echo "       size: $(du -h "$RECENT_DUMP" | awk '{print $1}')"
  echo "       use --force to overwrite."
  echo "[ok] dump path: $RECENT_DUMP"
  exit 0
fi

echo "[plan] Source app:           $FLY_DB_APP (Fly Postgres machine)"
echo "[plan] Target app (verify):  $FLY_APP    (must exist)"
echo "[plan] Out file:             $OUT_FILE"
echo "[plan] Counts file:          $COUNTS_FILE"
echo "[plan] pg_dump flags:        --no-owner --no-privileges --format=plain --schema=public"
echo

if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] Would run, inside Fly machine via 'flyctl ssh console -C':"
  echo
  echo "  pg_dump \"\$DATABASE_URL\" \\"
  echo "    --no-owner --no-privileges \\"
  echo "    --format=plain --schema=public \\"
  echo "    --quote-all-identifiers"
  echo
  echo "[dry-run] Would write stdout to: $OUT_FILE"
  echo "[dry-run] Would then capture row counts via psql for:"
  echo "          associations, persons, ownerships, owner_ledger_entries, portal_access,"
  echo "          units, buildings, auth_users, portal_sessions, drizzle.__drizzle_migrations"
  echo "[dry-run] No files written. Exit."
  exit 0
fi

# Pre-flight: flyctl and target apps must be reachable
command -v flyctl >/dev/null || { echo "[fatal] flyctl not in PATH"; exit 1; }

echo "[step] Verifying flyctl auth + target app reachability..."
flyctl status -a "$FLY_DB_APP" >/dev/null 2>&1 || {
  echo "[fatal] Cannot reach Fly app: $FLY_DB_APP. Run 'flyctl auth login' or check FLY_DB_APP env var."
  exit 1
}

echo "[step] Starting pg_dump via flyctl ssh (this may take 1-3 min for current YCM size)..."
echo "       Output → $OUT_FILE"

# We run pg_dump inside the machine and stream stdout out via flyctl ssh.
# --pty=false avoids terminal-control bytes in the dump stream.
# Using `sh -lc` so $DATABASE_URL is expanded inside the remote shell.
flyctl ssh console -a "$FLY_DB_APP" --pty=false -C \
  'sh -lc "pg_dump \"$DATABASE_URL\" --no-owner --no-privileges --format=plain --schema=public --quote-all-identifiers"' \
  > "$OUT_FILE"

DUMP_BYTES=$(wc -c < "$OUT_FILE" | tr -d ' ')
if [ "$DUMP_BYTES" -lt 10000 ]; then
  echo "[fatal] Dump file is suspiciously small ($DUMP_BYTES bytes). Likely auth or pg_dump failure."
  echo "[fatal] First 20 lines of output:"
  head -20 "$OUT_FILE" >&2
  exit 1
fi

echo "[ok] Dump complete. Size: $(du -h "$OUT_FILE" | awk '{print $1}')"

echo "[step] Capturing pre-cutover row counts for verification..."
# Run row-count snapshot inside the same machine. Using psql with a heredoc.
flyctl ssh console -a "$FLY_DB_APP" --pty=false -C \
  'sh -lc "psql \"$DATABASE_URL\" -A -F\" | \" -t -c \"SELECT '\''associations'\''   AS table, COUNT(*) FROM associations UNION ALL SELECT '\''persons'\'', COUNT(*) FROM persons UNION ALL SELECT '\''ownerships'\'', COUNT(*) FROM ownerships UNION ALL SELECT '\''owner_ledger_entries'\'', COUNT(*) FROM owner_ledger_entries UNION ALL SELECT '\''portal_access'\'', COUNT(*) FROM portal_access UNION ALL SELECT '\''units'\'', COUNT(*) FROM units UNION ALL SELECT '\''buildings'\'', COUNT(*) FROM buildings UNION ALL SELECT '\''auth_users'\'', COUNT(*) FROM auth_users UNION ALL SELECT '\''__drizzle_migrations'\'', COUNT(*) FROM drizzle.__drizzle_migrations\""' \
  > "$COUNTS_FILE" 2>/dev/null || {
    echo "[warn] Row-count capture failed (non-fatal). Will rely on Neon-side verify in step 06."
    rm -f "$COUNTS_FILE"
}

if [ -s "$COUNTS_FILE" ]; then
  echo "[ok] Source row counts:"
  sed 's/^/       /' "$COUNTS_FILE"
fi

echo
echo "[done] Dump path:   $OUT_FILE"
echo "[done] Counts path: ${COUNTS_FILE} (if exists)"
echo
echo "[next] Run: ./scripts/neon/03-import-to-neon.sh \"$OUT_FILE\""
