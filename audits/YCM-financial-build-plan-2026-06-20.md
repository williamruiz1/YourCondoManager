# YCM Financial Build Plan — sequenced

**Date:** 2026-06-20 · **Source:** the Paddlers Cove (Clover SC) report analysis + `AUDIT-HOA-001-results.md` + `AUDIT-financial-reporting-orchestration.md`. Feeds **Project Statecraft**. Effort framing only — no calendar dates.

## The through-line
All four asks converge on **one keystone**: a **fund-aware double-entry general ledger**. It's the foundation under the income statement, the balance sheet, reserve segregation, and the amenity deposit loop — and it's the same #1 gap the platform audit flagged. Build it first; everything else sits on it. Plaid-production and the simulator are **parallel tracks** that don't wait on the GL.

---

## Track 1 — Financial core (sequential; the keystone path)

### Phase 1 — Fund-aware general ledger  · effort L · **#1 priority**
- Build `gl_accounts` + `gl_entries` with an **operating/reserve `fund` dimension** + double-entry (debits=credits) + interfund balancing.
- Replaces the dues-only ledger that today can't represent the 40+ expense accounts; kills the `reserveBalance: 0 // placeholder`.
- **Done when:** a seeded month posts to operating + reserve funds and balances to zero; reserve balance is real, not a placeholder.

### Phase 2 — Financial statements (on the GL)  · effort M
- **Budget-vs-actual** multi-year statement (per-category, operating + reserve) + a **balance sheet** (cash / AR / interfund / reserves / liabilities) — matching the Paddlers report format or better.
- **Done when:** YCM regenerates a Paddlers-equivalent budget + balance sheet from seeded data.

### Phase 3 — Amenity money loop (on the GL)  · effort M
- Add fee charge + **refundable deposit hold/refund** + ledger posting to the existing booking flow (schema has no fee/deposit columns today).
- **Done when:** a clubhouse booking charges a fee, holds + refunds a deposit, and posts to the GL as a real liability.

## Track 2 — Plaid production (parallel; ~one sprint)  · effort M
- **Before** flipping `PLAID_ENV=production`: land **webhook JWT verification** (stubbed today) + migrate to the current **`/transactions/sync`** (on deprecated `/transactions/get` now). Mostly in `plaid-provider.ts` + one migration.
- **Done when:** real bank feed syncs into reconciliation on production keys with verified webhooks. **Never go live on the unverified handler.**

## Track 3 — Switch-to-YCM simulator MVP (parallel; demand-gen)  · effort M
- Per `artifacts/switch-to-ycm-simulator/spec.md`: drop-report → analysis → Low/Likely/High savings verdict (dollar gated behind lead form) → sales CTA. Reuses YCM's **existing** ingestion + reconciliation engine.
- **Done when:** a dropped CAMS/Vantaca/CINC PDF returns flagged charges + a verdict + a captured lead.

---

## Sequence
1. **Phase 1 (GL)** — start here; unblocks Phases 2 + 3.
2. **Track 2 (Plaid)** + **Track 3 (simulator)** — start in parallel with Phase 1 (independent).
3. Phases 2 → 3 follow the GL.

## Open questions (non-blocking)
- Simulator: discount mechanics, peer-benchmark data source, lead-gate placement (3 Qs in the spec for sales).
- GL: migrate existing dues-ledger data into the new GL, or run forward-only?
