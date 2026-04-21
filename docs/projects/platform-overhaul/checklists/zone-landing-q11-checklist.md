# Zone Landing Q11 Observability Checklist

**Template** — created Phase 5b of Platform Overhaul per 3.3 Q11 AC-Q11-1 / AC-Q11-2.
Each zone landing PR (Phase 12 Financials → Phase 13 Operations → Phase 14
Governance → Phase 15 Communications → Phase 16 Platform) copies this file into
the PR and fills it in before merge. Any failing row triggers the 3.3 Q10
revert procedure (AC-Q11-3).

**Zone:** {{Financials / Operations / Governance / Communications / Platform}}
**PR:** {{link to GitHub PR}}
**Filled by:** {{name}}
**Date:** {{YYYY-MM-DD}}

---

## Pre-deploy checks

- [ ] Baseline comparison reviewed (pre-Phase-12 baseline at
      `docs/projects/platform-overhaul/baselines/pre-phase-12-baseline.md`)
- [ ] Parity harness green:
      - [ ] Tier 1 exhaustive (all routes × all personas)
      - [ ] Tier 2 happy-path
      - [ ] Tier 3 sidebar visibility
- [ ] Feature flags verified:
      - [ ] `PORTAL_ROLE_COLLAPSE` state documented ({{on/off for this zone}})
      - [ ] `BOARD_SHUNT_ACTIVE` state documented ({{on/off for this zone}})
- [ ] RouteGuard wraps confirmed for every route in this zone
      (grep `<RouteGuard` against 3.2 canonical route table for the zone)
- [ ] Persona matrix from 0.2 reviewed against this zone's 3.3 resolution

## Post-deploy metrics (compared to baseline) — AC-Q11-1 three gates

### Gate 1 — Zero 401/403 on permitted routes
- [ ] 401 rate per route in zone: **zero** on routes permitted for each persona
- [ ] 403 rate per route in zone: **zero** on routes permitted for each persona
- [ ] Overall 401/403 rate: within baseline ±5%

### Gate 2 — Zero unguarded access on blocked routes
- [ ] Each non-permitted persona attempted direct URL navigation to every
      route in the zone; confirmed redirect or `<NotFound>` rendered
- [ ] Server-side probe: direct API calls to zone endpoints with non-permitted
      personas returned 403
- [ ] Persona-scoped auth-failure rate: within baseline (per-role)

### Gate 3 — No increase in JS console errors
- [ ] Pre-deploy console error baseline recorded on one route per zone × each persona
- [ ] Post-deploy traversal repeated; **zero net-new console errors**
- [ ] 5xx rate overall: within baseline
- [ ] React error boundaries triggered: within baseline
- [ ] Latency p50/p95 on wrapped routes: within baseline ±10%

## Persona smoke tests (manual) — per 0.2 persona map

- [ ] Manager: full zone access
- [ ] Board Officer: zone access per 0.2 matrix for this zone
- [ ] Assisted Board: `SUBSET-RENDER` applied correctly (no forbidden items render)
- [ ] PM Assistant: toggle-scoped access per 3.3 + sidebar persona toggles
- [ ] Viewer: read-only variant — no mutation UI visible / no mutation endpoints reachable
- [ ] Platform Admin: **NOT visible** in this zone (unless this IS the Platform zone)

## Rollback readiness — AC-Q11-3 ties to 3.3 Q10

- [ ] Revert PR identified / SHA ready: {{commit SHA}}
- [ ] Rollback runbook: points to 3.3 Q10 revert procedure
- [ ] Downstream dependency declared: next zone's landing PR cannot merge until
      this zone's gates pass (3.3 AC-Q5-3)

## Post-merge PR comment — AC-Q11-2

Paste the filled three-gate result as a comment on the merged PR. Template:

```
## Q11 post-deploy gate results — {{Zone}}
- Gate 1 (zero 401/403 on permitted): PASS / FAIL
- Gate 2 (zero unguarded access on blocked): PASS / FAIL
- Gate 3 (no net-new console errors): PASS / FAIL

Baseline comparison: {{within ±5% / outliers noted below}}
Action: {{proceed to next zone | rollback per 3.3 Q10}}
```

---

**Governance:** Two or more consecutive zone failures triggers a full pause per
3.3 Q10 AC-Q10-4. File a human task and halt subsequent zone PRs.
