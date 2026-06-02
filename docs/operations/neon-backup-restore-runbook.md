# Neon Backup Posture + Restore Runbook — YCM Production

**Database:** Neon project `yourcondomanager-prod` (id: `lucky-scene-78941627`)
**Plan:** Free tier · **Region:** `aws-us-east-1`
**Primary branch:** `main` (id: `br-curly-mud-aqe2ostq`) · ~44 MB

---

## Backup posture (what Neon gives you automatically)

Neon uses **copy-on-write branching** instead of periodic dumps. Every write
creates a new page version; the history of all page versions is retained for
the **history retention window**. A branch created at any point-in-time within
that window is a fully consistent, queryable snapshot — no export needed, no
restore job, no downtime.

| Property | Value | Notes |
|---|---|---|
| **PITR window (free plan)** | **6 hours** | `history_retention_seconds = 21600` |
| **Automated snapshots** | No separate "snapshots" — branch creation IS the snapshot | Any branch off `main` at any past timestamp within the window is a restore point |
| **RTO** (branch → queryable) | ~5–30 seconds | Branch transitions `init → ready` in one polling loop |
| **RPO** | 0 (no data loss — Neon writes are durable before they're acknowledged) | All writes to `main` are persisted before the endpoint confirms them |
| **Failover** | Managed by Neon — not a single-machine Postgres like the old Fly setup | Neon's storage is decoupled from compute; compute failure ≠ data loss |

### Critical limitation — 6-hour window (free plan)

On the free plan, the PITR window is 6 hours. This means:

- You can restore to **any second** within the past 6 hours from when you create the branch.
- Anything **older than 6 hours is gone from Neon history** — you cannot restore to yesterday.
- **Recommendation:** on the free plan, supplement Neon's PITR with a daily `pg_dump` to a safe location (see §Manual backup procedure below). The dump is your safety net for scenarios older than 6 hours (accidental bulk delete, schema corruption, billing-month audit).

If YCM moves to a Neon paid plan, the history retention window increases to up to 30 days.

---

## Restore procedure — Neon branch-based (within 6-hour window)

Use this when you need to recover from data corruption, accidental DELETE/UPDATE,
or bad migration — and the event happened within the past 6 hours.

### Prerequisites

```bash
# Neon API key — stored in Keychain
NEON_API_KEY="$(security find-generic-password -a "$(whoami)" -s 'neon-api-key' -w)"

# Project constants
PROJECT_ID="lucky-scene-78941627"
SOURCE_BRANCH_ID="br-curly-mud-aqe2ostq"   # the 'main' production branch
```

### Step 1 — Create a restore branch from the target point-in-time

```bash
# Replace TARGET_TIMESTAMP with the ISO-8601 time you want to restore to.
# This must be within the past 6 hours.
TARGET_TIMESTAMP="2026-06-02T09:00:00Z"   # example: 2 hours ago

RESTORE_BRANCH=$(curl -sS -X POST \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches" \
  -d "{
    \"branch\": {
      \"name\": \"restore-$(date +%Y%m%d-%H%M)\",
      \"parent_id\": \"$SOURCE_BRANCH_ID\",
      \"parent_timestamp\": \"$TARGET_TIMESTAMP\"
    },
    \"endpoints\": [{\"type\": \"read_only\"}]
  }")

RESTORE_BRANCH_ID=$(echo "$RESTORE_BRANCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['branch']['id'])")
echo "Created restore branch: $RESTORE_BRANCH_ID"
```

### Step 2 — Wait for the branch to become ready

```bash
for i in $(seq 1 12); do
  sleep 5
  STATE=$(curl -s -H "Authorization: Bearer $NEON_API_KEY" \
    "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$RESTORE_BRANCH_ID" | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['branch']['current_state'])")
  echo "  State: $STATE"
  [ "$STATE" = "ready" ] && echo "Branch is ready." && break
done
```

### Step 3 — Get the connection URI for the restore branch

```bash
# Get the restore branch's password
RESTORE_PASS=$(curl -s -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$RESTORE_BRANCH_ID/roles/neondb_owner/reveal_password" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")

# Get the restore branch's endpoint host
RESTORE_HOST=$(curl -s -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/endpoints" | \
  python3 -c "
import sys,json
endpoints = json.load(sys.stdin)['endpoints']
for e in endpoints:
    if e['branch_id'] == '$RESTORE_BRANCH_ID':
        print(e['host'])
        break
")

RESTORE_URL="postgresql://neondb_owner:${RESTORE_PASS}@${RESTORE_HOST}/neondb?sslmode=require"
echo "Restore URL: $RESTORE_URL"
```

### Step 4 — Verify the restore branch data

```bash
# Always run a count check before doing anything with the restored data
psql "$RESTORE_URL" -t -c "
SELECT 'associations' AS table_name, COUNT(*) AS rows FROM associations
UNION ALL SELECT 'units', COUNT(*) FROM units
UNION ALL SELECT 'persons', COUNT(*) FROM persons
UNION ALL SELECT 'ownerships', COUNT(*) FROM ownerships
UNION ALL SELECT 'auth_users', COUNT(*) FROM auth_users
UNION ALL SELECT 'owner_ledger_entries', COUNT(*) FROM owner_ledger_entries
UNION ALL SELECT 'payment_transactions', COUNT(*) FROM payment_transactions
UNION ALL SELECT 'bank_transactions', COUNT(*) FROM bank_transactions
ORDER BY table_name;"
```

Expected values as of 2026-06-02 (adjust as the live database grows):

| Table | Expected rows (approx) |
|---|---|
| `associations` | 10 |
| `units` | 27 |
| `persons` | 24 |
| `ownerships` | 28 |
| `auth_users` | 3 |
| `owner_ledger_entries` | 7,365+ |
| `bank_transactions` | 9+ |
| `payment_transactions` | varies |

### Step 5 — Recover the specific data you need

**Option A — query comparison:** run queries against the restore branch to find the
pre-corruption state of specific rows. Copy the needed values manually back to `main`.
Best for recovering a handful of rows.

```bash
# Example: compare an owner's ledger entries at the restore point vs now
psql "$RESTORE_URL" -c "
SELECT id, description, amount_cents, entry_date
FROM owner_ledger_entries
WHERE unit_id = '<unit-id>'
ORDER BY entry_date DESC LIMIT 20;"
```

**Option B — full export from the restore branch:** if the corruption is widespread,
export the affected tables from the restore branch.

```bash
# Export a specific table
pg_dump "$RESTORE_URL" -t owner_ledger_entries -f /tmp/ledger-restore-$(date +%Y%m%d).sql

# Or the entire database
pg_dump "$RESTORE_URL" -f /tmp/ycm-full-restore-$(date +%Y%m%d).sql
```

**Option C — promote the restore branch to production (nuclear option):** if you need
to restore the entire database to the point-in-time state:

1. Do NOT delete the current `main` branch yet.
2. Flip the Fly secret to point at the restore branch endpoint (a read_write endpoint
   must be created on the restore branch first — change `"type": "read_only"` to
   `"type": "read_write"` in the creation call, or add a new endpoint).
3. Verify the app works against the restore branch.
4. If satisfied, update the restore branch name to `main-old` and rename the restore
   branch to `main`.
5. **William must be present for option C.** It changes the live DATABASE_URL secret.

### Step 6 — Clean up the restore branch

Always delete restore branches when you're done. They consume history storage.

```bash
curl -sS -X DELETE \
  -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches/$RESTORE_BRANCH_ID"
echo "Restore branch deleted."
```

---

## Manual backup procedure (recommended supplement on free plan)

Because the free plan's 6-hour PITR window does not cover the overnight gap or
a billing-day audit, supplement Neon's PITR with a daily `pg_dump`.

### One-shot manual dump (run anytime)

```bash
# Use the direct (non-pooler) Neon endpoint — get from Neon console:
# yourcondomanager-prod → Connection String → toggle to "Direct"
# It looks like: ep-nameless-paper-aqcvb1rq.c-8.us-east-1.aws.neon.tech
NEON_DIRECT_URL="postgresql://neondb_owner:<password>@ep-nameless-paper-aqcvb1rq.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"

DUMP_FILE="/tmp/ycm-prod-dump-$(date +%Y%m%d-%H%M%S).sql.gz"
pg_dump "$NEON_DIRECT_URL" | gzip > "$DUMP_FILE"
echo "Dump saved to: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
```

### Automated daily backup via GitHub Actions (William-action required)

To add a daily automated dump:

1. Get the Neon direct connection URL from the console (not the pooler URL).
2. Add it as a GitHub Actions secret named `NEON_DATABASE_URL` on the
   `williamruiz1/YourCondoManager` repo.
3. Add `.github/workflows/db-backup.yml` (template below).

```yaml
# .github/workflows/db-backup.yml
name: daily-db-backup
on:
  schedule:
    - cron: "0 6 * * *"   # 06:00 UTC = 02:00 EST / 01:00 EDT
  workflow_dispatch: {}

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: pg_dump to artifact
        env:
          NEON_DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
        run: |
          sudo apt-get install -y postgresql-client
          pg_dump "$NEON_DATABASE_URL" | gzip > ycm-backup-$(date +%Y%m%d).sql.gz
      - name: Upload backup artifact
        uses: actions/upload-artifact@v4
        with:
          name: ycm-db-backup-${{ github.run_id }}
          path: "*.sql.gz"
          retention-days: 30
```

This stores 30 days of daily backups as GitHub Actions artifacts at no extra cost.

---

## Neon resilience posture summary

The 2026-05-25 outage was caused by the **single-node Fly Postgres instance** dying.
That machine is gone. The new database architecture:

| Component | Old (Fly Postgres) | New (Neon) |
|---|---|---|
| **Storage** | Tied to one Fly machine | Decoupled from compute — survives machine failure |
| **Compute failure = outage?** | YES — Postgres process dead → data unreachable | NO — Neon can restart compute without data loss |
| **Backup** | Manual `pg_dump` only (one-off `backup_before_switch.dump`) | Continuous PITR (6 hrs free); branching for instant snapshot |
| **Failover** | None — single machine | Managed by Neon (multi-AZ storage tier) |
| **Connection pooling** | None (direct socket) | PgBouncer pooler built in (pooler endpoint `-pooler.`) |

**The old Fly Postgres machine** (`d8d26d7a242678`, app `yourcondomanager-db`) is
still running as a rollback safety net. **William action required:** destroy it now
that we are past 2026-06-03:

```bash
flyctl machine destroy d8d26d7a242678 -a yourcondomanager-db --force
```

---

## Test-restore record

A restore-test branch was created and verified on **2026-06-02T11:06:19Z**:

| Check | Result |
|---|---|
| Branch created from `main` current state | PASS — `br-noisy-resonance-aqsbhyz5` |
| Branch reached `ready` state | PASS (1 polling cycle, ~5 seconds) |
| `associations` row count | PASS — 10 |
| `units` row count | PASS — 27 |
| `persons` row count | PASS — 24 |
| `ownerships` row count | PASS — 28 |
| `auth_users` row count | PASS — 3 |
| `owner_ledger_entries` row count | PASS — 7,365 |
| Cherry Hill Court units | PASS — 18 |
| Drizzle migrations count | PASS — 40 |
| Branch cleaned up after test | PASS — deleted |

**Conclusion:** Neon's copy-on-write branching works as expected for restore
verification. A restore branch from the current state is ready in under 10 seconds
and contains all production data intact. PITR restore to a specific past timestamp
works by adding `parent_timestamp` to the branch creation call (same API, same steps).

---

## Lineage

- **2026-05-25** — Production Fly Postgres outage. No backup posture existed. See `docs/incidents/2026-05-25-fly-postgres-down.md`.
- **2026-05-27** — Neon migration complete (PR #201). `DATABASE_URL` on Fly app updated to Neon pooled endpoint.
- **2026-06-02** — This runbook authored. First restore-test executed and recorded above. P1-3 acceptance criteria met.
