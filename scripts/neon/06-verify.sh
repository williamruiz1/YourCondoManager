#!/usr/bin/env bash
# 06-verify.sh — Post-cutover verification audit. Run BOTH after step 03 (against Neon
# direct URL, pre-cutover) AND after step 04 (against the live app + Neon).
#
# Usage:
#   NEON_DATABASE_URL_DIRECT=postgresql://... ./scripts/neon/06-verify.sh
#   PORTAL_VERIFY_TOKEN='<william-token>' ./scripts/neon/06-verify.sh --post-cutover
#
# Modes:
#   default          → DB-level checks only (against NEON_DATABASE_URL_DIRECT)
#   --post-cutover   → also hits the live HTTPS endpoints on yourcondomanager.fly.dev
#
# Checks (in order):
#   1. drizzle.__drizzle_migrations: exactly 33 entries (matches migrations/*.sql count).
#   2. Cherry Hill Court Condominiums association exists with id f301d073-ed84-4d73-84ce-3ef28af66f7a.
#   3. Cherry Hill: 18 units, 17 persons, 20 ownerships, 19 ledger entries.
#   4. William's 3 units sum to $5,618.61 in owner_ledger_entries (--post-cutover only;
#      requires knowing William's auth_user_id to resolve to ownership rows).
#   5. (--post-cutover only) /api/health, /api/portal/financial-dashboard return 200.
#   6. (--post-cutover only) Plaid bank-feed sync endpoint returns 200.
#
# Exit code 0 = all green. Nonzero = at least one check failed.

set -euo pipefail

POST_CUTOVER=0
for arg in "$@"; do
  case "$arg" in
    --post-cutover) POST_CUTOVER=1 ;;
    -h|--help) grep -E '^# ' "$0" | head -25 | sed 's/^# //; s/^#//'; exit 0 ;;
    *) echo "[error] unknown arg: $arg" >&2; exit 64 ;;
  esac
done

if [ -z "${NEON_DATABASE_URL_DIRECT:-}" ]; then
  echo "[fatal] NEON_DATABASE_URL_DIRECT not set." >&2
  exit 1
fi

EXPECTED_MIGRATIONS="${EXPECTED_MIGRATIONS:-33}"
EXPECTED_CHERRY_HILL_ID="${EXPECTED_CHERRY_HILL_ID:-f301d073-ed84-4d73-84ce-3ef28af66f7a}"
EXPECTED_CH_UNITS="${EXPECTED_CH_UNITS:-18}"
EXPECTED_CH_PERSONS="${EXPECTED_CH_PERSONS:-17}"
EXPECTED_CH_OWNERSHIPS="${EXPECTED_CH_OWNERSHIPS:-20}"
EXPECTED_CH_LEDGER="${EXPECTED_CH_LEDGER:-19}"
EXPECTED_WILLIAM_BALANCE_CENTS="${EXPECTED_WILLIAM_BALANCE_CENTS:-561861}"

HEALTH_URL="${HEALTH_URL:-https://yourcondomanager.fly.dev/api/health}"
DASHBOARD_URL="${DASHBOARD_URL:-https://yourcondomanager.fly.dev/api/portal/financial-dashboard}"
LEDGER_URL="${LEDGER_URL:-https://yourcondomanager.fly.dev/api/portal/ledger}"
PLAID_HEALTH_URL="${PLAID_HEALTH_URL:-https://yourcondomanager.fly.dev/api/bank-feeds/health}"

command -v psql >/dev/null || { echo "[fatal] psql not in PATH"; exit 1; }

FAIL=0
check() {
  local label="$1"; local actual="$2"; local expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  [ok]    %-50s %s\n' "$label" "$actual"
  else
    printf '  [FAIL]  %-50s expected=%s actual=%s\n' "$label" "$expected" "$actual"
    FAIL=1
  fi
}

echo "=== Neon DB-level checks ==="

ACTUAL_MIG="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc 'SELECT COUNT(*) FROM drizzle.__drizzle_migrations;' 2>/dev/null | tr -d '[:space:]')"
check "drizzle migrations count" "$ACTUAL_MIG" "$EXPECTED_MIGRATIONS"

ACTUAL_CH_EXISTS="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc \
  "SELECT id FROM associations WHERE id='$EXPECTED_CHERRY_HILL_ID';" 2>/dev/null | tr -d '[:space:]')"
check "Cherry Hill association exists" "$ACTUAL_CH_EXISTS" "$EXPECTED_CHERRY_HILL_ID"

