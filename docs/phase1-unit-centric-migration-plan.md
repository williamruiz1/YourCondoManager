# Phase 1 — Unit-Centric Ledger + Unique Payment Reference: Live-Data Migration Plan

> **Status:** PLAN ONLY. Nothing in this document has been run against any
> database. Cherry Hill Court (CHC) is a **live customer with real books** — this
> plan is staged, reversible, and verified precisely because a wrong move
> silently misstates what owners owe.
>
> **Companion code (already in this PR, additive + backward-compatible):**
> - Schema: `shared/schema.ts` — `units.unitAccountRef`, `units.primaryContactPersonId`, `owner_ledger_entries` semantic docs + read index.
> - DDL: `migrations/0050_unit_centric_ledger_phase1.sql` (additive columns/indexes only; **not run**).
> - Flag: `server/services/unit-centric-flag.ts` (`UNIT_CENTRIC_LEDGER` / `UNIT_CENTRIC_LEDGER_ASSOCIATIONS`).
> - Roster: `server/services/unit-payer-roster.ts` (derived from `ownerships ⋈ persons`).
> - Statement: `server/services/account-statement.ts` → `buildUnitAccountStatement`.
> - Matcher: `server/services/reconciliation/auto-matcher.ts` — Tier-0 reference pass + unit-roster any-name pass (flag-gated).
> - Stripe rail: `server/services/stripe-charge-metadata.ts` — emits `unit_account_ref`.

---

## 0. Principles (why this is safe)

1. **Additive-first, never destructive.** No `owner_ledger_entries` row is
   deleted or has its `unit_id` rewritten. Every existing row already carries a
   valid `unit_id` (`NOT NULL` today), so **the unit balance is already fully
   derivable** — the migration does not create the balance, it just exposes it.
2. **Flag-gated behavior.** Every behavior change (unit-scoped statement reads,
   Tier-0 reference matching, unit-roster matching) is gated behind
   `UNIT_CENTRIC_LEDGER_ASSOCIATIONS` (CHC-only allowlist, mirroring
   `GL_ENABLED_ASSOCIATIONS`). Flag off ⇒ byte-for-byte the pre-Phase-1 behavior.
3. **Verify before flip; block on any variance.** A read-only verification asserts
   that every unit's new unit-scoped balance equals the sum of its owners' old
   per-person balances **to the cent** BEFORE any flag flips.
4. **Rollback = flag flip.** Turning the flag off reverts statement reads +
   matcher behavior instantly. The person path is never removed, only supplemented.

---

## 1. Phases at a glance

| Phase | What moves | Reversible by | Blocks on |
|---|---|---|---|
| **A. DDL** | Add nullable `unit_account_ref` + `primary_contact_person_id` + indexes | Drop columns/indexes/constraint (see 0050 rollback block) | — |
| **B. Backfill (data)** | Assign a `unit_account_ref` to every unit; set `primary_contact_person_id` | Set the columns back to NULL | Verification 2.1 |
| **C. person_id relaxation** *(optional, deferred)* | Relax `owner_ledger_entries.person_id` NOT NULL | Re-add NOT NULL (safe while no NULL rows exist) | Verification 2.2 |
| **D. Verify** | Unit-vs-person balance equality (to the cent) | — (read-only) | — |
| **E. Flip** | Add CHC to `UNIT_CENTRIC_LEDGER_ASSOCIATIONS` | Remove CHC from the allowlist | Phase D passing |

Phases A–B are the minimum to ship the unit reference + roster + unit statement.
**Phase C is NOT required for Phase 1** and is deliberately deferred (see §5).

---

## 2. Phase A — DDL (additive)

Run `migrations/0050_unit_centric_ledger_phase1.sql` via `npm run migrate`
(and register it in `migrations/meta/_journal.json` as the next `idx`). It:

- adds `units.unit_account_ref` (nullable text),
- adds `units.primary_contact_person_id` (nullable varchar + FK `ON DELETE SET NULL`),
- adds the association-scoped partial-unique index on `unit_account_ref`
  (NULLs are distinct, so un-backfilled units never collide),
- adds the `(association_id, unit_id, posted_at)` read index on `owner_ledger_entries`.

**Verification:** `\d units` shows the two new nullable columns; `\di` shows both
new indexes; existing row counts unchanged.
**Rollback:** the commented rollback block at the foot of `0050_*.sql`.

---

## 3. Phase B — Backfill (the data step; run by an explicit script, not the DDL)

### 3.1 `unit_account_ref` backfill (idempotent, deterministic)

For every unit with `unit_account_ref IS NULL`, assign a **stable, deterministic,
human-readable** ref derived from the association slug + a zero-padded unit
ordinal, e.g. `CHC-0007`. Deterministic derivation means **re-running the
backfill is a no-op** (it produces the same ref for the same unit) — the exact
idempotency property the roadmap calls for.

- Prefix: a short association code (CHC for Cherry Hill Court) — sourced from a
  per-association config or a slug of `associations.name`, confirmed with the
  board once.
- Suffix: the unit ordinal (e.g. the unit number, zero-padded to 4 digits), or a
  monotonic per-association sequence if unit numbers aren't purely numeric.
- The partial-unique index (`units_assoc_account_ref_uq`) is the safety net: a
  duplicate ref within an association will fail the write, surfacing any
  collision instead of silently double-assigning.

