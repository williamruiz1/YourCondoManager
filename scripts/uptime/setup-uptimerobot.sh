#!/usr/bin/env bash
# setup-uptimerobot.sh — Programmatic fallback for setup-betterstack.md.
# Creates an UptimeRobot HTTPS monitor on /api/health via their REST API.
#
# Tradeoffs vs Better Stack (recommended; see scripts/uptime/setup-betterstack.md):
#   - UptimeRobot free tier check interval is 5 minutes (vs Better Stack's 30 seconds).
#   - UptimeRobot free tier alerts via email + mobile app only (no SMS).
#   - UptimeRobot has a clean REST API → fully automatable, no UI clicks.
#
# Use this script if William doesn't want a Better Stack account, OR as a SECOND monitor
# alongside Better Stack for redundancy (different vendors → uncorrelated failure).
#
# Usage:
#   UPTIMEROBOT_API_KEY='u-xxxxxxxxxxxx' ./scripts/uptime/setup-uptimerobot.sh
#   UPTIMEROBOT_API_KEY='u-xxxxxxxxxxxx' ./scripts/uptime/setup-uptimerobot.sh --dry-run
#
# Required env:
#   UPTIMEROBOT_API_KEY  — Main API key from https://uptimerobot.com/dashboard#mySettings
#                          (the "Main API Key", not a "Monitor-Specific API Key").
#
# What this script does:
#   1. Probes /getAccountDetails to verify the key works.
#   2. Lists existing monitors; if one already matches the YCM health URL, skips creation.
#   3. Creates a new HTTP(S) monitor:
#        - URL: https://yourcondomanager.fly.dev/api/health
#        - Interval: 300 (free-tier minimum = 5 min)
#        - Type: HTTP(S) (= 1)
#        - Keyword check: "ok" must be in response body
#        - Alert contacts: all default contacts (William's account-level contacts)
#
# Exit codes:
#   0 — monitor created OR already existed
#   1 — fatal (auth, network, API error)

set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) grep -E '^# ' "$0" | head -30 | sed 's/^# //; s/^#//'; exit 0 ;;
    *) echo "[error] unknown arg: $arg" >&2; exit 64 ;;
  esac
done

if [ -z "${UPTIMEROBOT_API_KEY:-}" ]; then
  echo "[fatal] UPTIMEROBOT_API_KEY not set." >&2
  echo "        Get it from: https://uptimerobot.com/dashboard#mySettings → Main API Key" >&2
  exit 1
fi

command -v curl >/dev/null || { echo "[fatal] curl not in PATH"; exit 1; }
command -v jq   >/dev/null || { echo "[fatal] jq not in PATH (brew install jq)"; exit 1; }

API_BASE="https://api.uptimerobot.com/v2"
HEALTH_URL="${HEALTH_URL:-https://yourcondomanager.fly.dev/api/health}"
MONITOR_NAME="${MONITOR_NAME:-YCM production health}"
KEYWORD="${KEYWORD:-ok}"

echo "[plan] API:           $API_BASE"
echo "[plan] Health URL:    $HEALTH_URL"
echo "[plan] Monitor name:  $MONITOR_NAME"
echo "[plan] Keyword:       \"$KEYWORD\" (must appear in response body)"
echo "[plan] Interval:      300s (5 min — free-tier floor)"
echo

if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] Would call /getAccountDetails to verify API key."
  echo "[dry-run] Would call /getMonitors to check for existing matching monitor."
  echo "[dry-run] If none exists, would call /newMonitor with:"
  echo "          type=2 (keyword), keyword_type=2 (exists), keyword_value=$KEYWORD"
  echo "          url=$HEALTH_URL, interval=300, alert_contacts=<all default>"
  echo "[dry-run] No HTTP calls made. Exit."
  exit 0
fi

# --- Step 1: verify the API key ---
echo "[step] Verifying API key via /getAccountDetails..."
ACCT="$(curl -fsS -X POST "$API_BASE/getAccountDetails" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Cache-Control: no-cache' \
  -d "api_key=${UPTIMEROBOT_API_KEY}&format=json" 2>/dev/null || echo '{}')"

STAT="$(echo "$ACCT" | jq -r '.stat // empty')"
if [ "$STAT" != "ok" ]; then
  echo "[fatal] /getAccountDetails returned non-ok. Response:" >&2
  echo "$ACCT" | jq . >&2 || echo "$ACCT" >&2
  exit 1
