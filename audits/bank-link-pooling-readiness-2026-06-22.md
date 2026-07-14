# YCM Bank-Linking → Ledger Pooling → Chart of Accounts — Readiness & Walkthrough
**Date:** 2026-06-22 · **Repo:** `~/code/YourCondoManager` (`williamruiz1/YourCondoManager`) · **Live app:** https://app.yourcondomanager.org
**Scope:** REPORT + WALKTHROUGH only. No real banks linked, no prod money mutated, no flags flipped, no code edited.
**Plaid:** PRODUCTION live (`PLAID_ENV=production`, `PLAID_SECRET_PRODUCTION` deployed + distinct from sandbox, boot guard passing, live app health 200).

---

## TL;DR (plain English)

You **can** sign in as a board member, reach the bank-linking screen, and link a real bank through production Plaid. The linked account and its balances/transactions **appear immediately on the "Bank Connections" screen** — that part pools instantly.

The catch: **"Bank Connections" and "Chart of Accounts" are two separate screens that are NOT wired together.** A bank you link does **not** show up on the Chart of Accounts screen — not immediately, not after a sync, not at all today. The Chart of Accounts is a **hand-built list you type in yourself**; it doesn't read from your linked banks. So 3 of your 4 goals are GREEN; the 4th ("see the linked banks reflected in the chart of accounts") is **RED — not built**.

---

## READY-OR-NOT verdict (your 4 goals)

| # | What you want | Verdict | Where / why |
|---|---|---|---|
| 1 | Sign in as a board member and reach the bank-linking UI | 🟢 **GREEN** | Route `/app/financial/bank-connections` (nav label **"Bank Connections"**). `board-officer` is in the allowed roles. `client/src/App.tsx:182`. |
| 2 | Link bank account(s) via production Plaid Link | 🟢 **GREEN** | Full Link flow wired to production. `client/src/pages/financial-bank-connections.tsx:92-118, 204-213`; server `server/routes.ts:18726, 18746`; prod client `server/services/bank-feed/plaid-provider.ts:50-82`. |
| 3 | See accounts "pool" immediately (balances/transactions visible right away) | 🟡 **GREEN-with-caveat** | On the **Bank Connections** page: **accounts + balances appear immediately** (synchronously on link). **Transactions** appear on first sync (auto, minutes) or instantly via **"Sync Now"**. `server/routes.ts:18779-18796`. **But this is NOT the chart-of-accounts view** — see #4. |
| 4 | Get into the Chart of Accounts and see the linked banks reflected | 🔴 **RED — NOT BUILT** | The Chart of Accounts screen (`/app/financial/foundation`) reads from the **manually-entered** `financialAccounts` table via `/api/financial/accounts` — it has **zero** read of linked-bank data. `client/src/pages/financial-foundation.tsx:60-67`. Confirmed: no `bankAccount`/`plaid`/`glAccount` reference anywhere in that page. |

**One-line fix for #4 (if you want the bridge):** on bank link (`server/routes.ts:18782` — where `bankAccounts` rows are inserted), also upsert a matching `financialAccounts` row (accountType `asset`/`bank`) so the linked bank surfaces as a cash account on `/app/financial/foundation`. This is **net-new feature work**, not a config flip — there is no existing code path that does it.

---

## The "pooling immediacy" answer (the exact mechanism)

There are really **two** "pooling" questions. They have different answers:

**A) Does a linked bank pool into the BANK CONNECTIONS screen immediately?** → **YES, immediately for accounts/balances; minutes for transactions.**
- When Plaid Link succeeds, the client calls `POST /api/plaid/exchange-token`. That handler (`server/routes.ts:18763-18796`) **synchronously, in the same request**: exchanges the public token → access token, inserts the `bank_connections` row, then **immediately calls `getAccounts()` and inserts every account into `bankAccounts`** with current/available balances. The UI then invalidates its accounts query, so the new bank shows up the moment Link closes.
- **Transactions** are NOT in that synchronous insert. They arrive via one of three paths: (1) Plaid fires a `SYNC_UPDATES_AVAILABLE` webhook to `/api/webhooks/plaid` → triggers an async sync (`server/routes.ts:19101-19108`); (2) the 5-minute automation sweep picks up stale connections (`runBankFeedSweep`, `server/services/bank-feed-sync.ts:418`); (3) you click **"Sync Now"** for an instant pull. So transactions appear within ~minutes automatically, or instantly on demand.

