# T3 — 4.4 Signup Session Continuity + Onboarding Banner — Execution Audit

**PPM workitem:** `5d8a1a0a-2d1b-4c02-aa11-81b010436e91`
**Scope:** 4.4 Q7 (AC 18–22) + 4.4 Q2 (AC 1–5)
**Readiness:** Part 1 — ready · Part 2 — ready (1 design choice to confirm)
**Author:** Claude audit agent · **Date:** 2026-04-20

---

## Part 1 — Q7 Post-checkout Session Continuity

### Current state of `/api/public/signup/complete`
`server/routes.ts:12829-12844`. Verifies Stripe session completed, calls `provisionWorkspace(session)`, reads `adminUsers` row by `meta.adminUserId`, returns `{ success, email, associationId }`. **It does NOT set a cookie, does not call `req.login`, does not touch `authUsers` or passport.** The success page follows with `Link href="/app"` (`plan-signup-success.tsx:206`) which will hit `requireAdmin` and 403 unless an OAuth popup session was already established.

### Current state of `provisionWorkspace()`
`server/routes.ts:12647-12686`. Reads `associationId` + `adminUserId` from Stripe metadata. Idempotency check on `platformSubscriptions`. Flips `adminUsers.isActive` to `1`. Creates `platformSubscriptions` row, optional `tenantConfigs` row. **No session handling, no `authUsers` linkage, no passport call.**

### How admin sessions are established today
Stack (single path):
- Session middleware: `server/index.ts:76-97` — `express-session` + `connect-pg-simple` store (`user_sessions` table), cookie name `sid` (prod) / `sid_dev`, `httpOnly`, rolling 7-day.
- Passport init: `server/auth.ts:315-319` (`passport.initialize()` + `passport.session()`). Serializer stores `authUsers.id` (`auth.ts:201-223`).
- Only session-grant sites:
  1. Google OAuth callback — `auth.ts:393` `passport.authenticate("google")` — writes `req.user` and serializes to session.
  2. `POST /api/auth/session/restore` — `auth.ts:443-477` — calls `req.login(user)` after verifying the `auth_restore` HMAC cookie.
  3. Lazy re-hydration inside `tryHydrateAdminFromSession` — `routes.ts:917-924` — `req.login` is called if `req.session.passport.user` is present but `req.user` is not.
- `requireAdmin` (`routes.ts:981-996`) is the gate; it calls `tryHydrateAdminFromSession` (`routes.ts:856-947`) which resolves an `authUser` → `adminUser` link via `authUsers.adminUserId` OR `adminUsers.email`.

**Critical:** admin identity is a two-table join. A session authenticates an `authUsers` row; the `adminUsers` row is linked by `authUsers.adminUserId` (preferred) or by email fallback. To "set a session cookie for this admin," we must:
1. Ensure an `authUsers` row exists for this email.
2. Ensure `authUsers.adminUserId` points at the newly-created `adminUsers.id`.
3. Call `req.login(authUser)` so passport serializes `authUsers.id` into `req.session.passport.user`.
4. `express-session` then Set-Cookie's the `sid` on the response.

The signup flow today never creates an `authUsers` row — only an `adminUsers` row.

### Least-magic implementation path
Inside `provisionWorkspace()` (or a new sibling called from the `GET /complete` handler — not from the webhook, which has no `req`):

```
1. Fetch adminUser by id (already happens).
2. await storage.getAuthUserByEmail(adminUser.email) — if missing, createAuthUser({ adminUserId, email, firstName?, lastName?, isActive: 1 }).
3. If existing and adminUserId mismatched, updateAuthUser({ adminUserId }).
4. Wrap req.login(authUser, cb) in a Promise from the /complete route handler.
5. touchAuthUserLogin(authUser.id).
6. Respond with { success, email, associationId } — cookie is already set on the response by express-session.
```

The `storage.createAuthUser` / `updateAuthUser` / `touchAuthUserLogin` helpers all exist and are exercised by the Google OAuth strategy (`auth.ts:272-300`).

