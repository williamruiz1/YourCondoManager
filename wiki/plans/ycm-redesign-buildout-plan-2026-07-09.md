# YourCondoManager — Redesign Build-Out Plan

**Status:** PLAN (not built). Source of truth for the target UI is the gated redesign preview at `https://admin.yourcondomanager.org/redesign/`.
**Date:** 2026-07-09
**Repo:** `~/code/YourCondoManager` · GitHub `williamruiz1/YourCondoManager` · Live `app.yourcondomanager.org` · Fly `yourcondomanager`
**Author:** Solutions Architect (draft for GM review → route into PocketPM + build fleet)
**First paying customer:** Cherry Hill Court Condominiums (single-association, single-landlord today)

---

## Executive summary

We are building out **three surfaces** on the new brand, **in this priority order**:

1. **Manager app** (admin / property-manager surface) — **build first.** Managers are the paying users and the ones who drive adoption; nothing owner-facing matters until managers can run the association on the new brand.
2. **Owner portal** (the web portal owners log into) — **second.**
3. **Owner app** (native mobile) — **third, and greenfield.**

### The owner-not-resident reframing (applies throughout)
The redesign prototype labels the mobile surface a **"Resident App."** That is corrected everywhere in this plan to an **OWNER app — for condo unit OWNERS, not residents/renters.** The owner app carries **owner-centric features only**: pay dues, view statements/ledger, book amenities, submit requests, view documents/announcements — all from the *owner's* seat. (The current codebase already labels the portal role "Owner", so the platform is partway there; we finish the reframing in copy, IA, and the mobile shell.)

### What this build actually is (the honest framing)
The platform is **mature**, not greenfield. The current codebase already has **141 routes, 169 database tables**, a deep financial/governance/operations feature set, a working **Owner Portal** (`client/src/pages/portal/`), and live **Stripe** payment + Connect infrastructure. So:

- **Manager app = REBRAND + IA cleanup + one net-new module (Violations).** Nearly every redesign screen maps to an existing page that gets **restyled** to the new design system, not rebuilt.
- **Owner portal = REBRAND + consolidation.** The portal exists; the redesign mostly restyles it and consolidates a cleaner "Pay Dues / Statements / My Account" IA.
- **Owner app = GREENFIELD shell, but maximum reuse.** We wrap the existing React/TS owner client in a native shell (recommendation below) rather than rewriting the UI — reusing the API, auth, Stripe flows, and components.

The single highest-leverage first move is the **shared design-system layer** (brand tokens + app-shell components). All three surfaces consume it; it is the critical-path Phase 0.

### Tech stack (current, confirmed by reading the code)
React + Vite + **wouter** (routing) + **@tanstack/react-query** + **Tailwind** + **drizzle-orm** + **express** + **passport / express-session** (cookie auth). Payments: **Stripe** + **Stripe Connect** (`server/services/stripe-connect.ts`, `payment-service.ts`, `bank-feed/`). Existing mobile-responsive scaffolding already present: `mobile-tab-bar.tsx`, `mobile-section-shell.tsx`, `use-mobile.tsx`.

---

## Cross-cutting foundation (build ONCE — all 3 surfaces consume)

This is **Phase 0** and it is on the critical path for every surface. Nothing else should start until F1 lands.

### F1 — Shared design-system layer (`@ycm/design-system`) — CRITICAL PATH
The redesign ships a single `brand.css` (design tokens + app-shell + component classes). Port it into the app once:

