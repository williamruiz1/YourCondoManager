# CHC Money-Loop End-to-End Verification Run — 2026-07-03

**Dispatch:** founder-os#8534 — *VERIFY — YCM end-to-end money loop on Cherry Hill ledger (sandbox rail, documented run)*
**Anchor:** YCM#204 (readiness P0-1) · **Repo HEAD:** `027cd85` (main, 2026-07-03)
**Run by:** founder-os fleet worker (worktree `YourCondoManager-w534`)
**Verification method:** executed the money-loop **test suite** (real assertions, real code paths) + the PR#300 test-mode harness safety guard. Per OP #61/outcome-over-proxy, nothing below is a "should work" claim — every ✅ line cites an executed test result; every ⛔ line names the exact credential/infra that blocks it.

---

## TL;DR (per-gate verdict)

| Gate | Name | Loop leg | Logic verdict (executed tests) | On-real-CHC-hosted-ledger run |
|---|---|---|---|---|
| **A.6** | $1 test charge — ACH end-to-end + reconciles | pay (ACH) → reconcile | ✅ **VERIFIED** (routing + reconcile-to-cent) | ⛔ **BLOCKED** — needs `sk_test_` key + hosted app |
| **A.7** | $1 test charge — card end-to-end + reconciles | pay (card) → reconcile | ✅ **VERIFIED** (Connect routing + app-fee math + reconcile) | ⛔ **BLOCKED** — needs `sk_test_` key + hosted app |
| **A.8** | First real owner pays driveway-assessment via ACH | real ACH pay → ledger | ⚠️ **DEFECT** — gate mislabeled `auto` w/ no autoCheck | ⛔ **BLOCKED** — needs W-3 (live mode) + real owner action |
| **B.2** | Owner portal shows correct balance per owner | assessment → balance | ✅ **VERIFIED to the cent** (CHC $21,607.78, 0¢ diff) | ⛔ **BLOCKED** — autoCheck needs hosted `DATABASE_URL` |
| **B.3** | Owner can log in + see ledger + pay | balance → pay | ✅ **VERIFIED** (ledger + apply-payment paths) | ⛔ **BLOCKED** — manual login needs hosted app + test owner |

