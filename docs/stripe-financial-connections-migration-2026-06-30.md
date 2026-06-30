# Stripe Financial Connections (FC) — bank-feed migration (2026-06-30)

**What this is:** a drop-in, READ-ONLY bank-transaction feed for **reconciling the
HOA books**, as an alternative to Plaid. It replaces Plaid's role *only* for the
reconciliation feed.

**What this is NOT:** dues collection. Dues collection is **Stripe Connect**, which
is already live and is **untouched** by this work.

**Status:** built, `tsc`-clean, unit-test-validated against a mocked Stripe API.
**Not deployed, not merged** — DRAFT PR pending William's ratification of the vendor
pivot. Plaid remains the default until the flag is flipped.

---

## Why Stripe FC

Plaid production is blocked on Chase: Plaid **requires its Security Questionnaire**
to unlock Chase for pay-as-you-go accounts (a hard structural gate, ~1+ week
review). YCM is already a Stripe platform on Connect, so Stripe Financial
Connections is:

- **Same vendor, same keys, same dashboard** — uses the existing
  `PLATFORM_STRIPE_SECRET_KEY` / `PLATFORM_STRIPE_PUBLISHABLE_KEY`. No separate
  diligence/questionnaire.
- **Pay-as-you-go** — ~30¢/account/mo + ~10¢/balance call.
- **Read-only** — balances + transactions permissions only. No `payment_method`
  permission is ever requested, so the feed can never move money.
- **Chase via OAuth** — the hosted FC modal runs the bank's OAuth inline.

---

## The flag

`STRIPE_FINANCIAL_CONNECTIONS_ENABLED` — **default OFF.**

- Accepts `1` / `true` / `yes` / `on` (case-insensitive). Anything else (incl.
  unset) → **OFF → Plaid** (unchanged behavior).
- Read in `server/services/bank-feed/stripe-fc-env-guard.ts`
  (`isStripeFinancialConnectionsEnabled()`).
- The bank-feed singleton (`server/services/bank-feed/index.ts`) selects the
  provider from this flag at module load. Flipping the flag is a process restart
  (a Fly secret + redeploy), matching how `PLAID_ENV` is operated.

Because every consumer (the `/api/plaid/*` routes, the 5-min sync engine
`bank-feed-sync.ts`, and the reconciliation auto-matcher) depends only on the
provider-agnostic `BankFeedProvider` interface, the switch is **invisible** to
them — the downstream reconciliation logic runs unchanged regardless of vendor.

---

## How to flip from Plaid to FC

1. Ensure the platform Stripe **test** keys are set (they already are for Connect):
   - `PLATFORM_STRIPE_SECRET_KEY` = `sk_test_…`
   - `PLATFORM_STRIPE_PUBLISHABLE_KEY` = `pk_test_…`
2. **The one manual step (live mode only):** in the **Stripe Dashboard →
   Settings → Financial Connections**, register/enable Financial Connections for
   the platform account. **FC test data is available without this** — you can
   build + validate entirely in test mode; the registration is only required to
   pull *live* bank data. (This is the equivalent of Plaid's Security
   Questionnaire, but it is a self-serve dashboard toggle, not a multi-day
   review.)
3. For **production**, set `STRIPE_FC_WEBHOOK_SECRET` (`whsec_…`) — the boot
   guard refuses to start in production with the flag ON and no webhook secret
   (so an unverified webhook handler can never accept forged bank transactions).
   Point a Stripe webhook endpoint at `POST /api/webhooks/stripe-fc` subscribed
   to the FC events listed below.
4. Set `STRIPE_FINANCIAL_CONNECTIONS_ENABLED=1` and redeploy. New bank
   connections are now created via FC; rows are tagged `provider="stripe_fc"`.
   Existing Plaid connections keep working through the same interface (they are
   `provider="plaid"`), but **a Plaid access token cannot be read by the FC
   provider** — to use FC, the HOA re-links its bank via the Connect Bank
   Account button (now the FC hosted flow). Re-linking is idempotent at the
   account level (`bank_accounts.provider_account_id` upsert).
5. To revert: set the flag back OFF and redeploy. Plaid is the provider again.

---

## Plaid → Stripe FC endpoint mapping

The `BankFeedProvider` interface (`server/services/bank-feed/provider.ts`) is the
contract. Both providers implement it; the table shows how each interface method
maps to each vendor's API.