### Failure modes
| Scenario | Result today | Mitigation for Q7 |
|---|---|---|
| DB writes succeed, `req.login` throws | Cookie never set | Return 200 with `fallback: "magic-link"`; caller triggers magic-link send |
| `req.login` succeeds but cookie strip by proxy | Client lands at `/app` unauthenticated | Client detects 401 on `/api/auth/me` after redirect, triggers magic-link |
| Session already holds a different user (e.g. user signed up while logged into another account) | New session overwrites old via `req.login` | Acceptable — last-writer-wins, documented |
| Webhook fires before `/complete` is called | `provisionWorkspace` is idempotent; webhook path has no `req` so it cannot call `req.login` | Expected — only the `/complete` interactive path sets the session |

### Magic-link fallback — plumbing assessment
No magic-link auth flow exists today. `sendPlatformEmail` helper at `server/email-provider.ts:346` is wired (used 12+ times in routes.ts for dunning, invites, reminders). The `auth_restore` token at `auth.ts:398-400` is conceptually identical to a magic-link token (HMAC-signed user id with TTL) — the mechanism already exists, just not exposed as an email-dispatched URL.

⚠️ Minimum new surface area for the magic-link fallback:
- Reuse `createAuthRestoreToken(authUserId)` + a new route `GET /api/auth/magic/:token` that verifies and calls `req.login`.
- Reuse `sendPlatformEmail` to deliver the link with 15-min expiry (AC 20).
- Token TTL currently lives on `auth_restore` — needs verification it's ≤15 min or a parallel helper with 15-min TTL.

### Google OAuth reconciliation
Today the OAuth strategy (`auth.ts:234-309`) creates/updates an `authUsers` row with `adminUserId` resolved via `resolveExistingAdminForAuthenticatedUser` (`auth.ts:190-196`) — which only matches **active** admin users. Because signup creates `adminUsers` with `isActive: 0` at `routes.ts:12800` and only flips it to `1` during `provisionWorkspace`, a Google-OAuth signup flow will produce an `authUsers` row with `adminUserId: null` during the signup screen. After provisioning, the hydrate path at `routes.ts:856-947` falls back to email match and eagerly relinks (`routes.ts:878-888` — `[auth-admin-link][relinked]` log). So the reconcile already works — provided provisioning has run before the next authenticated request. For the immediate post-`/complete` request, we should explicitly call `updateAuthUser({ adminUserId })` to close the race (AC 21). No double admin is possible because `adminUsers.email` is unique-indexed (`schema.ts:170`).

### Concrete edit list — Part 1
1. `server/routes.ts:12647-12686` — extend `provisionWorkspace` to accept optional `{ req }` and, when supplied, perform the authUser ensure/link + `req.login` sequence.
2. `server/routes.ts:12829-12844` — in the `/complete` handler, pass `req`; on session-set failure, branch to magic-link: generate `auth_restore` token, call new `sendSignupMagicLinkEmail`, return `{ fallback: "magic-link", email }`.
3. `server/auth.ts` — add `POST /api/auth/magic/start` (re-send) and `GET /api/auth/magic/:token` (verify + login + redirect to `/app`). Reuse `createAuthRestoreToken` / `verifyAuthRestoreToken`.
4. `server/email-provider.ts` or a new helper — `sendSignupMagicLinkEmail(email, url)` template.
5. `client/src/pages/plan-signup-success.tsx:60-114` — on success response, add `setTimeout(() => window.location.assign("/app"), 3000)` (AC 19); render "Taking you to your workspace…" copy; if `data.fallback === "magic-link"`, swap messaging to "Check your email for a sign-in link."
6. `tests/` — new Vitest: stub Stripe session, hit `/complete`, assert response Set-Cookie `sid=` present; assert subsequent `/api/auth/me` returns admin; assert DB `authUsers.adminUserId === adminUsers.id`.

---

## Part 2 — Q2 Onboarding Banner on Home

