# Pre-Phase-12 Observability Baseline

**Status:** TEMPLATE — awaiting real metric capture. Created Phase 5b of
Platform Overhaul per the fresh-eye amendment ("grep logs is not enough").

**Purpose:** Snapshot of production error / auth / latency rates BEFORE the
Phase 12 Financials-zone `RouteGuard` rollout. Every zone-landing PR (Phase 12
onward) compares its post-deploy metrics to this baseline as the "pre-Phase-12
baseline" column in its Q11 checklist
(`docs/projects/platform-overhaul/checklists/zone-landing-q11-checklist.md`).

**Captured by:** William (needs prod log / dashboard access)
**Date captured:** {{TBD — fill when captured}}
**Capture window:** 7 days immediately prior to the Phase 12 PR open date
**Production data cutoff:** {{ISO timestamp — fill when captured}}

---

## Metrics to capture

### 1. Error rates (from server logs)

| Metric | Daily avg | Daily peak | Notes |
|---|---|---|---|
| 401 rate per `/app/*` route | {{TBD}} | {{TBD}} | Break down by route prefix: `/app/financial/*`, `/app/operations/*`, `/app/governance/*`, `/app/communications/*`, `/app/platform/*` |
| 403 rate per `/app/*` route | {{TBD}} | {{TBD}} | Same breakdown |
| 5xx rate overall | {{TBD}} | {{TBD}} | |
| Persona-scoped auth-failure rate | {{TBD}} | {{TBD}} | Rows per role: `manager`, `board-officer`, `assisted-board`, `pm-assistant`, `viewer`, `platform-admin` (see `shared/schema.ts` adminUserRoleEnum) |

### 2. Latency (from server logs)

| Metric | p50 | p95 | Notes |
|---|---|---|---|
| Request latency per `/app/*` route | {{TBD}} | {{TBD}} | Zone breakdown as above |
| Database query latency | {{TBD}} | {{TBD}} | |

### 3. Client-side (from Sentry or equivalent)

| Metric | Value | Notes |
|---|---|---|
| Uncaught errors per route per day | {{TBD}} | Zone breakdown |
| React error boundaries triggered per day | {{TBD}} | |
| JS console error count per route per persona | {{TBD}} | Manual sample — one canonical route per zone × each persona in 0.2 map |

---

## How to capture

Needs prod log dashboard access. Tools to check (fill the list during capture):

- [ ] Server logs — {{hosting provider log console / CloudWatch / Logtail / etc.}}
- [ ] Database metrics — {{Postgres monitoring tool / provider dashboard}}
- [ ] Client error reporting — {{Sentry project / equivalent}} (if not yet configured, note as "not captured" for Gate 3)
- [ ] Any existing in-app audit log tables (2.4 Q3 platform audit log — may not exist yet; if absent, note and skip)

**Query shape (server logs, 7-day window):**

```
# Route / status code counts (adjust syntax per log tool)
fields @timestamp, http.path, http.status, session.role
| filter http.path like /^\/app\//
| stats count() by http.path, http.status, session.role, bin(1d)
```

**Query shape (latency):**

```
fields @timestamp, http.path, response.duration_ms
| filter http.path like /^\/app\//
| stats pct(response.duration_ms, 50) as p50,
        pct(response.duration_ms, 95) as p95
  by http.path
```

---

## Review gate

- **Phase 12 PR requires this doc filled before merge.** A Phase 12 PR with
  `{{TBD}}` values in this file MUST NOT merge.
- **Phase 13+ PRs** reference this doc as the "pre-Phase-12 baseline" column in
  their Q11 checklist. Any post-deploy drift beyond the tolerances listed in
  the checklist (±5% for 401/403 rate, ±10% for latency) is a revert trigger
  per 3.3 Q10.
- **Staleness:** if more than 60 days elapse between capture and a zone
  landing, recapture. Traffic patterns drift.

---

## Handoff

This doc is authored by the agent as a template. The real capture is a
**human task** on William's queue (requires prod access). Do not attempt to
fill `{{TBD}}` values from the agent side.