| `BankFeedProvider` method | Plaid (existing) | Stripe FC (new) |
|---|---|---|
| `createLinkToken(assoc,user)` | `POST /link/token/create` → `link_token` | `POST /v1/financial_connections/sessions` (permissions `balances`,`transactions`; `account_holder[type]=customer`) → returns the session **`client_secret`** as `linkToken` |
| *(client collection)* | `react-plaid-link` `usePlaidLink({token})` | Stripe.js `stripe.collectFinancialConnectionsAccounts({clientSecret})` (lazy-loaded; `client/src/lib/stripe-fc-link.ts`) |
| `exchangePublicToken(x)` | `POST /item/public_token/exchange` (x = `public_token`) → `access_token`,`item_id` | `GET /v1/financial_connections/sessions/{id}` (x = **session id**), then `POST …/accounts/{id}/subscribe?features[]=transactions` per account → synthesizes an opaque access blob `{customerId,accountIds,sessionId}`; `itemId` = session id |
| `getAccounts(token)` | `POST /accounts/get` | per account: `POST …/accounts/{id}/refresh?features[]=balance` then `GET …/accounts/{id}` |
| `syncTransactions(token,cursor)` | `POST /transactions/sync` (Plaid cursor) | per account: `GET /v1/financial_connections/transactions?account={id}&transaction_refresh[after]={refreshId}` (returns txns **added OR updated** since the saved refresh), then `GET …/accounts/{id}` to read the new `transaction_refresh.id`; cursor = JSON map `{accountId: transactionRefreshId}` |
| `getTransactions(token,since)` *(deprecated)* | `POST /transactions/get` | full per-account list (no cursor) |
| `verifyWebhook(headers,body)` | Plaid JWT (JWS/ES256) | Stripe `Stripe-Signature` HMAC-SHA256 over `t.body` + 5-min replay window |
| `removeConnection(token)` | `POST /item/remove` | per account: `POST …/accounts/{id}/disconnect` |

### Webhook event mapping

| Plaid webhook | Stripe FC event | Mapped `WebhookEvent` |
|---|---|---|
| `TRANSACTIONS` / `SYNC_UPDATES_AVAILABLE` | `financial_connections.account.refreshed_transactions` | `TRANSACTIONS` / `SYNC_UPDATES_AVAILABLE` |
| `ITEM` / `USER_PERMISSION_REVOKED` | `financial_connections.account.disconnected` | `ITEM` / `USER_PERMISSION_REVOKED` |

- Plaid webhooks hit `POST /api/webhooks/plaid`; FC webhooks hit
  `POST /api/webhooks/stripe-fc`.
- **Resolution difference:** Plaid events carry the `item_id`
  (`bank_connections.provider_item_id`). FC events carry the FC **account** id,
  so the FC webhook route resolves `account → bank_accounts → bankConnectionId`
  and syncs that connection. If the account isn't found, the **5-min sweep** is
  the backstop (same dropped-event recovery guarantee as Plaid).

### Data-model mapping (→ `bank_transactions` / `bank_accounts`)

The FC provider maps into the **same** snapshot shapes the reconciler already
consumes (`server/services/bank-feed/stripe-fc-provider.ts`):

- **Amount sign (load-bearing):** the reconciler + the Plaid mapping use
  `amountCents` where **positive = money OUT (debit)**, negative = money IN
  (credit). Stripe FC uses the **opposite** (positive = money IN), so the FC
  provider **negates** the amount. This keeps the downstream auto-matcher
  unchanged.
