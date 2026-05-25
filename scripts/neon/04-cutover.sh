#!/usr/bin/env bash
# 04-cutover.sh — The actual production cutover. Switches Fly DATABASE_URL to Neon,
# rolling-restarts the app machines, verifies, and auto-rolls-back on failure.
#
# Usage:
#   NEON_DATABASE_URL_POOLED=postgresql://...-pooler.aws-us-east-1.neon.tech/...?sslmode=require \
#   FLY_PG_OLD_DATABASE_URL=postgres://...flycast:5432/yourcondomanager?sslmode=disable \
#   PORTAL_VERIFY_TOKEN='<william-portal-token>' \
#     ./scripts/neon/04-cutover.sh
#
#   ./scripts/neon/04-cutover.sh --dry-run     # prints intended actions; touches NOTHING
#
# Required env:
#   NEON_DATABASE_URL_POOLED  — pooled Neon string (host contains '-pooler.').
#   FLY_PG_OLD_DATABASE_URL   — current DATABASE_URL on the yourcondomanager app, captured
#                                BEFORE running this script. Used for auto-rollback.
#                                Capture with: flyctl secrets list -a yourcondomanager (won't show value);
#                                you must save it separately ahead of time. See RUNBOOK.md step 4.
#
# Optional env:
#   PORTAL_VERIFY_TOKEN       — A valid William portal access token. If set, this script
#                                will GET /api/portal/financial-dashboard and verify the
#                                returned currentBalance equals $5,618.61. If unset, skips
#                                that check (still does /api/health).
#   EXPECTED_BALANCE_CENTS    — Override (default 561861 = $5,618.61).
#   HEALTH_TIMEOUT_SEC        — Wait this long for /api/health to return 200 after restart (default 180).
#
# Exit codes:
#   0  — cutover succeeded + verification passed
#   1  — fatal pre-flight (no rollback needed)
#   2  — cutover started, verification failed, ROLLBACK COMPLETED
#   3  — cutover started, verification failed, ROLLBACK ALSO FAILED (manual intervention)

set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      grep -E '^# ' "$0" | head -35 | sed 's/^# //; s/^#//'
      exit 0
      ;;
    *) echo "[error] unknown arg: $arg" >&2; exit 64 ;;
  esac
done

FLY_APP="${FLY_APP:-yourcondomanager}"
HEALTH_URL="${HEALTH_URL:-https://yourcondomanager.fly.dev/api/health}"
DASHBOARD_URL="${DASHBOARD_URL:-https://yourcondomanager.fly.dev/api/portal/financial-dashboard}"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-180}"
EXPECTED_BALANCE_CENTS="${EXPECTED_BALANCE_CENTS:-561861}"

if [ -z "${NEON_DATABASE_URL_POOLED:-}" ]; then
  echo "[fatal] NEON_DATABASE_URL_POOLED not set. See scripts/neon/01-provision.md." >&2
  exit 1
fi

if [[ "$NEON_DATABASE_URL_POOLED" != *"-pooler."* ]]; then
  echo "[fatal] NEON_DATABASE_URL_POOLED does not look pooled (no '-pooler.' in host)." >&2
  echo "        Production runtime MUST use the pooled string. See step 01." >&2
  exit 1
fi

if [ -z "${FLY_PG_OLD_DATABASE_URL:-}" ] && [ "$DRY_RUN" = "0" ]; then
  echo "[fatal] FLY_PG_OLD_DATABASE_URL not set. This script needs it for auto-rollback." >&2
  echo "        Before running this, capture the current Fly DATABASE_URL value (you set it" >&2
  echo "        when you originally wired Fly Postgres). See RUNBOOK.md step 4.0." >&2
  exit 1
fi

command -v flyctl >/dev/null || { echo "[fatal] flyctl not in PATH"; exit 1; }
command -v curl   >/dev/null || { echo "[fatal] curl not in PATH"; exit 1; }
command -v jq     >/dev/null || { echo "[fatal] jq not in PATH (brew install jq)"; exit 1; }

echo "[plan] App:                  $FLY_APP"
echo "[plan] Health URL:           $HEALTH_URL"
echo "[plan] Dashboard URL:        $DASHBOARD_URL"
echo "[plan] Expected balance:     $EXPECTED_BALANCE_CENTS cents (\$$(awk "BEGIN{printf \"%.2f\", $EXPECTED_BALANCE_CENTS/100}"))"
echo "[plan] Health timeout:       ${HEALTH_TIMEOUT_SEC}s"
echo "[plan] Portal verify token:  $( [ -n "${PORTAL_VERIFY_TOKEN:-}" ] && echo 'SET' || echo 'UNSET (will skip balance check)' )"
echo

# ============================================================================
# Step A: Verify Neon is reachable + has data BEFORE flipping the switch.
# ============================================================================
echo "[step A] Pre-flight Neon reachability + sanity..."
if [ "$DRY_RUN" = "0" ]; then
  ASSOC_COUNT="$(psql "$NEON_DATABASE_URL_POOLED" -tAc 'SELECT COUNT(*) FROM associations;' 2>/dev/null | tr -d '[:space:]' || echo 0)"
  if [ -z "$ASSOC_COUNT" ] || [ "$ASSOC_COUNT" = "0" ]; then
    echo "[fatal] Neon has 0 associations. Did you run 03-import-to-neon.sh?" >&2
    exit 1
  fi
  echo "[ok] Neon reachable. associations=$ASSOC_COUNT"
else
  echo "[dry-run] Would: psql NEON_DATABASE_URL_POOLED -c 'SELECT COUNT(*) FROM associations'"