- **Brand tokens → Tailwind theme.** Teal `#014D4A`, teal-700 `#0a6a63`, accent `#15A39C`, light `#BFE8E4`, ink `#0f2e2c`, muted `#5b7572`; status colors (ok/warn/bad/info); radius `12px`/`8px`; shadow; font **Inter Tight**. Map into `tailwind.config` as the canonical palette + font so every surface renders identically.
- **Shell + primitives as React components** (one set, all surfaces import): `AppShell`, `Sidebar` (teal, section labels, active-rail), `TopBar` (search + actions), `PageHead`, `Card`, `Stat` (KPI tile), `DataTable` (`.tbl`), `Pill` (ok/warn/bad/info/muted), `Button` (primary/accent/ghost), `Field`, `Bar`, and the CSS-only `Chart` helpers.
- **Light-first.** The redesign is light-first; **dark mode stays SHELVED** (current `use-user-settings.ts` force-lights via `theme: "light"` pending PR-2 dark-mode fixes). Do **not** re-enable dark mode as part of this build; keep the force-light default.
- **Brand mark.** The redesign uses an ascending 3-bar polygon mark — reconcile with the existing `brand-mark.tsx` (use the **real** YCM mark, never a placeholder).

**Acceptance:** a Storybook (or a `/redesign-kit` internal route) renders every primitive, pixel-matching the preview's `brand.css`; Tailwind theme swapped to the brand palette; existing pages still compile (light-only).

### F2 — Auth / session parity across surfaces
Auth is passport + express-session cookies today. Confirm one session model spans manager (`/app/*`), portal (`/portal/*`), and the owner app (native) — the owner app adds a token/biometric unlock over the same session (see owner-app section). **Surface-parity gate:** any auth/gate change must migrate the FULL consumer surface, not a subset (per auth-surface-parity discipline) — never leave a class of users locked out or leaking.

### F3 — Gated review → William signoff (per surface, before anything ships live)
The `admin.yourcondomanager.org/redesign/` preview IS the signoff surface. For each surface, publish a **wireframe round** to the **YCM admin hub** and get William's explicit "build this" **before** porting to live app code. Wireframe-first, signoff, then implement — never reactive tweaks in production code.

---

## Surface 1 — Manager app (HIGHEST priority, build first)

**Redesign nav (target IA):** Dashboard · Payments · Reports · Violations · Work Orders · Documents · Communications · Calendar · Settings.
**Redesign screens (9):** Dashboard, Billing & Dues, Payments, Ledger & Reconciliation, Reports, Work Orders, Residents & Units, Violations, Login.

### Target-state screen inventory → current code map

| Redesign screen | Current code | Disposition |
|---|---|---|
| **Dashboard** (`web/dashboard`) — collections chart, upcoming, needs-attention, recent activity | `pages/dashboard.tsx` (+ `home-alerts-panel`, `recommended-actions-panel`, `hub-alert-widget`) | **RESTYLE** |
| **Billing & Dues** (`web/financials`) — active assessments, per-unit dues status | `financial-billing.tsx`, `financial-assessments.tsx`, `financial-recurring-charges.tsx` | **RESTYLE + consolidate** |
| **Payments** (`web/payments`) — payment inbox, methods, gateway connections | `financial-payments.tsx` (large, exists), `admin-payments-record.tsx`, `routes/autopay.ts`, `routes/stripe-connect.ts` | **RESTYLE** |
| **Ledger & Reconciliation** (`web/ledger`) — GL recent txns, reconcile | `financial-ledger.tsx`, `financial-reconciliation.tsx`, `virtualized-ledger-table.tsx` | **RESTYLE** |
| **Reports** (`web/reports`) — income vs expense YTD, delinquency aging | `financial-reports.tsx`, `financial-ar-aging.tsx` | **RESTYLE** |
| **Work Orders** (`web/workorders`) | `work-orders.tsx`, `vendors.tsx`, `vendor-portal.tsx` | **RESTYLE** |
| **Residents & Units** (`web/residents`) — directory | `persons.tsx`, `units.tsx` | **RESTYLE + reframe → "Owners & Units"** |
| **Violations** (`web/violations`) — violation detail / CC&R enforcement | **no dedicated page today** (adjacent: `governance-compliance.tsx`, `inspections.tsx`) | **NET-NEW module** |
| **Login** (`web/login`) | `server/auth.ts` + login page | **RESTYLE** |
| *(nav-only)* Communications | `communications.tsx`, `communications-inbox.tsx`, `announcements.tsx` | **RESTYLE** |
| *(nav-only)* Calendar | `calendarEvents` table + `meetings.tsx` | **RESTYLE / assemble** |
| *(nav-only)* Documents | `documents.tsx` | **RESTYLE** |
| *(nav-only)* Settings | `user-settings.tsx`, `settings-billing.tsx`, `platform-controls.tsx` | **RESTYLE** |

