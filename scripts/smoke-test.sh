#!/usr/bin/env bash
#
# scripts/smoke-test.sh — promotion-gate smoke test (founder-os#10739,
# audit findings A-REL-004 / CQ-005).
#
# Polls <base-url>/api/health until it returns HTTP 200 with {"status":"ok"}
# or times out. /api/health is 200-status:ok ONLY when (a) the DB is reachable
# AND (b) migrations applied cleanly (server/migration-health.ts flips it to
# 503 "stale" otherwise). So this single check proves the just-deployed build
# came up AND its migrations landed against the target DB.
#
# Used as the STAGING promotion gate: staging is deployed first (migrations run
# against staging's OWN DB), then this runs against staging. A non-200 here
# FAILS the workflow so the prod deploy job (needs: staging-gate) never runs.
#
# Usage: smoke-test.sh <base-url>       e.g. smoke-test.sh https://yourcondomanager-staging.fly.dev
#   env: SMOKE_MAX_ATTEMPTS (default 30), SMOKE_SLEEP secs (default 6)
set -uo pipefail

BASE="${1:?usage: smoke-test.sh <base-url>}"
URL="${BASE%/}/api/health"
MAX="${SMOKE_MAX_ATTEMPTS:-30}"
SLEEP="${SMOKE_SLEEP:-6}"
BODY="$(mktemp -t smoke-body.XXXXXX)"
trap 'rm -f "$BODY"' EXIT

echo "[smoke] gate target: $URL (up to $MAX attempts, ${SLEEP}s apart)"
for i in $(seq 1 "$MAX"); do
  code="$(curl -sS -m 15 -o "$BODY" -w '%{http_code}' "$URL" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ] && grep -q '"status":"ok"' "$BODY" 2>/dev/null; then
    echo "[smoke] PASS on attempt $i — $URL → 200 status:ok"
    head -c 400 "$BODY"; echo
    exit 0
  fi
  echo "[smoke] attempt $i/$MAX: HTTP $code (not yet healthy) — retrying in ${SLEEP}s"
  [ -s "$BODY" ] && { echo -n "[smoke]   body: "; head -c 300 "$BODY"; echo; }
  sleep "$SLEEP"
done

echo "[smoke] FAIL — $URL never returned 200 status:ok after $MAX attempts."
echo "[smoke] Promotion gate BLOCKS the prod deploy (DB unreachable, migrations stale, or app failed to boot on staging)."
exit 1