### Current state of Home (`client/src/pages/dashboard.tsx`)
⚠️ **A setup-completion card already exists on Home.** `dashboard.tsx:554-704` queries `GET /api/onboarding/state?associationId=…` and renders an "Association Setup" card with 5 items (units, owner data, board members, payment methods, communication templates) + a percent-complete bar. A modal `SetupWizard` (`client/src/components/setup-wizard.tsx:564`) handles the "no associations" welcome state.

Divergence from 4.4 Q2 AC 1–5:
- Q2 checklist has 4 items (assoc-details / board-officer / units / document); existing card has 5 different items (no assoc-details-TBD check; no document check).
- Existing card is NOT dismissible per-admin-user; it auto-hides when `state === "complete"`.
- Existing card is scoped to `activeAssociationId`; Q2's trigger per AC 1 is "address/city/state = 'TBD' OR <1 board officer invited" (post-signup stub state).

**Decision point:** Two execution options —
- **A. Replace** the existing card with a Q2-compliant one (drop the 5-item list in favor of the 4-item list). Cleaner; single onboarding surface.
- **B. Extend** the existing `/api/onboarding/state` response with a `signupChecklist` block + dismissedAt field, and keep both visible. More surface, more flexibility.

⚠️ Recommendation: **Option A** for Phase 1. The existing card is a pre-4.4 artifact; Q2's 4-item checklist is the locked spec.

### Data sources per checklist item
| Item | Query | Complete when |
|---|---|---|
| 1. Association details | `associations` by `activeAssociationId` | `address !== "TBD" AND city !== "TBD" AND state !== "TBD"` (literal-match sentinel from `routes.ts:12796`) |
| 2. Board Officer invite | `admin_users` where `role === "board-officer"` (scoped via `admin_association_scopes` to assoc) OR `onboarding_invites` where `residentType === "board"` | ≥1 row |
| 3. Units | `units` by `associationId` | count > 0 |
| 4. First document | `documents` by `associationId` | count > 0 |

⚠️ Item 2 needs founder clarification: "invited" = invite sent, or admin_user with `board-officer` role exists? The 4.4 Q2 P2 text says "invite at least one board officer" — interpret as **invite-sent** (an `onboarding_invites` row or equivalent), not live role. Flag for Wave 15 kickoff.

### Completion-state persistence
⚠️ `admin_users` (`schema.ts:162-170`) has no onboarding fields. Options:
- **Add column** `onboarding_dismissed_at timestamp` on `admin_users`. Schema migration; minimal. **Recommended.**
- New `admin_onboarding_progress` table keyed by `(admin_user_id, association_id)` — heavier, only justified if per-association dismissal is needed.
- localStorage — rejected per Q2 AC 5 ("persisted per-admin-user").

### Click-through targets (existing routes — no new routes)
| Item | Route |
|---|---|
| Association details | `/app/association-context` (existing; confirmed in dashboard.tsx:685) |
| Board Officer invite | `/app/board` (existing; confirmed in dashboard.tsx:686) OR a new "invite board officer" modal — use existing |
| Units | `/app/units` (existing; confirmed in dashboard.tsx:684) |
| Documents | `/app/documents` (per dashboard.tsx:591 shortcut) |

### UI design
Dismissible `Card` on Home (same component family as current "Association Setup" card) with:
- Header: "Finish setting up your workspace" + percent bar + `X` dismiss icon (calls `PATCH /api/admin/onboarding/dismiss`).
- Body: 4 rows, each a `Link` with `CheckCircle2` / `Circle` icon, label, `ChevronRight`.
- Re-appears on next login only if NOT dismissed AND items incomplete. Per AC 5, once dismissed, stays dismissed regardless of completion (but re-appearance logic can be revisited per Phase 1 telemetry).