fi

# ============================================================================
# Step B: Flip the Fly DATABASE_URL secret.
# `flyctl secrets set` deploys the change as part of normal release flow,
# which restarts machines automatically. We use --stage so we can control
# the restart sequencing ourselves and verify health between machines.
# ============================================================================
echo
echo "[step B] Setting DATABASE_URL secret on $FLY_APP to Neon (pooled)..."
if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] Would run:"
  echo "  flyctl secrets set --stage DATABASE_URL='<neon-pooled-redacted>' -a $FLY_APP"
  echo "  flyctl deploy -a $FLY_APP --strategy rolling --no-cache"
  echo "  curl -fsS $HEALTH_URL  # poll until 200, max ${HEALTH_TIMEOUT_SEC}s"
  if [ -n "${PORTAL_VERIFY_TOKEN:-}" ]; then
    echo "  curl -fsS -H 'Authorization: Bearer <token>' $DASHBOARD_URL"
    echo "    → assert currentBalanceCents == $EXPECTED_BALANCE_CENTS"
  fi
  echo "[dry-run] Done. Nothing changed."
  exit 0
fi

# Use --stage so the secret is set without an immediate auto-deploy; we control deploy below.
flyctl secrets set --stage DATABASE_URL="$NEON_DATABASE_URL_POOLED" -a "$FLY_APP" >/dev/null
echo "[ok] Secret staged."

# ============================================================================
# Step C: Roll the deploy. Fly's `deploy --strategy rolling` restarts machines
# one at a time; if any machine fails its health check, the deploy aborts and
# the unaffected machines stay on the old image. We have one image and we're
# only changing a secret, so we use `--no-cache` to ensure the new env is picked up.
# ============================================================================
echo
echo "[step C] Rolling deploy to pick up the new secret..."
CUTOVER_START=$(date +%s)
if ! flyctl deploy -a "$FLY_APP" --strategy rolling --no-cache --wait-timeout 300; then
  echo "[fatal] flyctl deploy failed. Initiating rollback..." >&2
  if flyctl secrets set --stage DATABASE_URL="$FLY_PG_OLD_DATABASE_URL" -a "$FLY_APP" >/dev/null && \
     flyctl deploy -a "$FLY_APP" --strategy rolling --no-cache --wait-timeout 300; then
    echo "[ok] Rollback succeeded. Back on Fly Postgres."
    exit 2
  else
    echo "[fatal] ROLLBACK FAILED. Run 05-rollback.sh manually and check app status." >&2
    exit 3
  fi
fi
echo "[ok] Deploy completed."

# ============================================================================
# Step D: Verify /api/health returns 200.
# ============================================================================
echo
echo "[step D] Polling $HEALTH_URL ..."
HEALTH_DEADLINE=$(( $(date +%s) + HEALTH_TIMEOUT_SEC ))
HEALTH_OK=0
while [ "$(date +%s)" -lt "$HEALTH_DEADLINE" ]; do
  if curl -fsS -m 10 "$HEALTH_URL" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  sleep 5
done

if [ "$HEALTH_OK" = "0" ]; then
  echo "[fatal] /api/health did not return 200 within ${HEALTH_TIMEOUT_SEC}s. Rolling back..." >&2
  if "$(dirname "$0")/05-rollback.sh"; then
    exit 2
  else
    exit 3
  fi
fi
echo "[ok] /api/health → 200"

# ============================================================================
# Step E: Verify William's portal dashboard balance.
# ============================================================================
if [ -n "${PORTAL_VERIFY_TOKEN:-}" ]; then
  echo
  echo "[step E] Verifying William's portal financial-dashboard..."
  BODY="$(curl -fsS -m 15 -H "Authorization: Bearer $PORTAL_VERIFY_TOKEN" "$DASHBOARD_URL" 2>/dev/null || true)"
  if [ -z "$BODY" ]; then
    echo "[fatal] Could not fetch $DASHBOARD_URL (auth or routing issue). Rolling back..." >&2
    "$(dirname "$0")/05-rollback.sh" && exit 2 || exit 3
  fi
  # Look for any of: currentBalanceCents, balanceCents, totalBalanceCents.
  ACTUAL_CENTS="$(echo "$BODY" | jq -r '.currentBalanceCents // .balanceCents // .totalBalanceCents // empty' 2>/dev/null || true)"
  if [ -z "$ACTUAL_CENTS" ]; then
    echo "[warn] Could not extract balance cents from dashboard response. Response was:"
    echo "$BODY" | head -c 500
    echo
    echo "[warn] Skipping numeric assertion. Verify manually via the UI."
  elif [ "$ACTUAL_CENTS" != "$EXPECTED_BALANCE_CENTS" ]; then
    echo "[fatal] Balance mismatch: expected=$EXPECTED_BALANCE_CENTS, actual=$ACTUAL_CENTS. Rolling back..." >&2
    "$(dirname "$0")/05-rollback.sh" && exit 2 || exit 3
  else
    echo "[ok] Balance matches: $ACTUAL_CENTS cents."
  fi
else
  echo "[skip] PORTAL_VERIFY_TOKEN not set. Verify William's balance manually after cutover."
fi

ELAPSED=$(( $(date +%s) - CUTOVER_START ))
echo
echo "================================================================="
echo "[done] Cutover complete in ${ELAPSED}s. YCM is now on Neon."
echo "[next] Run: ./scripts/neon/06-verify.sh   # full post-cutover audit"
echo "[next] Keep the dump file for 7 days as a backup."
echo "================================================================="