**Bottom line:** the money-loop **implementation is proven correct** — ~309 assertions across 24 test files pass, including CHC reconcile-to-the-cent, all edge legs, and the CHC 18-unit schedule expansion. The **documented run on the live hosted CHC ledger** (the literal A.6/A.7/A.8/B.2/B.3 sign-off) **cannot be produced from a headless fleet worker**: it requires two things this environment does not hold — a Stripe **`sk_test_`** key (only `sk_live_` keys are in the keychain, and the PR#300 harness correctly hard-refuses live keys) and the **hosted CHC `DATABASE_URL`** (no local Postgres; the 18-unit ledger lives in the deploy DB). See §Blockers.

---

## Isolation approach (per dispatch req 4)

- **No real balances mutated.** Verification ran against the test suite (vitest, in-memory / fixture data), never against the production CHC ledger.
- **No live Stripe activity.** The PR#300 harness `scripts/validate-connect-dues-routing.cjs` hard-refuses any non-`sk_test_` key. I demonstrated the guard fires (below); it makes **zero** network calls when handed an empty or `sk_live_` key.
- **Isolated worktree** (`YourCondoManager-w534`), fresh `npm ci` (783 pkgs), branch `verify/8534-money-loop-e2e`.

---

## Executed evidence

### 1. Money-loop test suite — 24 files, ~309 assertions, 0 logic failures

Command (two batches, `npx vitest run <files>`):

```
Batch A (13 files): 177 passed / 178  (1 flake — see below)
Batch B (12 files): 132 passed / 133  (same flake, re-run)
```

Files exercised (each is a real money-loop code path):

| Leg | Test file | Result |
|---|---|---|
| **Assessment → ledger (CHC)** | `tests/recurring-dues-cherry-hill.test.ts` | ✅ expands the association-wide schedule into **18 (schedule, unit) tuples**, `$280` payload per active-ownership unit, backfill idempotent across 3 rapid re-runs |
| **Balance (CHC, to the cent)** | `server/services/__tests__/gl-reconcile-chc.test.ts` | ✅ parses **19 live CHC seed entries** (13 assessments + 6 charges); owner-ledger reconciled balance **= $21,607.78** (matches live seed); parallel GL reproduces it **EXACTLY (diff = 0¢)**; a payment reduces AR to the cent |
| **Edge legs** | `tests/payment-edge-cases.test.ts` | ✅ PARTIAL (`$100/$300` → `$200` left; sequence never overshoots), EXACT (`→ 0`), OVERPAYMENT (`$350/$300` → `−$50` credit, carries forward), REFUND/reversal (forward-only, original never mutated), input guards (zero/negative/NaN rejected), cent-precision (no float drift) |
| **Late-fee assessment** | `tests/late-fee-assessment.test.ts` | ✅ 17/18 late-fee logic assertions (1 flake, see below) |
| **Pay routing (Connect)** | `server/services/__tests__/stripe-connect-resolver.test.ts`, `stripe-connect.test.ts`, `payment-setup-connect.test.ts`, `server/routes/__tests__/stripe-connect.test.ts` | ✅ direct-charge-on-HOA routing + `application_fee_amount` to platform |
| **Charge metadata / app-fee math** | `server/services/__tests__/stripe-charge-metadata.test.ts` | ✅ fee = `round(amount·1%)`, floor `$0.50`, ceil `$25`, never > amount |
| **Reconcile / matching** | `server/services/__tests__/stripe-reconciliation.test.ts`, `tests/reconciliation-auto-matcher.test.ts`, `gl-runtime-sync.test.ts` | ✅ payment ↔ ledger auto-match |
| **Webhook ack / idempotency** | `server/routes/__tests__/webhook-payments-ack.test.ts`, `server/services/__tests__/stripe-idempotency.test.ts` | ✅ |
| **GL posting / statements** | `gl-dues-to-statements.test.ts`, `gl-posting-invariants.test.ts`, `gl-statements.test.ts`, `gl-income-split-and-expense.test.ts`, `gl-amenity-money-loop.test.ts` | ✅ |
| **Admin / delinquency / assessment exec** | `server/routes/__tests__/admin-payments.test.ts`, `server/alerts/__tests__/delinquent-ledger-balances.test.ts`, `tests/assessment-execution.test.ts`, `usage-reconcile.test.ts` | ✅ |
| **Go-live gate registry** | `server/__tests__/go-live-checks.test.ts` | ✅ registry contract |

**The one non-pass — confirmed a flake (OP #62 discriminating test):**
`late-fee-assessment.test.ts > "has \"late-fee\" in the registered rule types"` timed out on a dynamic `await import()` in both batches (5s and 30s), under extreme concurrent load (`import 1657s` cumulative in the batch-B run). Run **in isolation** with headroom: **PASSES** (`1 passed`). Verdict: infra import-timeout flake, **not** a money-loop logic defect. The other 17 tests in that same file (the actual late-fee computation) pass.

### 2. PR#300 harness sandbox-safety guard — executed, fires correctly

```
$ node scripts/validate-connect-dues-routing.cjs
REFUSING: STRIPE_TEST_SECRET_KEY must be a TEST key (sk_test_...). Got: (empty)   [exit 2]

$ STRIPE_TEST_SECRET_KEY=sk_live_SYNTHETIC_NOTREAL node scripts/validate-connect-dues-routing.cjs
REFUSING: STRIPE_TEST_SECRET_KEY must be a TEST key (sk_test_...). Got: sk_live_   [exit 2]
```

The harness is **present, correct, and safe by construction** — it will never charge on the live rail. It is ready to produce the A.6/A.7 evidence the moment a `sk_test_` key is provided.

---

## Blockers (why the on-real-ledger run could not be produced here)

These are genuine external/infra gates, not self-authored constraints — the harness's live-key refusal is a *correct* safety guard (removing it to run on live would be the catastrophic anti-pattern), and a Stripe test key is dashboard-minted, not derivable from a live key.

| # | Blocker | Blocks gates | Exact unblock |
|---|---|---|---|
| **1** | No Stripe **`sk_test_`** key. Keychain holds only `sk_live_` / `rk_live_` / `pk_live_`. | A.6, A.7 | Mint a Stripe **test-mode** secret key (Stripe dashboard → test mode → API keys) and store it: `security add-generic-password -a $USER -s ycm-stripe-test-secret -w 'sk_test_...'`. Then: `STRIPE_TEST_SECRET_KEY=$(security find-generic-password -s ycm-stripe-test-secret -w) node scripts/validate-connect-dues-routing.cjs` |
| **2** | No hosted CHC **`DATABASE_URL`** + no running app instance. The 18-unit ledger lives in the deploy DB; no local Postgres. | A.8, B.2 (autoCheck), B.3 (manual) | Run the DB-state gate engine against the hosted CHC DB: `DATABASE_URL=<hosted CHC url> tsx -e "import('./server/services/go-live-checks').then(m => m.computeReadinessSnapshot('<CHC association id>').then(s => console.log(JSON.stringify(s,null,2))))"` — from the deploy env (or with a read replica). |

Both are held by William / the deploy environment. This dispatch produced everything achievable **without** them.

---

## Defects filed

1. **[YCM#370] (medium)** — A.8 (+ A.1, A.3, B.4, C.2, D.2, D.3, D.4, E.2, F.4) declared `verifyMethod:"auto"` with no `autoCheck` wired (`server/services/go-live-checks.ts`). These render as "pending" forever and are indistinguishable from manual gates in `computeReadinessSnapshot`, contradicting the 🤖 "auto" label. **A.8 is a HARD tier-A money-loop gate that can therefore never auto-pass.**
2. **[YCM#371] (high)** — the go-live money-loop verification is un-runnable from a headless worker: the PR#300 harness needs `sk_test_` (only live keys present) and the DB-state gates need the hosted `DATABASE_URL`. This infra/credential gap blocks A.6/A.7/A.8/B.2/B.3 on the real ledger. Filed with the two unblock recipes above.

---

## YCM#204 disposition

**Narrowed, not closed.** The money-loop *logic* is verified (this report). The remaining residue that keeps #204 open:
- A.6/A.7: run the PR#300 harness once a `sk_test_` key exists (blocker #1).
- A.8/B.2/B.3: run against the hosted CHC ledger (blocker #2) — A.8 additionally gated on W-3 (Stripe live mode) + a real owner ACH payment.