**Verification 2.1:** every CHC unit has a non-null, unique `unit_account_ref`;
count of distinct refs == count of CHC units; re-running the script changes 0 rows.

### 3.2 `primary_contact_person_id` backfill

For each unit, set `primary_contact_person_id` to the current primary contact.
Default rule (matching `assembleRoster`'s fallback so app + data agree): the
**earliest-`startDate` active ownership**. Where the board has an explicit
"statement goes to X" designation, prefer that. Un-set units are harmless — the
roster derives the same fallback at read time.

**Verification:** every `primary_contact_person_id`, where set, references a
person with an ACTIVE ownership of that unit.

### 3.3 Roster

**No backfill needed** — the payer roster is *derived* from `ownerships ⋈ persons`
at read time (`loadUnitPayerRoster`), not stored. Turning the flag on makes the
roster available with zero data movement.

---

## 4. Phase D — Verification (read-only; the gate before the flip)

A read-only script (report-only, writes nothing) asserts, for CHC:

1. **Balance equality to the cent (the P0-1 acceptance test):**
   ```
   Σ(owner_ledger_entries.amount GROUP BY unit_id)
     ==
   Σ(owner_ledger_entries.amount GROUP BY person_id, re-aggregated to unit_id)
   ```
   These must be identical for every unit — because the unit balance is the sum
   of its co-owners' rows, which is exactly the person-sum re-keyed to the unit.
   Any variance ⇒ **BLOCK the flip** and investigate (it would mean a ledger row
   with a `unit_id`/`person_id` that don't agree on the unit — a data defect to
   fix first).

2. **Statement equivalence:** for each unit, the new `buildUnitAccountStatement`
   closing balance equals the sum of that unit's owners' existing
   `buildAccountStatement(personId)` closing balances, for the same period.

3. **Reference matcher dry-run (P0-3):** replay the last N months of CHC bank
   transactions through the Tier-0 reference pass in **report-only** mode and
   assert it **never contradicts an existing confirmed match** — it may only add
   a reference-tier match where there was none, never overturn a human match.

Only when 1–3 all pass may Phase E proceed.

---

## 5. Phase C — `person_id` NOT NULL relaxation (DEFERRED — NOT part of Phase 1)

The roadmap frames `person_id` becoming optional "tendered-by" metadata. In
code we implemented the **semantic** pivot (the UNIT bears the balance; reads
group by `unit_id`) **without** relaxing the column type — precisely because
flipping `owner_ledger_entries.person_id` to nullable cascades type-level `null`
into ~30 existing readers and is a real regression risk on a live system.

The **DB** relaxation (allowing a stored NULL `person_id` for a genuine
unit-level payment with no single tenderer) is therefore its own gated step:

1. Ship a code path (flag-gated) that, for a unit-level payment with no single
   payer, writes the unit's **primary-contact person** as the "tendered-by"
   value — so no NULL is needed yet and every reader stays safe.
2. Only if a true NULL-`person_id` entry is required later: relax the DB
   constraint (`ALTER TABLE owner_ledger_entries ALTER COLUMN person_id DROP NOT NULL`)
   AND, in the same change, update the Drizzle column + audit every `entry.personId`
   reader to handle `null`. This is a follow-on PR, not Phase 1.

**Reversibility of C:** re-adding `NOT NULL` succeeds as long as no NULL rows were
inserted — so gate NULL-`person_id` inserts behind the flag until C is proven.

---

## 6. Phase E — Flip

Add CHC's association id to `UNIT_CENTRIC_LEDGER_ASSOCIATIONS`. This turns on:
the unit-scoped statement preference, the Tier-0 reference matcher pass, and the
unit-roster any-name matcher pass — **for CHC only**.

**Rollback:** remove CHC from the allowlist → statement reads + matcher behavior
revert instantly to person-centric. The new columns/roster reads are inert when
the flag is off, so nothing else needs undoing.

---

## 7. Biggest risk

**The `unit_account_ref` backfill assigning a colliding or wrong reference on a
live customer's units** — because owners will start putting the ref on real
remittances, and a wrong ref would deterministically mis-route a real payment to
the wrong unit at confidence 1.0.

**Mitigations already in place:**
- The **partial-unique index** (`units_assoc_account_ref_uq`) makes a duplicate
  ref within an association a hard write failure — a collision surfaces, it never
  silently double-assigns.
- The backfill is **deterministic + idempotent** (same unit → same ref), so a
  re-run can't drift.
- The Tier-0 matcher pass is **flag-gated** and validated by a **report-only
  replay** (Phase D.3) against historical CHC transactions BEFORE it auto-applies
  — it must never contradict an existing human match.
- The ref amount fence (±$1) prevents a ref from binding a wildly-wrong amount.

**Residual owner decision (see §8).**

---

## 8. Open — needs William's decision

1. **`unit_account_ref` format for CHC** — confirm the prefix (`CHC-`) and the
   suffix scheme (unit-number-padded vs a fresh per-association sequence). This
   is the code that owners will physically write on checks, so the board should
   sign off on the human-readable format before backfill.
2. **When owners are told to start using the ref** — the reference only helps
   once it's on remittances. Sequencing the owner-communication (coupon line on
   the statement + Stripe metadata) is an ops decision, not a code one.
3. **Whether to pursue Phase C** (DB `person_id` relaxation) at all for Phase 1,
   or keep the primary-contact-as-tendered-by approach indefinitely (recommended:
   keep it; Phase C is only worth it if a real NULL-payer case appears).