### Concrete edit list — Part 2
1. `shared/schema.ts:162-170` — add `onboardingDismissedAt: timestamp("onboarding_dismissed_at")` to `adminUsers`. Drizzle migration generated.
2. `server/routes.ts` — new `GET /api/admin/onboarding/signup-checklist` returning `{ associationDetails, boardOfficerInvite, units, documents, dismissed }` booleans + `PATCH /api/admin/onboarding/dismiss`.
3. `server/storage.ts` — helpers for the 4 signal queries + dismiss update.
4. `client/src/pages/dashboard.tsx:659-704` — replace the "Association Setup" card with a new `<SignupOnboardingChecklist />` component that consumes the new endpoint. Keep the `noAssociations` welcome (`dashboard.tsx:595-613`) and the `SetupWizard` modal.
5. `client/src/components/signup-onboarding-checklist.tsx` — new component (~120 LOC).
6. Tests — Vitest for the endpoint (TBD→details-done transition) + a render test for the component.

---

## Part 3 — Risks + Founder Flags

- ⚠️ **Magic-link TTL** — Q7 AC 20 specifies 15-min expiry. `auth_restore` HMAC has an unverified TTL; must read/extend before reuse or build a parallel short-lived helper.
- ⚠️ **Existing Home setup-card conflict** — Q2 doesn't mention the pre-existing 5-item card. Confirm Option A (replace) vs Option B (keep both) with founder before Wave 15.
- ⚠️ **"Invited" semantics (item 2)** — invite-sent vs board-officer-role-active. Default to invite-sent row.
- ⚠️ **Webhook-path provisioning** — `checkout.session.completed` webhook (`routes.ts:12881`) also calls `provisionWorkspace` with no `req`. Must stay cookie-less there; only `/complete` interactive path sets session. Idempotency already handled.
- ⚠️ **Schema migration for `onboarding_dismissed_at`** — requires `drizzle-kit push` / prod migration window.

**Effort estimates**
- Part 1 (Q7): ~6–9 agent-hours · ~200 LOC server + ~40 LOC client + ~80 LOC tests.
- Part 2 (Q2): ~5–7 agent-hours · ~120 LOC server + ~150 LOC client + schema migration + ~60 LOC tests.
- **Total: ~11–16 agent-hours**, ~650 LOC.

**Sequencing** — Part 1 before Part 2. Part 2's dismissible-banner UX only makes sense once users land in `/app` authenticated (Part 1). Independent commits; Part 2 depends only on Part 1's session being live.

---

## Part 4 — Proposed Wave 14 + Wave 15 Plan

### Wave 14 — Part 1 (server-heavy)
**Files touched:**
- `server/routes.ts` (provisionWorkspace signature + `/complete` handler + magic-link routes)
- `server/auth.ts` (magic-link verify route; possibly TTL tweak on auth_restore helper)
- `server/email-provider.ts` or new `server/signup-magic-link.ts` (email template)
- `client/src/pages/plan-signup-success.tsx` (3s redirect, fallback copy)
- `tests/signup-session-continuity.test.ts` (new Vitest)
- `tests/signup-magic-link-fallback.test.ts` (new Vitest)

**Exit criteria:** AC 18–22 satisfied; signup-start → checkout-stub → complete → `/app` integration passes without intermediate login.

### Wave 15 — Part 2 (client-heavy)
**Files touched:**
- `shared/schema.ts` (`adminUsers.onboardingDismissedAt`)
- Migration file under `drizzle/` or `script/`
- `server/storage.ts` (4 signal queries + dismiss update)
- `server/routes.ts` (2 new endpoints)
- `client/src/pages/dashboard.tsx` (swap card)
- `client/src/components/signup-onboarding-checklist.tsx` (new)
- `tests/onboarding-signup-checklist.test.ts` (new Vitest)

**Exit criteria:** AC 1–5 satisfied; fresh-signup workspace shows 4-item checklist, each item navigates, dismissal persists across sessions, no new `/app/onboarding` route added.

---

**Return summary** — File: `/home/runner/workspace/docs/projects/platform-overhaul/implementation-artifacts/t3-signup-continuity-onboarding-banner-audit.md` · Part 1 ready · Part 2 ready (Option A vs B pending founder confirm) · 5 ⚠️ flags · ~11–16 agent-hours total.
