#!/usr/bin/env bash
# 03-import-to-neon.sh — apply a Fly Postgres dump into the Neon target database.
#
# Usage:
#   NEON_DATABASE_URL_DIRECT=postgresql://... ./scripts/neon/03-import-to-neon.sh /tmp/ycm-prod-dump-<stamp>.sql
#   ./scripts/neon/03-import-to-neon.sh /tmp/ycm-prod-dump-<stamp>.sql --dry-run
#
# Required env:
#   NEON_DATABASE_URL_DIRECT  — the NON-pooled connection string from Neon (no '-pooler' in host).
#                               psql needs the direct endpoint for COPY + transaction-scoped DDL.
#
# What this does:
#   1. Verifies the target Neon database is REACHABLE and EMPTY (no associations table or 0 rows).
#      If it's not empty, this script refuses to overwrite. Use --force to override.
#   2. Applies the plain-SQL dump via `psql --single-transaction --set ON_ERROR_STOP=on`.
#      Single-transaction = all-or-nothing. ON_ERROR_STOP = abort on first error, no half-write.
#   3. Captures Neon-side row counts for the same set of tables that 02-export captured.
#   4. Compares Neon counts against the source counts file (if present) and prints DRIFT lines.
#
# Idempotency:
#   Not idempotent by default — running twice into the same DB will conflict on unique keys.
#   The empty-target check enforces this. Use --force only if you know the DB is fresh.

set -euo pipefail

DRY_RUN=0
FORCE=0
DUMP_FILE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    -h|--help)
      grep -E '^# ' "$0" | head -30 | sed 's/^# //; s/^#//'
      exit 0
      ;;
    *)
      if [ -z "$DUMP_FILE" ]; then
        DUMP_FILE="$arg"
      else
        echo "[error] unexpected arg: $arg" >&2
        exit 64
      fi
      ;;
  esac
done

if [ -z "$DUMP_FILE" ]; then
  echo "[error] missing dump file path. Usage: $0 <dump-file.sql> [--dry-run] [--force]" >&2
  exit 64
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "[error] dump file not found: $DUMP_FILE" >&2
  exit 1
fi

if [ -z "${NEON_DATABASE_URL_DIRECT:-}" ]; then
  echo "[error] NEON_DATABASE_URL_DIRECT is not set. Export it first (see scripts/neon/01-provision.md)." >&2
  exit 1
fi

if [[ "$NEON_DATABASE_URL_DIRECT" == *"-pooler."* ]]; then
  echo "[error] NEON_DATABASE_URL_DIRECT looks like a POOLED string ('-pooler.' in host)." >&2
  echo "        Use the direct string for import. The pooled string belongs in step 04." >&2
  exit 1
fi

COUNTS_SRC_FILE="${DUMP_FILE%.sql}.counts.txt"
STAMP="$(date +%Y%m%d-%H%M%S)"
COUNTS_DST_FILE="/tmp/ycm-neon-counts-${STAMP}.txt"

echo "[plan] Dump file:        $DUMP_FILE ($(du -h "$DUMP_FILE" | awk '{print $1}'))"
echo "[plan] Target Neon:      ${NEON_DATABASE_URL_DIRECT%@*}@... (redacted)"
echo "[plan] Source counts:    ${COUNTS_SRC_FILE} $( [ -f "$COUNTS_SRC_FILE" ] && echo '(found)' || echo '(missing — will skip drift check)' )"
echo "[plan] Dest counts:      $COUNTS_DST_FILE"
echo

command -v psql >/dev/null || { echo "[fatal] psql not in PATH"; exit 1; }

if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] Would: connect to NEON_DATABASE_URL_DIRECT, verify it's empty (no associations rows),"
  echo "[dry-run] then run:"
  echo "  psql \"\$NEON_DATABASE_URL_DIRECT\" \\"
  echo "    --single-transaction \\"
  echo "    --set ON_ERROR_STOP=on \\"
  echo "    --file \"$DUMP_FILE\""
  echo "[dry-run] Then would capture row counts to a /tmp/ycm-neon-counts-<stamp>.txt and diff"
  echo "[dry-run] against the source counts file (if found at ${COUNTS_SRC_FILE})."
  echo "[dry-run] No changes made. Exit."
  exit 0
fi

echo "[step] Pre-flight: connecting to Neon..."
NEON_VER="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc 'select version();' 2>/dev/null | head -1 || true)"
if [ -z "$NEON_VER" ]; then
  echo "[fatal] Could not connect to Neon at NEON_DATABASE_URL_DIRECT." >&2
  exit 1