**Biggest net-new piece:** the **Violations module** (CC&R violation tracking + notices) — it has no home in the current schema/pages and is a real new feature, not a restyle.

### Architecture + tech decisions
- Restyle in place on the existing React/Vite/wouter app; swap page chrome to the `@ycm/design-system` `AppShell`/`Sidebar`/`TopBar`. No framework change.
- Consolidate the IA to the 9-item nav (the current app has ~141 routes / overlapping `/app/financial/*` vs `/app/financials/*` — the redesign is the chance to collapse duplicates behind the cleaner nav).
- Keep every existing API route; the restyle is presentational + IA. Only the Violations module adds new API + tables.

### Phased work breakdown (fleet-claimable slices; requirements = definition of done)

- **M0 — Manager shell on the new brand.** Wrap `/app/*` in the new `AppShell` + `Sidebar` (9-item nav) + `TopBar`. **AC:** every `/app/*` route renders inside the new teal sidebar/topbar; nav matches redesign; light-only; no route 404s; existing functionality intact (visual QA against `web/dashboard`).
- **M1 — Dashboard restyle.** **AC:** collections-6mo chart, Upcoming, Needs-attention, Recent-activity render in new cards/stats and match `web/dashboard.html`; live data wired from existing dashboard queries.
- **M2 — Billing & Dues restyle + consolidate.** **AC:** active-assessments list + per-unit dues-status table match `web/financials.html`; assessments/recurring-charges reachable; numbers reconcile with `financial-assessments` data.
- **M3 — Payments restyle.** **AC:** payment inbox, saved methods, gateway connections match `web/payments.html`; Stripe Connect status shown from live `stripe-connect` service; no money moves in dev (test mode).
- **M4 — Ledger & Reconciliation restyle.** **AC:** GL recent-transactions + reconciliation UI match `web/ledger.html`; `virtualized-ledger-table` reused; reconcile actions unchanged.
- **M5 — Reports restyle.** **AC:** income-vs-expense YTD + delinquency-aging match `web/reports.html`; charts use the design-system chart helpers; export-CSV retained.
- **M6 — Work Orders restyle.** **AC:** work-order board/list matches `web/workorders.html`; vendor assignment retained.
- **M7 — Owners & Units restyle + reframe.** **AC:** directory matches `web/residents.html`; copy reframed "Residents" → "Owners & Units" where the subject is unit ownership; `persons`+`units` data intact.
- **M8 — Violations module (NET-NEW).** New tables + API + page. **AC:** create/track a violation with type, unit, status, notice history (matches `web/violations.html`); notices reuse the existing notice/communication pipeline; guarded behind a feature flag until signoff.
- **M9 — Login + Communications + Calendar + Documents + Settings restyle.** **AC:** each nav destination renders on the new brand and matches the preview's tone; login page matches `web/login.html`.

### Data-model / API changes (Manager)
- **Violations:** net-new tables — `violations` (unit_id, type, opened_at, status, description), `violation_types` (CC&R rule catalog), `violation_notices` (links to existing `notice_sends`/`communication_history`). New `server/routes/violations.ts`.
- **Everything else:** reuse the existing 169 tables + `routes.ts`/`server/routes/`. No schema change for the restyles.

### Risks + money-safety (Manager)
- Payments/reconciliation restyle touches money-visible surfaces — **never move real money in dev** (Stripe test mode only); any change to Cherry Hill's live books needs William's ratify.
- The `/app/financial/*` vs `/app/financials/*` route duplication must be de-duped carefully so no deep-links/bookmarks break during IA consolidation.

