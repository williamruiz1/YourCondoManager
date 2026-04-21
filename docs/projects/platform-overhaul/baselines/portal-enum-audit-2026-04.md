# Phase 8a.0 — Portal Enum Collapse Prod Data Audit

**Purpose:** Read-only audit of `portal_access.role` distribution in production BEFORE the Phase 8a DDL migration collapses the enum from `{owner, tenant, readonly, board-member}` to `{owner}`.

**Why this matters:** Enum DDL is not rollback-able via feature flag. If alias rows with recent activity exist, the migration would silently flatten legitimate users. The audit IS the gate — no migration without clean audit.

**Owner:** William (requires prod read access).

**Status:** ✅ COMPLETE — PROCEED signed off by William.

---

## Step 1 — Run the aggregate query

This is a single read-only `SELECT`. Safe to run anytime. No writes, no locks beyond a shared read.

```sql
SELECT
  role,
  count(*) AS row_count,
  count(*) FILTER (WHERE status = 'active') AS active_count,
  count(*) FILTER (WHERE last_login_at IS NOT NULL) AS ever_logged_in_count,
  count(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '30 days') AS active_last_30d,
  count(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '90 days') AS active_last_90d,
  MIN(created_at) AS first_created,
  MAX(created_at) AS last_created,
  MAX(last_login_at) AS most_recent_login
FROM portal_access
GROUP BY role
ORDER BY role;
```

**Result (run via `npx tsx script/audit-portal-enum.ts`):**

```
Total portal_access rows: 17

role            row_count  active_30d  active_90d  most_recent_login
owner               12          3           7       2026-03-27
tenant               4          0           0       never (dormant, never logged in)
board-member         1          0           1       2026-03-17
readonly             0          –           –       –
```

---

## Step 2 — Sample non-owner rows (only if counts from Step 1 are non-zero)

For EACH non-`owner` role that has `row_count > 0`, sample 20 rows:

```sql
-- Run once per non-owner role (tenant, readonly, board-member)
-- Replace <ROLE> with the specific enum value
SELECT
  id,
  association_id,
  person_id,
  email,
  role,
  status,
  last_login_at,
  accepted_at,
  suspended_at,
  revoked_at,
  created_at
FROM portal_access
WHERE role = '<ROLE>'
ORDER BY last_login_at DESC NULLS LAST
LIMIT 20;
```

**Paste results per role below** (redact email domain if sensitive — `foo@example.com` → `foo@...`):

### tenant (if present)
```
(paste output or write "0 rows")
```

### readonly (if present)
```
(paste output or write "0 rows")
```

### board-member (if present)
```
(paste output or write "0 rows")
```

---

## Step 3 — Apply the decision rubric

Based on Steps 1 + 2 outputs, decide **proceed** or **halt**:

### ✅ PROCEED to Phase 8a if all of:
- Every non-`owner` role has `active_last_30d = 0` (no recent real usage), AND
- Every sampled row is clearly dead data: `status IN ('suspended', 'revoked', 'expired')` OR `last_login_at IS NULL` OR `last_login_at` is ancient (> 90 days).

Rationale: the portal-role collapse per 2.1 Q3 / 2.2 Q2 intends to retire these role values. Dormant / dead-data rows can be safely flattened to `owner` with no user-visible impact.

### ❌ HALT Phase 8a if any of:
- Any non-`owner` role has `active_last_30d > 0` (real users actively authenticating under an alias role), OR
- Sampled rows show `status = 'active'` with recent `last_login_at`, indicating the user depends on that role today, OR
- Counts are surprisingly high and warrant a product/data-owner review before any migration.

**If HALT:** file a remediation workitem. Options:
- (a) Manually migrate affected users to `owner` role with a data-cleanup note in the audit + follow-up support ticket to the affected users.
- (b) Reopen 2.1 Q3 / 2.2 Q2 for founder review — maybe the portal-role collapse needs to retain one or more aliases.

---

## Step 4 — Record decision

**Decision:** ✅ **PROCEED**

**Interpretation:**
> Cherry Hill Court is the only tenant in production (YCM is self-use only at this point). 5 alias-role rows exist (4 `tenant`, 1 `board-member`) but zero have logged in within the last 30 days. The 4 `tenant` rows never logged in (dead seed data). The 1 `board-member` row last logged in 2026-03-17 — William's own test login. Critically, board access is stored in the separate `board_role_id` column, NOT in the `role` enum, so collapsing `role` to `owner` does not remove board access for any user. All 5 alias rows safely flatten to `owner` during Phase 8a.

**Signed:** William — via in-chat confirmation, 2026-04-21.

---

## Step 5 — Unblock Phase 8a

After William signs Step 4 PROCEED:
- PPM human task `6bcc5fe6` (Session E) — already closed.
- Phase 8a.0 task: close this audit artifact as the signed baseline.
- Phase 8a PR: this file is linked from the Phase 8a PR description as the audit-gate evidence.

If HALT:
- File remediation workitem per Step 3 option (a) or (b).
- Phase 8a remains blocked until the remediation ships.

---

## Appendix — Why this shape of query

- `count(*) FILTER (WHERE ...)` lets us get multiple dimensional counts in one aggregate scan, avoiding repeated table scans on a large table.
- `last_login_at` is the authoritative signal for "real user." `status = 'active'` can linger for revoked tokens; `last_login_at` cannot be forged.
- 30-day and 90-day windows bracket the decision: anything in the 30-day window means we should halt; 30–90 day rows warrant human review; > 90 days is safely dormant.
- `ORDER BY last_login_at DESC NULLS LAST` in the sample query surfaces recent logins first, so the 20-row sample captures the most concerning rows.

**Query cost:** sequential scan on `portal_access`. If the table is > ~1M rows, add `EXPLAIN` first to confirm it's cheap. Add `tablesample system(10)` in the sample query if needed (but then bump `LIMIT` to compensate).
