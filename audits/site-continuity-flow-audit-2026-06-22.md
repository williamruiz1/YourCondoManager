# YCM Site Continuity + Flow Audit — 2026-06-22

**Scope:** Report-only audit of the YourCondoManager marketing/public site — (A) content/copy/messaging continuity and (B) functional end-to-end wiring of every user-facing flow.
**Repo:** `~/code/YourCondoManager` (`williamruiz1/YourCondoManager`), branch `main` @ `fd7367e`.
**Live:** `https://yourcondomanager.org` (marketing) · `https://app.yourcondomanager.org` (app + APIs). Fly app `yourcondomanager`, region `ewr`.
**Method:** code-trace (component → route → handler → side-effect) + live, non-destructive probes (validation-only POSTs, OAuth 302 check, `flyctl secrets list`). No code edited. No spam emails sent.

> **NOTE on the WebFetch limit:** the marketing site is a client-rendered React SPA, so an external fetch only sees the title shell. All copy findings below are from the source files (the authoritative truth), cross-checked against live API probes + deployed Fly secrets.

---

## "Ready to go?" verdict per flow

| Flow | Verdict | One-line reason |
|---|---|---|
| **Contact / "Talk to us" → reaches YCM** | 🟢 **GREEN** | Route is live; admin notification email delivers to platform admins (SMTP via Gmail, SPF/DKIM-aligned because FROM = the Gmail account, not the domain). |
| **Contact / "Talk to us" → confirmation email to the submitter** | 🔴 **NEEDS-FIX** | The handler sends **no confirmation email to the person who submitted.** The modal promises "We've got your message and will be in touch" but nothing is emailed back to them. |
| **Start free trial — Property Managers (PM)** | 🟡 **NEEDS-FIX** | Flow works (Stripe checkout, 21-day trial), but the `/signup` page shows **stale "$450/mo"** instead of the canonical per-door model. |
| **Start free trial — Self-Managed (SM)** | 🔴 **NEEDS-FIX** | Flow works mechanically, but the `/signup` page shows **stale "$30/mo / $50/mo"** — directly contradicting the pricing page ($129 / $3.75 / $3.50), and the Stripe price the user is actually charged maps to the old $30/$50 two-tier model. |
| **Signup → Stripe checkout → workspace provisioning** | 🟢 **GREEN** | Endpoint live, Stripe fully configured (keys + webhook + price IDs), 21-day trial, magic-link fallback on session failure. |
| **Google sign-in / auth** | 🟢 **GREEN** | `/api/auth/google` 302-redirects to Google with correct client_id + callback. OAuth secrets deployed. |
| **Nav + footer links** | 🟡 **NEEDS-FIX** | "About Us", "Careers", "Legal Resources", "Share", "Podcasts" footer links are dead (`href="#"`). |

---

## TOP BLOCKERS (the "works NOT ready to go" items)