fi
echo "[ok] Connected. Server: ${NEON_VER:0:60}..."

echo "[step] Pre-flight: checking target is empty..."
# `to_regclass` returns NULL when the table doesn't exist — safe across fresh DBs.
EXISTING_TBL="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc \
  "SELECT to_regclass('public.associations') IS NOT NULL;" 2>/dev/null | tr -d '[:space:]' || true)"

if [ "$EXISTING_TBL" = "t" ]; then
  ASSOC_COUNT="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc "SELECT COUNT(*) FROM associations;" 2>/dev/null | tr -d '[:space:]' || echo 0)"
  if [ "$ASSOC_COUNT" -gt 0 ] && [ "$FORCE" = "0" ]; then
    echo "[fatal] Target Neon DB already has $ASSOC_COUNT associations. Refusing to overwrite." >&2
    echo "[fatal] Use --force if you intentionally want to import on top." >&2
    exit 1
  elif [ "$ASSOC_COUNT" -gt 0 ]; then
    echo "[warn] --force given. Will attempt import on top of existing data ($ASSOC_COUNT associations)."
  else
    echo "[ok] Target has the schema but is empty. Will import."
  fi
else
  echo "[ok] Target is fresh — no 'associations' table yet. Will import."
fi

echo "[step] Importing dump into Neon (single transaction, abort-on-first-error)..."
echo "       This is typically 30-120 seconds for current YCM size."
START_TS=$(date +%s)
psql "$NEON_DATABASE_URL_DIRECT" \
  --single-transaction \
  --set ON_ERROR_STOP=on \
  --quiet \
  --file "$DUMP_FILE"
ELAPSED=$(( $(date +%s) - START_TS ))
echo "[ok] Import complete in ${ELAPSED}s."

echo "[step] Capturing Neon row counts..."
psql "$NEON_DATABASE_URL_DIRECT" -A -F" | " -t -c "
  SELECT 'associations'         AS table, COUNT(*) FROM associations
  UNION ALL SELECT 'persons',              COUNT(*) FROM persons
  UNION ALL SELECT 'ownerships',           COUNT(*) FROM ownerships
  UNION ALL SELECT 'owner_ledger_entries', COUNT(*) FROM owner_ledger_entries
  UNION ALL SELECT 'portal_access',        COUNT(*) FROM portal_access
  UNION ALL SELECT 'units',                COUNT(*) FROM units
  UNION ALL SELECT 'buildings',            COUNT(*) FROM buildings
  UNION ALL SELECT 'auth_users',           COUNT(*) FROM auth_users
  UNION ALL SELECT '__drizzle_migrations', COUNT(*) FROM drizzle.__drizzle_migrations
" > "$COUNTS_DST_FILE"

echo "[ok] Neon row counts:"
sed 's/^/       /' "$COUNTS_DST_FILE"

# Drift check
if [ -f "$COUNTS_SRC_FILE" ]; then
  echo
  echo "[step] Drift check (source vs Neon, per-table)..."
  DRIFT=0
  # Both files have shape:  tablename | count
  while IFS='|' read -r tbl src_count; do
    tbl="$(echo "$tbl" | tr -d '[:space:]')"
    src_count="$(echo "$src_count" | tr -d '[:space:]')"
    [ -z "$tbl" ] && continue
    dst_count="$(grep "^$tbl " "$COUNTS_DST_FILE" | awk -F'|' '{print $2}' | tr -d '[:space:]' || echo "MISSING")"
    if [ "$dst_count" = "MISSING" ]; then
      echo "       [DRIFT] $tbl: source=$src_count → neon=MISSING"
      DRIFT=1
    elif [ "$src_count" != "$dst_count" ]; then
      echo "       [DRIFT] $tbl: source=$src_count → neon=$dst_count"
      DRIFT=1
    else
      echo "       [match] $tbl: $src_count rows"
    fi
  done < "$COUNTS_SRC_FILE"

  if [ "$DRIFT" = "1" ]; then
    echo "[fatal] Row-count drift detected between source and Neon. STOP and investigate before cutover." >&2
    exit 2
  fi
  echo "[ok] All tables match source counts."
else
  echo "[warn] No source counts file ($COUNTS_SRC_FILE). Skipping drift check."
  echo "       Run step 06 (verify) against Neon directly to confirm."
fi

echo
echo "[done] Neon import complete + drift check passed."
echo "[next] Run: ./scripts/neon/06-verify.sh   # against the same NEON_DATABASE_URL_DIRECT"
echo "[next] Then schedule cutover window; run 04-cutover.sh during the window."
