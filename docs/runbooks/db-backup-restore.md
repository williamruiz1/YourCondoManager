# Runbook — Database Backup & Restore (Neon Postgres)

**Owner:** Engineering · **Last verified:** 2026-07-03 (restore drill executed against live prod — see §5)
**Anchors:** readiness P1-3 (YCM#210) · production-readiness audit finding R-2

> This runbook covers the production money database. Every fact below marked **[VERIFIED
> 2026-07-03]** was probed live this session. Anything not directly probed is marked
> **[UNVERIFIED — run: `<command>`]** so no assumed state is presented as fact.

---

## 1. Current posture (verified)

| Property | Value | Source |
|---|---|---|
| Provider | **Neon** (managed serverless Postgres) | [VERIFIED 2026-07-03] read from live app + Neon API |
| Neon plan | **Launch** (`launch_v3`) | [VERIFIED] Neon API `GET /projects/{id}` → `owner.subscription_type` |
| Project | `lucky-scene-78941627` (`yourcondomanager-prod`), created 2026-05-25 | [VERIFIED] Neon API |
| Postgres version | **17** | [VERIFIED] Neon API `pg_version` |
| Region | `aws-us-east-1` | [VERIFIED] Neon API |
| App endpoint (pooled) | `ep-nameless-paper-aqcvb1rq-pooler.c-8.us-east-1.aws.neon.tech:5432`, `sslmode=require`, db `neondb` | [VERIFIED] `fly ssh console -C 'printenv DATABASE_URL'` (host only) |
| **Direct endpoint (for dumps)** | `ep-nameless-paper-aqcvb1rq.c-8.us-east-1.aws.neon.tech` (drop `-pooler`) | [VERIFIED] DNS resolves |
| Branch | `br-curly-mud-aqe2ostq` (`main`, default) — **not protected** | [VERIFIED] Neon API branches |
| Logical size | ~46 MB | [VERIFIED] Neon API |
| **PITR window (`history_retention_seconds`)** | **21600 s = 6 hours** | [VERIFIED] Neon API |
| Autoscaling / suspend | 0.25–8 CU, `suspend_timeout=0` (always-on) | [VERIFIED] Neon API |

### What IS covered
- **Neon Point-in-Time Recovery (PITR)** — Neon retains WAL history, so the DB can be
  restored to any instant within the retention window (currently **6 hours**) by creating a
  branch from a timestamp. This is the primary recovery path for accidental deletes / bad
  migrations caught quickly. No action needed to "enable" it — it is always on for the plan.
- **Neon branching** — instant copy-on-write branches (limit 5000 on Launch) make restore
  *drills* and point-in-time forks cheap and non-destructive.

### What is NOT covered (the gaps this runbook closes)
- **No history beyond the 6-hour PITR window.** A problem discovered >6 h later cannot be
  PITR-recovered. → mitigated by the weekly logical backup net (§3) + the config fix below.
- **No backup independent of the Neon account.** A Neon-account-level loss (billing lapse,
  project deletion, provider incident) would take PITR with it. → mitigated by the weekly
  `pg_dump` net (§3), whose artifacts live in GitHub (and, optionally, offsite R2).
- Prior to this runbook the only backup was a single one-off `backup_before_switch.dump`
  (2026-05-26, in the repo) with no tested restore path.

---

## 2. Findings & recommended config changes

These are **verified** and mostly free within the current plan. Non-destructive; do via the
Neon console or API.

1. **Raise PITR from 6 h → 7 days (free on Launch).** The Launch plan supports up to 7 days of
   history retention; this project is set to only 6 h. Raising it turns the RPO from 6 h into
   7 days at no cost and closes most of the gap above.
   `PATCH /projects/lucky-scene-78941627 { "project": { "history_retention_seconds": 604800 } }`
   (or Neon console → Project → Settings → Storage → History retention).
2. **Protect the `main` branch.** It is currently unprotected; protection prevents accidental
   branch deletion / data-loss operations on production.
   Neon console → Branches → `main` → Protect (or API `PATCH .../branches/{id}`).
3. **Dumps must use the DIRECT endpoint, not the pooler.** The app's `DATABASE_URL` points at
   the PgBouncer **pooler** endpoint (transaction pooling), which breaks `pg_dump`
   (session-level features). Always strip `-pooler` from the host for logical dumps. The §3
   workflow does this automatically.
4. **A restore target must have the `pgvector` extension.** One table (`document_embeddings`,
   RAG embeddings — regenerable, not money data) uses the `vector` type. Neon provides
   `pgvector` natively, so a Neon-target restore is clean; a vanilla-Postgres restore target
   must `CREATE EXTENSION vector` first.

---

## 3. Weekly logical-backup safety net (independent of Neon)

A scheduled GitHub Actions workflow runs `pg_dump` weekly and stores the artifact.

- **Workflow:** `.github/workflows/db-backup.yml` (weekly cron + manual `workflow_dispatch`).
- **Credential:** by default it reuses the **existing `FLY_API_TOKEN` repo secret** — it reads
  the live `DATABASE_URL` from the running Fly app, de-pools it, and dumps. **No new secret is
  required for it to run.**
- **Preferred hardening (optional, one secret):** add a repo secret
  **`BACKUP_DATABASE_URL`** = the **direct** (non-pooler) connection string. The workflow
  prefers it when present and no longer depends on the app being reachable over Fly SSH:
  ```bash
  # value = app DATABASE_URL with "-pooler" removed. To add it:
  gh secret set BACKUP_DATABASE_URL -R williamruiz1/YourCondoManager --body 'postgresql://<user>:<pass>@ep-nameless-paper-aqcvb1rq.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
  ```
  > [WILLIAM/OPERATOR: optional] Only needed if you want the backup to run without Fly SSH.
  > The value is the production DB credential — treat as a secret; do not paste into logs.
- **Retention:** dump uploaded as a workflow artifact (90 days). For **offsite** retention,
  the workflow has an optional, secret-gated R2 upload step (see the commented block in the
  workflow); enable it by adding `R2_*` secrets.
- **Restore-from-dump cadence:** run the restore drill (§4) at least **quarterly** and after any
  major schema migration.

---

## 4. How to restore

### 4a. Fast path — Neon PITR (recommended for recent incidents, within the 6 h / 7 d window)
1. Neon console → Project `yourcondomanager-prod` → **Branches** → **Create branch**.
2. Source = `main`, **"from a point in time"** → pick the timestamp *just before* the incident.
3. The new branch has its own endpoint. Verify the data on it (connect + spot-check).
4. To promote: repoint the app's `DATABASE_URL` (Fly secret) at the recovered branch's endpoint,
   or use Neon's "restore" to reset `main` to the branch.
   `flyctl secrets set DATABASE_URL='<recovered-branch-connection-string>' -a yourcondomanager`
- **RTO:** ~minutes (branch creation is instant; validation + repoint dominate).
- **RPO:** ~0 within the retention window (any second is selectable); bounded by the window
  (6 h now, 7 d after finding #1).

### 4b. Independent path — restore a `pg_dump` artifact (Neon-account loss, or history older than PITR)
Restore into a **scratch database** first, verify, then promote — never restore straight onto prod.
```bash
# 0. Get a dump: latest weekly artifact from Actions, or a fresh one:
pg_dump "$DIRECT_DB_URL" -Fc --no-owner --no-privileges -f ycm.dump   # DIRECT (de-pooled) endpoint

# 1. Restore into a scratch target that has pgvector (a new Neon branch/project is ideal):
pg_restore -d "$SCRATCH_DB_URL" --no-owner --no-privileges ycm.dump
# (vanilla-pg target: first run  psql -d "$SCRATCH_DB_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector;')

# 2. Verify (see §4c) BEFORE promoting.
# 3. Promote: repoint the app at the verified target.
flyctl secrets set DATABASE_URL='<verified-target-connection-string>' -a yourcondomanager
```
- **RTO:** ~minutes for this DB (~46 MB): dump ~7 s, restore <10 s, verify ~1 min.
- **RPO:** age of the newest available dump (weekly = up to 7 days; run daily/on-demand to reduce).

### 4c. Post-restore verification (always run before promoting)
```bash
DATABASE_URL="$SCRATCH_DB_URL" npm run verify:seed-integrity   # 13 FK cross-reference checks
psql "$SCRATCH_DB_URL" -c "SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated;"  # expect 0
psql "$SCRATCH_DB_URL" -c "SELECT count(*) FROM owner_ledger_entries;"   # money data present + sane
```
A reusable drill script is provided: `scripts/db/restore-drill.sh <path-to.dump>` — it stands
up a throwaway local pg17 server, restores, runs the checks, and tears down.

---

## 5. Drill evidence (executed 2026-07-03)

A live, end-to-end backup→restore was executed this session (scratch pg17 server; prod never
written to; all scratch data + credentials wiped afterward):

- **Live prod dump** (de-pooled direct endpoint, `pg_dump -Fc`): exit 0, **7 s**, ~1.0 MB, 169
  table-data sections.
- **Restore of that live dump** into a fresh pg17 scratch DB: **exit 0, zero errors**, **168
  tables**, **8,595 rows**, **322 FK constraints — 0 invalid**, `document_embeddings` (pgvector)
  restored cleanly.
- **`verify:seed-integrity` against the restored DB: 13 passed, 0 failed** (with real Cherry Hill
  association data).
- The in-repo `backup_before_switch.dump` (2026-05-26) also restored + verified independently
  (127 tables, 2,141 rows, 241 FKs valid, 0 orphaned ledger rows).

Result: **the dump→restore→verify path is proven.** The one-time "tested restore" acceptance
criterion for YCM#210 is met.

---

## 6. Verify commands (for anything you want to re-confirm)

```bash
# Neon posture (needs the neon-api-key; PID = lucky-scene-78941627):
NK=$(security find-generic-password -s neon-api-key -w)
curl -s -H "Authorization: Bearer $NK" https://console.neon.tech/api/v2/projects/lucky-scene-78941627 \
  | python3 -c "import sys,json;p=json.load(sys.stdin)['project'];print('pitr_seconds',p['history_retention_seconds'],'| plan',p['owner']['subscription_type'],'| pg',p['pg_version'])"

# App's live DB host (no creds printed):
fly ssh console -a yourcondomanager -C "node -e \"console.log(new URL(process.env.DATABASE_URL).hostname)\""
```