fi
EMAIL="$(echo "$ACCT" | jq -r '.account.email')"
MONITOR_INTERVAL_LIMIT="$(echo "$ACCT" | jq -r '.account.monitor_interval')"
echo "[ok] Auth OK. Account: $EMAIL. Min interval: ${MONITOR_INTERVAL_LIMIT}s"

# --- Step 2: list existing monitors; check for duplicate ---
echo "[step] Checking for existing monitor with matching URL..."
LIST="$(curl -fsS -X POST "$API_BASE/getMonitors" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "api_key=${UPTIMEROBOT_API_KEY}&format=json&search=${HEALTH_URL}" 2>/dev/null || echo '{}')"

EXISTING_ID="$(echo "$LIST" | jq -r --arg url "$HEALTH_URL" \
  '.monitors[]? | select(.url==$url) | .id' | head -1)"

if [ -n "$EXISTING_ID" ]; then
  echo "[ok] Monitor already exists with id=$EXISTING_ID for $HEALTH_URL. Nothing to do."
  exit 0
fi

if [ "$DRY_RUN" = "1" ]; then
  echo "[dry-run] Would POST /newMonitor with:"
  echo "          friendly_name='$MONITOR_NAME'"
  echo "          url='$HEALTH_URL'"
  echo "          type=2  (keyword)"
  echo "          keyword_type=2 (exists)"
  echo "          keyword_value='$KEYWORD'"
  echo "          interval=300"
  echo "          alert_contacts=<all default contacts>"
  echo "[dry-run] No call made."
  exit 0
fi

# --- Step 3: get default alert contacts (we want William's email + mobile app) ---
echo "[step] Fetching alert contacts..."
CONTACTS="$(curl -fsS -X POST "$API_BASE/getAlertContacts" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "api_key=${UPTIMEROBOT_API_KEY}&format=json" 2>/dev/null || echo '{}')"

# Build the alert_contacts string. Format: "<id>_<threshold>_<recurrence>-<id>_<threshold>_<recurrence>"
# threshold = minutes before first alert (0 = immediate). recurrence = 0 (single alert).
ALERT_CONTACT_PARAM="$(echo "$CONTACTS" | jq -r '
  [.alert_contacts[]? | "\(.id)_0_0"] | join("-")
')"
if [ -z "$ALERT_CONTACT_PARAM" ]; then
  echo "[warn] No alert contacts found on this UptimeRobot account."
  echo "       The monitor will still run but won't notify until you add a contact."
  echo "       Add one at https://uptimerobot.com/dashboard#mySettings → My Settings → Alert Contacts."
  ALERT_CONTACT_PARAM=""
fi

# --- Step 4: create the monitor (type=2 keyword, keyword_type=2 = "exists") ---
echo "[step] Creating monitor..."
CREATE_PAYLOAD="api_key=${UPTIMEROBOT_API_KEY}&format=json&type=2&keyword_type=2&keyword_value=${KEYWORD}&friendly_name=${MONITOR_NAME// /%20}&url=${HEALTH_URL}&interval=300"
if [ -n "$ALERT_CONTACT_PARAM" ]; then
  CREATE_PAYLOAD="${CREATE_PAYLOAD}&alert_contacts=${ALERT_CONTACT_PARAM}"
fi

CREATE_RESP="$(curl -fsS -X POST "$API_BASE/newMonitor" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "$CREATE_PAYLOAD" 2>/dev/null || echo '{}')"

CREATE_STAT="$(echo "$CREATE_RESP" | jq -r '.stat // empty')"
if [ "$CREATE_STAT" != "ok" ]; then
  echo "[fatal] newMonitor failed. Response:" >&2
  echo "$CREATE_RESP" | jq . >&2 || echo "$CREATE_RESP" >&2
  exit 1
fi

NEW_ID="$(echo "$CREATE_RESP" | jq -r '.monitor.id')"
echo "[ok] Monitor created. id=$NEW_ID"
echo
echo "[next] BEFORE running scripts/neon/04-cutover.sh, pause this monitor to avoid"
echo "       paging William during the planned downtime. From the UptimeRobot dashboard:"
echo "         Monitors → $MONITOR_NAME → Pause"
echo "       Or via API:"
echo "         curl -fsS -X POST $API_BASE/editMonitor \\"
echo "           -d 'api_key=\$UPTIMEROBOT_API_KEY&format=json&id=$NEW_ID&status=0'"
echo "[next] AFTER 06-verify.sh passes, resume:"
echo "         curl -fsS -X POST $API_BASE/editMonitor \\"
echo "           -d 'api_key=\$UPTIMEROBOT_API_KEY&format=json&id=$NEW_ID&status=1'"