---

## Surface 2 — Owner portal (second)

**Redesign screens (6):** Home, Pay Dues, Statements, Documents, Requests, My Account.

### Target-state screen inventory → current code map

| Redesign screen | Current code | Disposition |
|---|---|---|
| **Home** (`portal/home`) — this-month balance, pay-now, autopay CTA, announcements, recent activity | `pages/portal/portal-home.tsx` | **RESTYLE** |
| **Pay Dues** (`portal/pay`) — amount, method, confirm-and-pay | `portal-finances.tsx` (`duenow` flow), `routes/autopay.ts`, `routes/payment-portal.ts` | **RESTYLE + extract dedicated Pay flow** |
| **Statements** (`portal/statements`) — monthly statements + ledger, download PDF | `portal/finances/statement`, `account-statement-view.tsx`, `routes/account-statement.ts` | **RESTYLE** |
| **Documents** (`portal/documents`) | `portal-documents.tsx` | **RESTYLE** |
| **Requests** (`portal/requests`) — open/closed, submit | `portal-requests.tsx` | **RESTYLE** |
| **My Account** (`portal/account`) — payment methods & autopay, notifications, profile | `portal-my-consents.tsx` + `user-settings.tsx` + `finances/payment-methods` | **NET-NEW consolidation** (no new tables) |

Also present today and kept: `/portal/amenities`, `/portal/community`, `/portal/notices` — restyle and fold into the new IA (amenities = "book amenities" owner feature).

### Architecture + tech decisions
- Same React app, `/portal/*` routes, restyled with the shared design system (portal uses `portal-shell.tsx`, already role-labeled "Owner").
- **My Account** consolidates three existing surfaces (consents + settings + payment methods/autopay) into one screen — **no new tables** (uses `savedPaymentMethods`, `autopayEnrollments`, `consentRecords`, `adminUserPreferences`).

### Phased work breakdown

- **P0 — Portal shell on the new brand.** Restyle `portal-shell.tsx` + owner nav (Home / Pay / Statements / Documents / Requests / My Account) to the design system. **AC:** all `/portal/*` render on the new brand; owner (not resident) copy; light-only.
- **P1 — Home restyle.** **AC:** this-month balance, Pay-now, Set-up-autopay, announcements, recent-activity match `portal/home.html`; live owner-scoped data.
- **P2 — Pay Dues flow.** **AC:** amount → method → "Confirm & pay $X" matches `portal/pay.html`; reuses existing Stripe payment path; **test mode in dev**; receipt on success.
- **P3 — Statements restyle.** **AC:** monthly statements list + ledger + Download-PDF match `portal/statements.html`; PDF via existing `account-statement` service.
- **P4 — Documents + Requests restyle.** **AC:** match `portal/documents.html` and `portal/requests.html`; submit-request + open/closed retained.
- **P5 — My Account (consolidation).** **AC:** payment-methods & autopay + notifications + profile in one screen matching `portal/account.html`; consents preserved; save-profile works.
- **P6 — Amenities booking restyle.** **AC:** owner amenity booking on the new brand (owner-centric "book amenities").

### Data-model / API changes (Portal)
- **None net-new.** Pure restyle + consolidation over existing owner-portal routes and tables.

### Risks + money-safety (Portal)
- Pay Dues is real owner money → Stripe flow reused, **flag-gated**, test-mode in dev; live Cherry Hill payments need William ratify before enabling.
- Owner data-scoping must hold (owners see only their unit) — validate the portal role-scoping on every restyled query.

---

## Surface 3 — Owner app (third — greenfield native, maximum reuse)

**Redesign screens (5):** Dashboard, Pay, New Request (work order), Documents, Messages. *(reframe "Resident" → "Owner" throughout — titles currently say "YCM Resident".)*