- **`type`:** FC `category` `cash` → `depository` (matches Plaid's `type`), `credit`
  → `credit`, `investment` → `investment`, else `other`. `subtype` ← FC `subcategory`.
- **Balance:** FC's single balance is surfaced as both `currentBalanceCents` and
  `availableBalanceCents` (FC doesn't split them the way Plaid does).
- **`date`:** FC `transacted_at` (unix seconds) → ISO `YYYY-MM-DD`.
- **`pending` + status lifecycle (corrected 2026-06-30, fc-golive):** FC
  transaction **ids are STABLE** across `pending → posted → void` (Stripe's
  "Access transactions" guide: save + merge by id). `syncTransactions` therefore
  uses the `transaction_refresh[after]` cursor, which returns every txn **added
  OR updated** since the last sync — so a `pending` txn that posts re-appears
  under its **same id** in `added` and the sync engine's upsert flips its
  `pending` flag 1→0 in place. A **voided** txn (`status === "void"` or a
  populated `status_transitions.void_at`) is routed to `removed` so a phantom
  deposit leaves the books (the sync engine deletes it association-scoped, and
  preserves it if it was already matched to a ledger entry). **This replaced the
  draft's `starting_after={lastTxnId}` paging, which silently MISSED status
  updates** (a posted txn kept its id and never re-appeared past the cursor →
  the row stayed `pending=1` forever and voids never left the books — corrupting
  the reconciliation report's deposit totals + the statements).
- **Storage:** `bank_connections.provider` = `"stripe_fc"`;
  `provider_item_id` = the FC session id; `access_token_encrypted` = the
  encrypted opaque blob `{customerId,accountIds,sessionId}` (no Stripe credential
  in it); `transactions_cursor` = the per-account cursor JSON
  `{accountId: transactionRefreshId}`.

### Statements / reconciliation render-correctness (William's go-live concern)

The bank feed reaches the owner/admin financial surfaces in **exactly two**
places — both provider-agnostic, both proven correct under FC:

1. **Reconciliation (report + auto-matcher)** reads `bank_transactions`. It keys
   on the sign convention (`amountCents < 0` = a credit / owner deposit). FC's
   negation makes an FC inflow land as a negative `amountCents`, so an owner FC
   deposit auto-matches its dues ledger entry and the report's "Total bank
   deposits" sums correctly — verified in
   `__tests__/stripe-fc-statements-rendering.test.ts`.
2. **Chart of Accounts** (`/app/financial/foundation`) reads
   `financial_accounts.current_balance_cents`, fed by the COA bridge from
   `getAccounts` balances. FC balances are read as positive cents (no negation),
   so the COA balance renders correctly.

The **GL financial statements** (balance sheet / budget-vs-actual,
`server/services/gl/statements-service.ts`) are derived from the GL journals +
budgets + vendor invoices — they do **NOT** read the bank feed at all, so the
provider switch does not touch them. *Net: switching to FC changes the feed's
source, not the shape any statement consumes.*

---

## Files

**New**
- `server/services/bank-feed/stripe-fc-provider.ts` — the FC `BankFeedProvider`.
- `server/services/bank-feed/stripe-fc-env-guard.ts` — the flag + production boot guard.
- `client/src/lib/stripe-fc-link.ts` — the client FC collection flow (lazy Stripe.js).
- `server/services/bank-feed/__tests__/stripe-fc-provider.test.ts` — provider unit tests.
- `server/services/bank-feed/__tests__/stripe-fc-flag-routing.test.ts` — flag/guard tests.

**Changed**
- `server/services/bank-feed/index.ts` — flag-switched provider singleton.
- `server/routes.ts` — `GET /api/bank-feed/provider`, `POST /api/webhooks/stripe-fc`,
  flag-aware `provider` tag on the stored connection.
- `client/src/pages/financial-bank-connections.tsx` — provider-aware Connect button.
- `server/index.ts` — `assertStripeFcEnvSafe()` boot guard.
- `.env.example` — the new flag + FC config.

---

## Validation status

- **`tsc` clean** (exit 0) across the whole project.
- **Unit tests: 20 new, all green** — session-create shape (read-only perms, no
  `payment_method`), exchange/subscribe, balance + transaction mapping (incl. the
  sign negation), the per-account cursor contract + pagination, webhook signature
  verification + event mapping, `removeConnection`, and flag on/off provider
  routing + the production env guard.
- **No regression** — the existing Plaid/bank-feed suite (44 tests) is green; the
  full server suite passes (the only 2 failures are pre-existing
  `DATABASE_URL must be set` env failures in unrelated files I did not touch).
- **PENDING:** a live exercise against Stripe **test mode** — no Stripe test key
  was reachable in the build env (no `STRIPE_*` env; the secrets store needs
  `DATABASE_URL`, which is absent). The flow is fully exercised against a mocked
  Stripe; the live test-mode pass and the one-time Dashboard FC registration
  remain to be done in an environment with the platform Stripe test key.

### `fc-golive` follow-on (PR #309 → ready-for-review)

- **Fixed the FC sync cursor** to use `transaction_refresh[after]` (stable-id
  upsert + void→`removed`) instead of `starting_after` paging — see the corrected
  data-model mapping above. This is the statements/reconciliation render-correctness
  fix.
- **Added 2 provider tests** (void→removed; pending→posted re-emit on upsert) →
  `stripe-fc-provider.test.ts` now **22** green.
- **Added** `stripe-fc-statements-rendering.test.ts` (**7** tests) — proves an FC
  feed renders correct deposits, auto-matches owner payments, and renders correct
  COA balances through the **real** reconciliation + bridge code.
- `tsc` clean; bank-feed + reconciliation + Plaid + GL-statements + COA-bridge
  suites all green (no regression).

---

## Go-live checklist (ordered) — WILLIAM vs AUTOMATION

> Do NOT run the production steps until William completes step 1. Plaid stays the
> default the entire time the flag is OFF; the switch is fully reversible (step 7).

| # | Step | Owner |
|---|---|---|
| 1 | **Stripe Dashboard → Settings → Financial Connections → complete LIVE-mode registration/enablement** for the platform account. Required before any *live* FC bank-data call works (FC test data works without it). This is the FC equivalent of Plaid's Security Questionnaire — a self-serve toggle, not a multi-day review. | **WILLIAM** (his Stripe account / dashboard action) |
| 2 | Set the production **`STRIPE_FC_WEBHOOK_SECRET`** (`whsec_…`) as a Fly secret, and create a Stripe webhook endpoint → `POST /api/webhooks/stripe-fc` subscribed to `financial_connections.account.refreshed_transactions` + `financial_connections.account.disconnected`. (The prod boot guard refuses to start with the flag ON and no webhook secret.) | **WILLIAM** must create the webhook endpoint + reveal the `whsec_…` in his Stripe dashboard; **automation** sets the Fly secret once William provides it |
| 3 | **Mark PR #309 ready-for-review** (`gh pr ready 309`) and review. | automation (done in this pass) → William/reviewer approves |
| 4 | **Merge PR #309** to `main`. (Fly auto-deploys `main`.) | automation, **after** William's approval |
| 5 | **Set `STRIPE_FINANCIAL_CONNECTIONS_ENABLED=1`** in prod (`flyctl secrets set …`) → redeploy. | automation, coordinated **after** steps 1–2 |
| 6 | **Verify live:** an HOA re-links its bank via the Connect Bank Account button (now the FC hosted flow); confirm `GET /api/bank-feed/provider` reports `stripe_fc`; run a manual Sync-Now; confirm transactions land in `bank_transactions`, the reconciliation report's deposit total is correct, and the linked balance shows on `/app/financial/foundation`. | automation verifies + reports; **William** does the in-app bank re-link (his credentials) |
| 7 | **Rollback (if needed):** set `STRIPE_FINANCIAL_CONNECTIONS_ENABLED=0` → redeploy. Plaid resumes immediately; existing Plaid connections were never touched. | automation |

**Note on existing connections:** a Plaid `access_token` cannot be read by the FC
provider. To move an HOA onto FC, that HOA **re-links** its bank once via the
Connect Bank Account button (now the FC flow). Re-linking is idempotent at the
account level. Until re-linked, an HOA's old Plaid connection simply stops
syncing under FC (it's a different provider) — so re-link is part of the per-HOA
cutover, not an automatic migration.

---

## Does FC scale to PROPERTY MANAGERS / multiple HOAs?

**Yes — the architecture already supports it, with one operational caveat.**

- **Per-HOA isolation is built in.** `bank_connections` (and `bank_accounts`,
  `bank_transactions`) carry `association_id` — one bank link per HOA. The FC
  provider scopes its Stripe **`account_holder`** to a **per-association Customer**
  (`ensureFcCustomer(associationId)`, keyed by `metadata.ycm_fc_association`), so
  each HOA's FC accounts attach to that HOA's own customer. No cross-HOA bleed:
  every sync, report, and balance query is `association_id`-filtered.
- **Multi-HOA aggregation already works.** A property manager is a user with
  `association_memberships` across multiple associations (the `property-manager`
  plan tier exists). They link each HOA's bank under that HOA, and the existing
  per-association feeds roll up into the manager's multi-HOA view exactly as the
  Plaid feeds do — FC changes the source, not the aggregation.
- **Each HOA links its OWN bank, even at the same institution.** FC connects
  per bank account via the hosted collection flow, so HOA-A's Chase account and
  HOA-B's Chase account are independent FC accounts under independent
  per-association customers.

**Caveat / gotcha (operational, not a blocker):**
- **No "link once, fan out to all HOAs" flow** — each HOA's bank is linked
  individually (correct for fiduciary isolation: a manager should not point one
  bank link at multiple HOAs' books). A manager onboarding N HOAs does N link
  flows. This matches the Plaid behavior and the per-association data model;
  there is no shared-link shortcut, by design.
- **Per-account FC cost scales linearly** (~30¢/account/mo + ~10¢/balance call) —
  a manager with many HOAs pays per linked account, same as Plaid's per-item
  pricing. Worth noting for the manager-tier unit economics, not a technical gap.