**B) Does a linked bank pool into the CHART OF ACCOUNTS screen immediately?** → **NO. It never appears there at all today.**
- The Chart of Accounts page (`/app/financial/foundation`) is a **separate, hand-maintained list**. You create entries by typing them in (`createAccount` → `POST /api/financial/accounts`, `client/src/pages/financial-foundation.tsx:103-115`). It does not read bank links, bank balances, or the GL.
- There is **no sync delay and no manual step** that bridges the two — because **the bridge does not exist in code**. The bank-feed sync engine writes only to `bankAccounts` / `bankTransactions` / `bankFeedSyncRuns` and runs owner-payment reconciliation; it never touches `financialAccounts` or `gl_accounts` (`server/services/bank-feed-sync.ts:34-43, 170-260`).

**Bottom line:** "pooling immediately" is TRUE for the Bank Connections screen, FALSE for the Chart of Accounts screen.

---

## Board-member setup walkthrough (for a non-engineer owner)

> Goal: link your association's bank account(s) and confirm they appear with live balances.

1. **Go to** https://app.yourcondomanager.org and **sign in** with your board-member account. (Your role is "Board Officer" — that role has access to everything below.)
2. **Pick the right association** if you manage more than one — use the association selector at the top. The bank-link is scoped to whichever association is active.
3. In the left sidebar, open **Financials → Bank Connections** (URL: `/app/financial/bank-connections`). The page title is **"Payment Methods."**
4. Click the **"Connect Bank Account"** button (top right of the "Connected Banks" card).
5. **Plaid Link opens** — select your bank, sign in with your real online-banking credentials, and choose the account(s) to link. (This is **production** Plaid — real bank, real credentials.)
6. When Plaid closes, you'll see a **"Bank connected"** confirmation, and the account(s) appear **immediately** in the **Accounts** tab with name, type, last-4, and **current balance**.
7. To pull transactions right away, click **"Sync Now"** (next to the Connect button). Otherwise transactions arrive on their own within a few minutes. They show in the **Transactions** tab.
8. **To link a second/third bank:** repeat steps 4–7. Each linked account appears as its own row; balances are tracked per account (verified: the exchange handler inserts every account distinctly, `server/routes.ts:18782-18795`).

