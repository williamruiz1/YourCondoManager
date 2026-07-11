# YCM Deploy Safety & Rollback Runbook

**Covers:** founder-os#10739 — audit findings **A-REL-004** / **CQ-005** (auto-deploy
on every merge, immediate strategy, auto-migrations, no staging gate, no rollback).

This is the operator runbook for the **gated deploy pipeline**
(`.github/workflows/fly-deploy.yml`) and how to recover a bad prod deploy or
migration on the live Cherry Hill (`yourcondomanager`) money app.

---

## 1. How the gated pipeline works

Every push to `main` (and `workflow_dispatch`) runs three sequential jobs — a
failure in any stage stops the prod deploy:

1. **`money-migration-guard`** — `scripts/check-money-migrations.cjs` scans the
   migrations added in the push for **destructive DDL on a money table**
   (`owner_ledger_entries`, `payment_transactions`, `special_assessments`,
   `utility_payments`, `bank_statement_transactions`, `bank_transactions`,
   `payments`, `assessments`, `payment_methods`, `autopay_enrollments`). A
   `DROP`/`ALTER COLUMN … TYPE`/`DROP NOT NULL`/`RENAME COLUMN`/`TRUNCATE`
   against one of those **blocks the pipeline** unless a commit in the push
   carries `[money-migration-reviewed]`. Additive `CREATE TABLE`/`ADD COLUMN`
   is allowed.
2. **`staging-gate`** — deploys the build to **`yourcondomanager-staging`**
   (which has its **own** database), so `release_command` runs the migrations
   against staging's DB first. `scripts/smoke-test.sh` then polls
   `https://yourcondomanager-staging.fly.dev/api/health` — that route returns
   `200 {status:"ok"}` **only** when the DB is reachable AND migrations applied
   cleanly. A non-200 **blocks prod** (`deploy-prod` `needs: staging-gate`).
3. **`deploy-prod`** — `scripts/predeploy-snapshot.sh` takes a fresh Fly
   Postgres volume snapshot of `yourcondomanager-db` (fail-closed — no snapshot,
   no deploy), then `flyctl deploy --remote-only --strategy immediate`.

**Required repo secrets:** `FLY_API_TOKEN` (prod deploy), `FLY_STAGING_API_TOKEN`
(staging deploy), `FLY_DB_API_TOKEN` (DB-app snapshot). See the workflow header.

---

## 2. Rollback: bad app image (no schema change)

The new build is broken but migrations were fine (or there were none).

```bash
# See recent releases and pick the last-good version:
flyctl releases -a yourcondomanager

# Roll the app image back to a specific version (fast, no data impact):
flyctl deploy -a yourcondomanager --image <registry.fly.io/...:deployment-XXXX>
#   (the image ref for a version is shown in `flyctl releases --json`)
# — or —
flyctl releases rollback -a yourcondomanager      # if available in your flyctl
```

The app returns to the prior image immediately (single machine, immediate
strategy). Verify: `curl -sf https://app.yourcondomanager.org/api/health`.

---

## 3. Rollback: bad migration (data-shape damage) — restore from snapshot

`flyctl deploy` rollback reverts the **image**, NOT the schema. A destructive
migration that reached prod needs a **DB restore from the pre-deploy snapshot**.

```bash
# 1. Find the volume + the pre-deploy snapshot (the pipeline just made one):
flyctl volumes list -a yourcondomanager-db
flyctl volumes snapshots list <vol-id>        # newest = the pre-deploy snapshot

# 2. Create a NEW volume FROM the snapshot (never restore in place):
flyctl volumes create pg_data \
  --snapshot-id <snapshot-id> -a yourcondomanager-db --region ewr

# 3. Attach the restored volume to a (new) DB machine, promote it, and repoint
#    the app's DATABASE_URL if the primary changed. For Fly Postgres:
#    - stop the damaged machine, start a machine on the restored volume, OR
#    - use `flyctl postgres` restore flows per Fly's current PG docs.
#    Confirm the schema is back to the pre-deploy shape before repointing prod.

# 4. Re-verify the money tables against the pre-incident state, then roll the
#    app image back (section 2) so code + schema match again.
```

> **Money-safety:** a restore touches the live ledger. Treat step 3 as a
> William-ratify action; validate the restored schema against a copy before
> repointing prod at it. Fly also keeps **daily automatic** volume snapshots as
> an additional recovery point if the pre-deploy snapshot is unavailable.

---

## 4. Reverting the gate itself

The gate is purely additive to the workflow. To return to the previous
single-job immediate deploy: `git revert` the commit that introduced this
pipeline, or restore the old `.github/workflows/fly-deploy.yml`. The
`fly.toml` deploy strategy is unchanged (`immediate`), so no app reconfig is
needed.

---

## 5. Test the abort path (verification / drill)

To confirm a bad migration aborts on staging without touching prod (the
A-REL-004 acceptance test), deploy a deliberately-broken migration to staging
only:

```bash
# On a throwaway branch, add a migration with invalid SQL, then:
flyctl deploy --remote-only --app yourcondomanager-staging --strategy immediate
# EXPECT: release_command (scripts/migrate.cjs) exits non-zero → deploy ABORTS,
#         staging app machines stay on the prior image, /api/health still serves
#         the old-but-healthy app. Prod is never touched (the prod job needs the
#         staging gate to pass).
```
