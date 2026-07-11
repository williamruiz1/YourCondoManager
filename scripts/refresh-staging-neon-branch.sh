#!/usr/bin/env bash
#
# refresh-staging-neon-branch.sh — refresh the staging review data by RESETTING
# the Neon `staging-review` branch to the latest state of prod `main`.
# (founder-os#10193 F0 — prod is Neon, so a branch reset is the clone/refresh
# mechanism; instant copy-on-write, same PG version + extensions, isolated.)
#
# This is the PRIMARY refresh path for our setup (prod = Neon project
# `yourcondomanager-prod`). `refresh-staging-from-prod.sh` (pg_dump) is the
# generic cross-provider fallback.
#
# A branch reset re-points the staging branch at the current head of its parent
# (prod `main`), so staging instantly reflects the latest real CHC data. Writes
# made in staging before the reset are discarded (that is the point).
#
# Requires: a Neon API key in Keychain (`security find-generic-password -s neon-api-key`).
#
# NOTE: staging safety does NOT depend on this script. The code kill-switch
# (server/staging-guard.ts, active via APP_ENV=staging on the staging app)
# blocks all outbound email/SMS/push and refuses live Stripe keys regardless of
# the data. This script only refreshes the DATA.

set -euo pipefail

PROJECT_ID="${NEON_PROJECT_ID:-lucky-scene-78941627}"        # yourcondomanager-prod
STAGING_BRANCH="${NEON_STAGING_BRANCH:-br-autumn-voice-aqi2xdyc}"  # staging-review
PARENT_BRANCH="${NEON_PARENT_BRANCH:-br-curly-mud-aqe2ostq}"       # main (prod)

NEON_KEY="${NEON_API_KEY:-$(security find-generic-password -s neon-api-key -w 2>/dev/null || true)}"
[ -n "$NEON_KEY" ] || { echo "ERROR: no Neon API key (keychain 'neon-api-key' or \$NEON_API_KEY)"; exit 1; }

echo "==> Resetting staging branch $STAGING_BRANCH → head of parent $PARENT_BRANCH …"
curl -fsS -X POST \
  -H "Authorization: Bearer $NEON_KEY" -H "Content-Type: application/json" \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$STAGING_BRANCH/reset_to_parent" \
  2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); print('reset op:', [o.get('action') for o in d.get('operations',[])])" 2>&1 \
  || {
    # Fallback: some API versions use the generic restore endpoint.
    echo "   (reset_to_parent unavailable — trying restore endpoint)"
    curl -fsS -X POST -H "Authorization: Bearer $NEON_KEY" -H "Content-Type: application/json" \
      "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$STAGING_BRANCH/restore" \
      -d "{\"source_branch_id\":\"$PARENT_BRANCH\"}" | head -c 400
  }

echo ""
echo "==> DONE. Staging data now reflects the latest prod. The kill-switch keeps it side-effect-free."