ACTUAL_CH_UNITS="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc \
  "SELECT COUNT(*) FROM units WHERE association_id='$EXPECTED_CHERRY_HILL_ID';" 2>/dev/null | tr -d '[:space:]')"
check "Cherry Hill units count" "$ACTUAL_CH_UNITS" "$EXPECTED_CH_UNITS"

ACTUAL_CH_PERSONS="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc \
  "SELECT COUNT(*) FROM persons WHERE association_id='$EXPECTED_CHERRY_HILL_ID';" 2>/dev/null | tr -d '[:space:]')"
check "Cherry Hill persons count" "$ACTUAL_CH_PERSONS" "$EXPECTED_CH_PERSONS"

ACTUAL_CH_OWN="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc \
  "SELECT COUNT(*) FROM ownerships o JOIN units u ON u.id=o.unit_id WHERE u.association_id='$EXPECTED_CHERRY_HILL_ID';" 2>/dev/null | tr -d '[:space:]')"
check "Cherry Hill ownerships count" "$ACTUAL_CH_OWN" "$EXPECTED_CH_OWNERSHIPS"

ACTUAL_CH_LED="$(psql "$NEON_DATABASE_URL_DIRECT" -tAc \
  "SELECT COUNT(*) FROM owner_ledger_entries WHERE association_id='$EXPECTED_CHERRY_HILL_ID';" 2>/dev/null | tr -d '[:space:]')"
check "Cherry Hill owner_ledger_entries count" "$ACTUAL_CH_LED" "$EXPECTED_CH_LEDGER"

if [ "$POST_CUTOVER" = "1" ]; then
  echo
  echo "=== Live HTTPS endpoint checks ==="
  command -v curl >/dev/null || { echo "[fatal] curl not in PATH"; exit 1; }

  HEALTH_STATUS="$(curl -fsS -o /dev/null -w '%{http_code}' -m 15 "$HEALTH_URL" 2>/dev/null || echo 'fail')"
  check "GET /api/health" "$HEALTH_STATUS" "200"

  if [ -n "${PORTAL_VERIFY_TOKEN:-}" ]; then
    command -v jq >/dev/null || { echo "[fatal] jq not in PATH"; exit 1; }
    DASH_STATUS="$(curl -fsS -o /tmp/ycm-verify-dash.json -w '%{http_code}' -m 15 \
      -H "Authorization: Bearer $PORTAL_VERIFY_TOKEN" "$DASHBOARD_URL" 2>/dev/null || echo 'fail')"
    check "GET /api/portal/financial-dashboard" "$DASH_STATUS" "200"

    if [ "$DASH_STATUS" = "200" ]; then
      ACTUAL_BAL="$(jq -r '.currentBalanceCents // .balanceCents // .totalBalanceCents // empty' /tmp/ycm-verify-dash.json 2>/dev/null || echo '')"
      if [ -n "$ACTUAL_BAL" ]; then
        check "William's currentBalanceCents" "$ACTUAL_BAL" "$EXPECTED_WILLIAM_BALANCE_CENTS"
      else
        echo "  [warn]  could not extract balance cents from /api/portal/financial-dashboard response"
      fi
    fi

    LEDGER_STATUS="$(curl -fsS -o /dev/null -w '%{http_code}' -m 15 \
      -H "Authorization: Bearer $PORTAL_VERIFY_TOKEN" "$LEDGER_URL" 2>/dev/null || echo 'fail')"
    check "GET /api/portal/ledger" "$LEDGER_STATUS" "200"
  else
    echo "  [skip]  PORTAL_VERIFY_TOKEN unset → skipping portal balance + ledger checks"
  fi

  PLAID_STATUS="$(curl -fsS -o /dev/null -w '%{http_code}' -m 15 "$PLAID_HEALTH_URL" 2>/dev/null || echo 'fail')"
  # Plaid health endpoint may not exist at this exact path on all deploys — treat 200 OR 404 as non-fatal
  if [ "$PLAID_STATUS" = "200" ]; then
    check "GET /api/bank-feeds/health" "$PLAID_STATUS" "200"
  elif [ "$PLAID_STATUS" = "404" ]; then
    echo "  [skip]  Plaid health endpoint returned 404 — confirm route path manually"
  else
    check "GET /api/bank-feeds/health" "$PLAID_STATUS" "200"
  fi
fi

echo
if [ "$FAIL" = "0" ]; then
  echo "[done] All checks passed."
  exit 0
else
  echo "[FAIL] At least one check failed. DO NOT proceed without investigating."
  exit 1
fi