> ⚠️ **What you will NOT see:** Open **Financials → Chart of Accounts** (`/app/financial/foundation`) and your linked banks will **not** be listed there. That screen is a separate, type-it-in-yourself list. Linking a bank does not add it to the Chart of Accounts today (see Goal #4 above). If you expected the linked banks to "show up in the chart of accounts," that connection has not been built yet.

---

## Multiple-accounts pooling — verified

Linking 2+ banks works correctly and each appears distinctly:
- Each `Connect Bank Account` run creates a separate `bank_connections` row; **all** accounts returned by Plaid for that connection are inserted into `bankAccounts` (`server/routes.ts:18781-18795`).
- The Accounts tab lists every account as its own row with its own balance/last-4 (`financial-bank-connections.tsx:355-380`), and the page footer counts active connections.
- The sync engine refreshes balances **per account** and maps transactions to the correct account via `providerAccountId → bankAccounts.id` (`server/services/bank-feed-sync.ts:193-235`). Aggregation/distinctness is correct.

---

## GL-authoritative readiness (do NOT flip — informational)

You asked what flips the ledger to "authoritative" and whether the Chart of Accounts reads the GL. Findings:

- **The flag is `GL_ENABLED`** (`server/services/gl/flag.ts`). Default **OFF**. It is read in only a few places (`server/routes.ts:4159` gates GL-derived statements; `server/services/gl/gl-posting-service.ts` gates additive GL posting). When OFF, the GL-derived financial-statement endpoints return 404 and no GL posting runs.
- **The fund-aware GL has its OWN chart of accounts** — a code+fund seed in `gl_accounts` (`CHART_OF_ACCOUNTS` in `server/services/gl/posting.ts:60-79`: Operating/Reserve Cash, A/R, Assessment Income, etc.). This is **a different chart of accounts** from the manually-entered `financialAccounts` table that the `/app/financial/foundation` UI shows.
- **Does the Chart of Accounts UI read the GL? NO.** `/app/financial/foundation` reads `financialAccounts` (`/api/financial/accounts`), not `gl_accounts`. Flipping `GL_ENABLED` would **not** change what that screen displays. (It would only un-gate the separate GL-derived statement endpoints.)
- **Does the GL post linked-bank facts? NO (not yet).** The GL posts from owner-ledger facts today; `posting.ts:9` lists `bank_transaction` as a **future/intended** source, not a wired one. So even with `GL_ENABLED=on`, a linked bank would not flow into the GL chart of accounts.
- **Is flipping it safe?** The flag is purpose-built to be safe to flip (additive, parallel, never in the live money path — `flag.ts` header comment, BLINDSPOT F4). Reconcile-to-the-cent passing in build supports that. **But flipping it does NOT achieve any of your 4 goals** — it neither surfaces linked banks in any chart-of-accounts view nor pools bank data into the GL. **Recommendation: do not flip it for this purpose; it's the wrong lever.** (And per instruction, it was not flipped.)

---

## Config verification (production rails)

- `PLAID_ENV=production`, `PLAID_SECRET_PRODUCTION` deployed (digest `3070ec…`, **distinct** from sandbox `fbd474…`), `PLAID_CLIENT_ID`, `PLAID_WEBHOOK_URL`, `PLAID_TOKEN_ENCRYPTION_KEY`, `PLAID_REDIRECT_URI` all `Deployed` (`flyctl secrets list -a yourcondomanager`).
- **Boot guard** (`server/services/bank-feed/plaid-env-guard.ts`) refuses to boot in production unless webhook JWT verification is enabled + prod secret present + webhook URL set. App is live (health 200) → guard passed → all three hold.
- **Webhook attached to Items:** `createLinkToken` attaches `PLAID_WEBHOOK_URL` to every link token (`plaid-provider.ts:159, 172`), so created Items POST signed events to `/api/webhooks/plaid` (`server/routes.ts:19047`), JWT-verified in production (`plaid-provider.ts:307-312`).
- **Access tokens encrypted at rest** (AES-256-GCM, `PLAID_TOKEN_ENCRYPTION_KEY`) — `server/routes.ts:18764`.

---

## Cosmetic note (not a blocker)
The Bank Connections page still says **"Plaid Sandbox"** in the empty-transactions hint (`financial-bank-connections.tsx:395`) and the card copy references sandbox-era framing. Production works regardless; the string is just stale. Worth a one-word copy fix before a real owner sees it.

---

## File:line index (for follow-up build dispatch)
- Bank-link UI + Plaid Link: `client/src/pages/financial-bank-connections.tsx`
- Bank-link routes (link-token / exchange / sync / accounts): `server/routes.ts:18707-18977`
- Prod Plaid client selection: `server/services/bank-feed/plaid-provider.ts:50-82, 153-176`
- Boot guard: `server/services/bank-feed/plaid-env-guard.ts`
- Webhook route: `server/routes.ts:19041-19114`
- Sync engine (writes bankAccounts/bankTransactions only): `server/services/bank-feed-sync.ts`
- Chart of Accounts UI (reads financialAccounts, NOT banks/GL): `client/src/pages/financial-foundation.tsx:60-115`
- GL chart-of-accounts seed (separate, code+fund): `server/services/gl/posting.ts:60-79`
- GL flag: `server/services/gl/flag.ts`
- Routes + roles: `client/src/App.tsx:178, 182, 445, 452`
