#!/usr/bin/env bash
# 05-rollback.sh — Emergency rollback. Reverts the Fly DATABASE_URL secret to the
# original Fly Postgres connection string + rolls the deploy + waits for health.
#
# Usage:
#   FLY_PG_OLD_DATABASE_URL='postgres://...flycast:5432/yourcondomanager?sslmode=disable' \
#     ./scripts/neon/05-rollback.sh
#   ./scripts/neon/05-rollback.sh --dry-run
#
# Exit codes:
#   0 — rollback succeeded, /api/health returning 200
#   1 — fatal pre-flight failure
#   2 — secret set succeeded, deploy or health check failed (manual intervention)

set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) grep -E '^# ' "$0" | head -20 | sed 's/^# //; s/^#//'; exit 0 ;;
    *) echo "[error] unknown arg: $arg" >&2; exit 64 ;;
  esac
done

FLY_APP="${FLY_APP:-yourcondomanager}"
HEALTH_URL="${HEALTH_URL:-https://yourcondomanager.fly.dev/api/health}"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-180}"

if [ -z "${FLY_PG_OLD_DATABASE_URL:-}" ]; then
  echo "[fatal] FLY_PG_OLD_DATABASE_URL not set. Cannot roll back without the original DATABASE_URL value." >&2
  echo "        If you lost it: in Fly's dashboard for yourcondomanager-db, copy the 'flycast' connection" >&2
  echo "        URL and prepend the postgres user. Format: postgres://postgres:<pwd>@yourcondomanager-db.flycast:5432/yourcondomanager?sslmode=disable" >&2
  exit 1
fi

command -v flyctl >/dev/null || { echo "[fatal] flyctl not in PATH"; exit 1; }
command -v curl   >/dev/null || { echo "[fatal] curl not in PATH"; exit 1; }

echo "[plan] Reverting DATABASE_URL on $FLY_APP back to Fly Postgres."
echo "[plan] Then rolling deploy + polling $HEALTH_URL."

if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] Would run:"
  echo "  flyctl secrets set --stage DATABASE_URL='<fly-postgres-redacted>' -a $FLY_APP"
  echo "  flyctl deploy -a $FLY_APP --strategy rolling --no-cache --wait-timeout 300"
  echo "  curl -fsS $HEALTH_URL  # poll until 200, max ${HEALTH_TIMEOUT_SEC}s"
  echo "[dry-run] No changes made."
  exit 0
fi

echo "[step] Setting DATABASE_URL back to Fly Postgres..."
flyctl secrets set --stage DATABASE_URL="$FLY_PG_OLD_DATABASE_URL" -a "$FLY_APP" >/dev/null
echo "[ok] Secret staged."

echo "[step] Rolling deploy..."
if ! flyctl deploy -a "$FLY_APP" --strategy rolling --no-cache --wait-timeout 300; then
  echo "[fatal] Deploy failed during rollback. Manual intervention required." >&2
  echo "        Check: flyctl status -a $FLY_APP" >&2
  echo "        Check: flyctl logs -a $FLY_APP" >&2
  exit 2
fi
echo "[ok] Deploy completed."

echo "[step] Polling $HEALTH_URL ..."
DEADLINE=$(( $(date +%s) + HEALTH_TIMEOUT_SEC ))
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  if curl -fsS -m 10 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[ok] /api/health → 200. Rollback complete."
    exit 0
  fi
  sleep 5
done

echo "[fatal] /api/health did not return 200 within ${HEALTH_TIMEOUT_SEC}s after rollback." >&2
echo "        Check: flyctl status -a $FLY_APP" >&2
echo "        Check: flyctl logs -a $FLY_APP" >&2
exit 2