### RECOMMENDED STACK: **Capacitor over the existing React owner client** (owner-scoped bundle)

**Recommendation: Capacitor.** Wrap the existing React/TS owner client (the `/portal/*` screens + owner-app screens) in a Capacitor native shell → real App Store / Play Store apps from **one codebase**, reusing the entire React client, API, passport session auth, Stripe flows, react-query, and the shared design system.

**Why Capacitor over the alternatives:**

| Option | Reuse | App Store | Native (push/camera/biometric) | Verdict |
|---|---|---|---|---|
| **Capacitor** (wrap existing React) | **Maximum** — whole React client + API + auth + Stripe | ✅ iOS + Android | ✅ via plugins (push, camera, Face ID, Apple/Google Pay) | **RECOMMENDED** |
| React Native / Expo | Low — API + shared TS types only; **full UI rewrite** | ✅ | ✅ native | Highest cost; duplicates everything |
| PWA only | High | ❌ no store presence | ⚠️ web-push flaky on iOS, no reliable biometric | Cheapest but misses store + reliable push |

Capacitor is the only option that satisfies the stated goal — **favor reuse of the existing React/TS client + API** — while still delivering real native apps with the owner-app-specific native needs: **push notifications** (dues reminders, announcements), **camera** (work-order photos), **biometric unlock** (Face ID/Touch ID over the existing session), and **Apple Pay / Google Pay** via Stripe. Build a focused **owner-only route bundle** (the owner screens) and wrap it; the same screens power the web portal and the native app.

### Target-state screen inventory → reuse map

| Owner-app screen | Reuses | Disposition |
|---|---|---|
| **Dashboard** (`mobile/dashboard`) — balance, quick actions, announcements | portal-home data/logic | **NEW shell, reuse logic** |
| **Pay** (`mobile/pay`) — amount, method, confirm & pay | portal Pay Dues flow + Stripe | **Reuse** + native Apple/Google Pay |
| **New Request** (`mobile/workorder`) — priority, add photo, my open requests | portal-requests submit | **Reuse** + native camera |
| **Documents** (`mobile/documents`) | portal-documents | **Reuse** |
| **Messages** (`mobile/messages`) | communications / portal-notices | **NET-NEW owner messaging UI** |

### Phased work breakdown

- **O0 — Capacitor shell + owner bundle.** Stand up Capacitor project wrapping an owner-scoped React build (bottom tab bar reusing `mobile-tab-bar.tsx`); native shell boots to the owner dashboard. **AC:** app builds for iOS + Android; authenticates against the existing session; owner sees their unit only; "Owner" (not "Resident") throughout.
- **O1 — Dashboard + Documents (read surfaces).** **AC:** match `mobile/dashboard.html` + `mobile/documents.html`; live owner data; offline-tolerant loading states.
- **O2 — Pay (native).** **AC:** amount → method → confirm matches `mobile/pay.html`; reuses Stripe path; **Apple Pay / Google Pay** via Stripe; **test mode in dev**, no real money.
- **O3 — New Request + native camera.** **AC:** submit a work order with a photo captured via the native camera; matches `mobile/workorder.html`; appears in "My open requests".
- **O4 — Messages (net-new) + push.** **AC:** owner ↔ management threads match `mobile/messages.html`; native push for new messages/dues/announcements registered against `pushSubscriptions` (+ native device-token table).
- **O5 — Biometric unlock + store submission prep.** **AC:** Face ID/Touch ID unlock over the session; app icons/splash on brand; TestFlight / internal-track build ready for William.

