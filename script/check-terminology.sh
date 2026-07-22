#!/usr/bin/env bash
# check-terminology.sh — YCM dues-vs-rent terminology guard (founder-os#14743)
#
# WHY (William, voice, 2026-07-14): YourCondoManager charges HOA DUES and
# SPECIAL ASSESSMENTS — never "rent". PlinthKeep is the rent product; the two
# must never be conflated again. An agent turn said "rent payment" about YCM
# and this guard is the mechanical "never again": it fails CI when a
# rent-as-owner-charge phrase lands on a YCM-facing surface.
#
# WHAT IT CATCHES (conflation grammar — an owner's obligation called rent):
#   "rent payment", "pay (your/the) rent", "monthly rent", "rent is due",
#   "rent due", "overdue rent", "rent balance", "rent owed", "collect rent",
#   "rent invoice", "rent reminder", "rent charge"
#
# WHAT IT DELIBERATELY ALLOWS (legitimate domain uses of the word):
#   - occupancy status: "rental occupied", occupancyIntent === "rental"
#   - leasing-rule violations: airbnb/sublet/short-term keyword lists
#   - GL account 4445 "Amenity Rental Income" (the association renting OUT
#     an amenity)
#   - scope-boundary statements ("does not manage ... rent payments") — the
#     allowlist file below carries these as exact path:line-pattern entries
#
# Scope: user/agent-facing sources only (client, server, shared, docs sales
# surfaces). Tests and node_modules excluded.
set -euo pipefail

cd "$(dirname "$0")/.."

# \b word boundaries are load-bearing: without them "curRENT BALANCE" and
# "diffeRENT PAYMENT" false-positive (caught by this script's own negative
# control during the founder-os#14743 build).
CONFLATION_RE='\brent (payment|due\b|charge|balance|owed|collect|invoice|remind)|\bpay (your |the )?rent\b|\bmonthly rent\b|\brent is (due|late)\b|\boverdue rent\b|\bcollect(ing)? rent\b'

# Allowlist: ERE patterns, one per line, matched against "path:line-text".
# Scope-boundary statements that legitimately NAME rent to exclude it.
ALLOWLIST=(
  'does not manage leases, rent payments'   # ftph-v2.1.md scope boundary
  'check-terminology'                       # this guard + its CI wiring
  'founder-os#14743'                        # references to this dispatch
)

hits="$(grep -rniE "$CONFLATION_RE" \
  client/src server shared docs/sales server/email 2>/dev/null \
  | grep -v node_modules || true)"

# Apply allowlist
for pat in "${ALLOWLIST[@]}"; do
  hits="$(printf '%s\n' "$hits" | grep -viE "$pat" || true)"
done
hits="$(printf '%s\n' "$hits" | grep -v '^$' || true)"

if [ -n "$hits" ]; then
  echo "TERMINOLOGY GUARD FAILED — YCM charges HOA dues/assessments, never rent." >&2
  echo "PlinthKeep is the rent product. Fix these (or extend the allowlist ONLY" >&2
  echo "for a legitimate scope-boundary/domain use):" >&2
  printf '%s\n' "$hits" >&2
  exit 1
fi

echo "terminology guard: clean (no rent-as-owner-charge conflation)"