### BLOCKER 1 — No confirmation email to the "Talk to us" submitter 🔴
- **What's broken:** `POST /api/public/demo-request` notifies YCM's platform admins (good) but **never emails the submitter a "we got your message" confirmation.** The UI claims one happened ("We've got your message and will be in touch shortly" + "Thank you!"), so the user *thinks* they're confirmed but receives nothing.
- **File:line:** `server/routes.ts:10963-10982` — only `sendPlatformAdminEmailNotification(...)` (to admins) + a fallback `sendPlatformEmail({ to: "contact@yourcondomanager.org" })`. There is **no second send to `email` (the submitter).**
- **Severity:** HIGH (trust/UX — a contact form that silently swallows the user's address with no acknowledgement reads as broken to a prospect).
- **Fix:** after the admin notification, add a second send to the submitter via `sendEmail` (the Resend-default wrapper, `server/email/send.ts`) — a branded "Thanks, we received your enquiry, we'll reply within 1 business day" auto-reply. Use `sendEmail` (not `sendPlatformEmail`) so it rides the same branded transactional template path as receipts/onboarding.

### BLOCKER 2 — Stale pricing on the live `/signup` page (the page users actually land on) 🔴
- **What's broken:** The pricing **page** (`/pricing`) is fully canonical, but every "Start free trial" CTA routes to `/signup?plan=...` (`plan-signup.tsx`), which renders **old prices**:
  - **Self-Managed:** `"From $30/mo"`, tier chips `"$30/mo"` / `"$50/mo"` — `client/src/pages/plan-signup.tsx:43, 86-87`.
  - **Property Manager:** `"$450/mo"` — `client/src/pages/plan-signup.tsx:56`.
  - Stale comment naming old SM tiers `Small ($89), Mid ($139), Large ($199)` — `:82-83`.
- **Why it renders:** `PlanPanel` shows `resolvedPrice ?? plan.price` (`:145`); `resolvedPrice` = `tier?.price` pulled from `SELF_MANAGED_TIERS` (the stale $30/$50 array, `:85-88`). So a user who just saw "$129 / $3.75 / $3.50" on `/pricing` lands on signup seeing "$30/mo". Direct continuity break + a pricing-promise mismatch.
- **Severity:** HIGH (a prospect sees two different prices for the same plan one click apart).
- **Fix:** replace `PLANS[*].price` + `SELF_MANAGED_TIERS` in `plan-signup.tsx` with the canonical model already encoded in `pricing.tsx:85-220` (SM: $129 flat 1–40 / $3.75/unit 41–100 / $3.50/unit 101–250 / Enterprise custom; PM: from $4/door, $4.50/$4.25/$4.00 tiers). Best: import the canonical tier tables from one shared module so the two pages can never drift again.

### BLOCKER 3 — Stripe price the SM trial actually charges may not match the canonical model 🟡→🔴 (verify)
- **What's broken / risk:** `POST /api/public/signup/start` resolves the SM price by a **two-tier split at 30 units** keyed `self-managed-small` / `self-managed-large` from the `STRIPE_PLAN_PRICE_IDS` JSON (`server/routes.ts:15810-15817`, comment `:15807` literally says "$30/mo … $50/mo"). But the canonical model is a **three-tier per-unit** model ($129 flat / $3.75 / $3.50). Fly has a *newer* granular secret set (`STRIPE_PRICE_SM_STARTER/STANDARD/PRO/ENT_MO|YR`) that the signup handler **does not read** — it only reads the legacy `STRIPE_PLAN_PRICE_IDS`.
- **File:line:** `server/routes.ts:15800-15817`.
- **Severity:** HIGH if the live `STRIPE_PLAN_PRICE_IDS` still points at $30/$50 Stripe Prices — then customers are *billed* the old price regardless of what any page says. (Could not read the secret's value; needs a one-line check: `flyctl secrets` can't reveal values — inspect the Stripe dashboard for the Price IDs in `STRIPE_PLAN_PRICE_IDS`.)
- **Fix:** point the signup handler at the canonical granular price IDs (the `STRIPE_PRICE_SM_*` set already deployed) and use the 3-tier unit bands, OR repopulate `STRIPE_PLAN_PRICE_IDS` with canonical Prices. **Confirm what the live JSON resolves to before trusting the trial billing.**

---

## Copy / continuity findings (prioritized)

### C1 — "Boards" vs "Communities" rename is half-done (continuity gap) 🟡
The rename is **complete on `/pricing`** (tier names "Small/Mid/Large **Community**", header comment "communities not complexes") but **NOT on `/` (landing) or `/solutions`**, which still use the **"board" persona** end-to-end:
- Persona key + default `useState<Persona>("board")` — `landing.tsx:41`, `solutions.tsx:43`.
- Visible labels: `"marketing.persona.board": "Board Members"` (`strings.en.ts:975`), `"landing.persona.board.badge": "For self-managed condo boards"` (`:1007`).
- All `landing.persona.board.*` / `solutions.board.*` strings.
- **Result:** landing/solutions say "boards", pricing says "communities" — inconsistent product language across the funnel. **Decision needed from William:** is the canonical term "communities" (then update landing/solutions strings + persona labels) or keep "boards" for the self-managed persona? Pick one and align all three pages.

### C2 — Stale prices in code comments / dead constants (cleanup) 🟢
`plan-signup.tsx` carries multiple `// PRICING STALE` self-flagged comments (`:43, 56, 67, 82-83`) and the dead `SELF_MANAGED_TIERS` array. These are the source of BLOCKER 2; clearing BLOCKER 2 clears these.

### C3 — Footer dead links 🟡
`client/src/components/site-footer.tsx`: `About Us` (`:43`), `Careers` (`:44`), `Legal Resources` (`:45`), social `Share` (`:66`), `Podcasts` (`:67`) all `href="#"` — they go nowhere. Either point them at real targets (e.g. Legal Resources → `/terms`, `/privacy`) or remove until ready. `Contact Us`/`Email` correctly → `mailto:contact@yourcondomanager.org`.

### C4 — Contact-address fan-out (intentional, but worth confirming) 🟢
Different surfaces use different addresses — all on `@yourcondomanager.org`, all plausibly routed: footer/sales-onepager → `contact@`; pricing "Contact sales"/Enterprise + plan-signup Enterprise → `sales@`; privacy → `privacy@`; terms → `legal@`; support/lock-screen → `support@`. **Confirm all six aliases are live and land in a monitored inbox** (per the YCM email routing memory, `contact@`/`sales@`/`admin@` → `yourcondomanagement@gmail.com`; verify `privacy@`, `legal@`, `support@` route too).

---

## Functional wiring — full trace (for the record)

**Contact / "Talk to us":**
`landing.tsx` "Talk to us" buttons → `setDemoModalOpen(true)` → `demo-request-modal.tsx` → `fetch POST /api/public/demo-request` → `routes.ts:10923` handler → `sendPlatformAdminEmailNotification` (to platform admins; `replyTo` = submitter so YCM can reply directly) with fallback to `contact@yourcondomanager.org`. **Live-probe: `POST {}` → `400 {"name and email are required"}` = route live + validating.** Sales-onepager "Talk to us" is a plain `mailto:` (`sales-onepager.tsx:131`) — fine.

**Email transport (does it actually deliver?):**
The demo handler uses `sendPlatformEmail` (the **SMTP-only** path in `email-provider.ts`, NOT the Resend wrapper). `getEmailConfig()` resolves SMTP from `GMAIL_SENDER_EMAIL` + `GMAIL_APP_PASSWORD` → host `smtp.gmail.com`. **Both are deployed Fly secrets**, so SMTP **is** configured → emails send (not "simulated"). Crucially, `EMAIL_FROM_ADDRESS` and `GMAIL_SENDER_EMAIL` **share the same Fly secret digest (`761394e7a4fd95c1`) → identical value** → the FROM is the *Gmail account itself*, not `noreply@yourcondomanager.org`. That **avoids the SPF/DKIM failure** the code comment warns about (`email-provider.ts:170-174`). `PLATFORM_ADMIN_EMAILS` is deployed → platform admins are seeded (`seed.ts:1150`) → the notification has real recipients. **Net: the enquiry reaches YCM. ✅**
*(Caveat: deliverability from a plain Gmail account is fine for low volume internal notifications; the transactional Resend path — `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` — is **not** deployed, so any future submitter-facing confirmation should go through `sendEmail` which falls back to the same Gmail SMTP today.)*

**Start free trial (both tracks):**
`pricing.tsx` CTAs → `setLocation("/signup?plan=self-managed" | "/signup?plan=<tier.ctaPlan>")` → `plan-signup.tsx` → `fetch POST /api/public/signup/start` → `routes.ts:15791`: creates Stripe customer + stub association/admin + Checkout Session (21-day trial, no CC upfront, success→`/signup/success`, cancel→`/pricing`) → returns `checkoutUrl` → client redirects. **Live-probe: `POST {}` → `400` validation = live.** Success page (`plan-signup-success.tsx`) calls `/api/public/signup/complete` → provisions workspace, sets session cookie, magic-link fallback, correct 21-day-trial fine print. **Stripe fully configured** (`PLATFORM_STRIPE_SECRET_KEY`, `..._WEBHOOK_SECRET`, full `STRIPE_PRICE_*` set deployed). Mechanically GREEN; the *price shown + price charged* are the open issues (BLOCKERS 2 & 3).

**Google sign-in:**
`onStartGoogleSignIn` → `window.location.assign("/api/auth/google?returnTo=...")` (`App.tsx:1334-1338`) → passport Google strategy (`server/auth.ts`). **Live-probe: `GET /api/auth/google` → `302 → accounts.google.com/o/oauth2/v2/auth?...client_id=593926100560-...` with callback `https://app.yourcondomanager.org/api/auth/google/callback`.** `GOOGLE_CLIENT_ID/SECRET/CALLBACK_*` all deployed. **GREEN.**

**Enterprise CTA:** plan-signup Enterprise submit → `mailto:sales@yourcondomanager.org` (`plan-signup.tsx:282`); pricing Enterprise tiers → `mailto:sales@...?subject=...` (`pricing.tsx:605, 839`). Correct.

---

## What I could NOT verify (and how to close it)
1. **The live value of `STRIPE_PLAN_PRICE_IDS`** (drives BLOCKER 3) — secrets can't be read via `flyctl`; check the Stripe dashboard for the Price IDs that JSON maps to and confirm they're the canonical Prices, not the old $30/$50 ones.
2. **End-to-end email *receipt*** — I deliberately did not submit a real enquiry (no spam). The code path + deployed SMTP secrets confirm delivery *should* work; a single real test submission to a throwaway address would close the loop (watch `yourcondomanagement@gmail.com` / the platform-admin inbox arrive).
3. **Deployed marketing copy** — SPA shell only via WebFetch; source-traced instead. A logged-in browser pass would visually confirm.