### Data-model / API changes (Owner app)
- **No new core tables** — reuses `ownerLedgerEntries`, `savedPaymentMethods`, `autopayEnrollments`, `maintenanceRequests`/`workOrders`, `documents`, `communicationHistory`, `pushSubscriptions`.
- **One likely addition:** a native **device-registration** table for APNs/FCM tokens (extend `pushSubscriptions` if it isn't already device-scoped).
- **Messages** may add a lightweight `owner_message_threads` if the existing communications model doesn't already expose an owner-thread shape.

### Risks + money-safety (Owner app)
- App Store review + Apple/Google Pay + Stripe compliance are the long-pole external dependencies — start the developer-account / provisioning early (a William/founder action; flag it).
- All owner-app payment flows reuse the existing Stripe gateway, **flag-gated**, **test-mode in dev**; live money on Cherry Hill's books needs William ratify.

---

## Top 3 sequencing / dependency risks

1. **The design system (F1) is the whole critical path.** If the shared `@ycm/design-system` layer is not built and locked first, every surface diverges and we get three drifting rebrands. Build F1 → signoff → then and only then start M0/P0/O0. *(Mitigation: F1 is Phase 0; nothing else starts until it lands.)*
2. **Owner app depends on the Owner portal being restyled first.** The Capacitor owner app reuses the portal's screens/logic — building the native shell before the portal restyle means wrapping soon-to-change UI. *(Mitigation: enforce the priority order — Manager → Portal → Owner app; O-slices start only after the P-slices they reuse land.)*
3. **Money-visible surfaces + IA route de-duplication.** Payments/Ledger/Pay-Dues touch real Stripe flows and Cherry Hill's live books, and the Manager IA consolidation collapses duplicate `/app/financial(s)/*` routes — a careless restyle can break a payment path or a deep link. *(Mitigation: test-mode-only in dev, flag-gate every money surface, keep redirects for collapsed routes, William ratify before any live-money change.)*

---

## Sequenced roadmap (numbered build order the fleet executes)

**Phase 0 — Foundation (blocks everything):**
1. **F1 — Shared design system** (`@ycm/design-system`: brand tokens → Tailwind, shell + primitives, light-only). *Critical path.*
2. **F2 — Auth/session parity** confirmed across manager/portal/owner-app.
3. **F3 — Wireframe-round + William signoff** flow wired to the YCM admin hub (per surface).

**Phase 1 — Manager app (priority 1):**
4. **M0 — Manager shell** (new AppShell/Sidebar/TopBar over `/app/*`, 9-item nav).
5. **M1 — Dashboard restyle.**
6. **M2 — Billing & Dues restyle + consolidate.**
7. **M3 — Payments restyle** (Stripe status, test-mode).
8. **M4 — Ledger & Reconciliation restyle.**
9. …then M5 Reports · M6 Work Orders · M7 Owners & Units (reframe) · M8 Violations (net-new) · M9 Login/Communications/Calendar/Documents/Settings.

**Phase 2 — Owner portal (priority 2):** P0 shell → P1 Home → P2 Pay Dues → P3 Statements → P4 Documents+Requests → P5 My Account → P6 Amenities.

**Phase 3 — Owner app (priority 3, greenfield/Capacitor):** O0 Capacitor shell+owner bundle → O1 Dashboard+Documents → O2 Pay (native) → O3 New Request+camera → O4 Messages+push → O5 Biometric+store-prep.

**The first ~8 slices, in order:** F1 · F2 · F3 · M0 · M1 · M2 · M3 · M4.

---

## Notes / open items
- **Redesign screens reviewed:** all 20 loaded successfully (9 Manager · 6 Owner portal · 5 Owner app) plus `brand.css`. No separate `/stitch/` or `/r1/` prototype path was reachable under `/redesign/` — the index links this single 20-screen set; if a separate ~25-screen Stitch prototype exists it is at a path not linked from the preview index (flag to confirm with William/GM).
- **Reframing debt:** the mobile screens' `<title>` still say "YCM Resident" — correct to "Owner" during O0.
- **Dark mode stays shelved** (force-light) — do not re-enable in this build.
- This plan is **PLAN only**: no product code, no PPM features, no dispatches, no flags enabled here. The GM routes it into PocketPM + the build fleet after William's review.
