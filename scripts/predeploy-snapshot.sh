#!/usr/bin/env bash
#
# scripts/predeploy-snapshot.sh — pre-deploy DB backup snapshot
# (founder-os#10739, audit findings A-REL-004 / CQ-005).
#
# Creates an on-demand Fly Postgres volume snapshot of the yourcondomanager-db
# app IMMEDIATELY BEFORE a prod deploy, so a bad migration / destructive schema
# change has a fresh, automated restore anchor. Fly also auto-snapshots the
# volume daily; this adds a point-in-time snapshot taken right before THIS
# deploy's migrations run. Restore procedure: docs/DEPLOY-ROLLBACK.md.
#
# FAIL-CLOSED by default (money app): if no snapshot can be created, the deploy
# ABORTS — better to block a deploy than ship money/ledger code with no fresh
# backup. Set PREDEPLOY_SNAPSHOT_BEST_EFFORT=1 to warn-and-continue instead
# (e.g. if the CI token is scoped to the app but not the DB app, and you are
# relying on the daily auto-snapshot as the anchor — documented tradeoff).
#
#   env: YCM_DB_APP (default yourcondomanager-db)
#        FLY_API_TOKEN (must be able to list volumes + create snapshots on YCM_DB_APP)
#        PREDEPLOY_SNAPSHOT_BEST_EFFORT (1 = warn instead of fail)
set -uo pipefail

DB_APP="${YCM_DB_APP:-yourcondomanager-db}"
BEST_EFFORT="${PREDEPLOY_SNAPSHOT_BEST_EFFORT:-0}"

fail_or_warn() {
  if [ "$BEST_EFFORT" = "1" ]; then
    echo "[snapshot] WARN: $1 — continuing (PREDEPLOY_SNAPSHOT_BEST_EFFORT=1; relying on Fly's daily auto-snapshot)."
    exit 0
  fi
  echo "[snapshot] FAIL-CLOSED: $1 — aborting the prod deploy (no fresh backup anchor)."
  echo "[snapshot] To proceed without a fresh snapshot (using the daily auto-snapshot), set PREDEPLOY_SNAPSHOT_BEST_EFFORT=1."
  exit 1
}

command -v flyctl >/dev/null 2>&1 || fail_or_warn "flyctl not on PATH"

echo "[snapshot] Locating the primary volume for $DB_APP ..."
# Fly legacy Postgres stores data on a volume named pg_data (one per machine).
VOL_ID="$(flyctl volumes list -a "$DB_APP" --json 2>/dev/null \
  | python3 -c 'import json,sys
try:
    v=json.load(sys.stdin)
except Exception:
    sys.exit(0)
# prefer a pg_data volume; else the first volume
cands=[x for x in v if str(x.get("name","")).startswith("pg")] or v
print((cands[0].get("id") if cands else "") or "")' 2>/dev/null || true)"

[ -n "$VOL_ID" ] || fail_or_warn "could not resolve a volume id for $DB_APP (token scope? app name?)"

echo "[snapshot] Creating on-demand snapshot of volume $VOL_ID ($DB_APP) ..."
if flyctl volumes snapshots create "$VOL_ID" 2>&1; then
  echo "[snapshot] OK — pre-deploy snapshot created for $DB_APP volume $VOL_ID."
  echo "[snapshot] List/restore: flyctl volumes snapshots list $VOL_ID  (runbook: docs/DEPLOY-ROLLBACK.md)"
  exit 0
fi
fail_or_warn "flyctl volumes snapshots create failed for $VOL_ID"
