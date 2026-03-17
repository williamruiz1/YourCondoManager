---
name: Owner Portal Improvement Initiative
description: Comprehensive owner portal overhaul covering bugs, branding, UX, financial dashboard, contact hierarchy, and notices — sourced from verbal stakeholder feedback on 2026-03-17
type: project
---

The owner portal is a single-page React component at `client/src/pages/owner-portal.tsx` (2,744 lines). It serves HOA owners with OTP-based login and a scrolling card layout. A major improvement initiative was scoped on 2026-03-17 from direct verbal feedback.

**Why:** The portal works functionally but is unpolished, poorly organized, and has two confirmed bugs affecting real users. It needs to be the primary owner-facing product surface.

**How to apply:** When scoping portal tasks, use the priority framework below. Financial dashboard is the highest-priority feature area for owners. Bugs are P0 and should block any release.

## Key bugs identified

1. **OTP email not sending for some users** — The `emailProviderReady` check in `server/routes.ts` line 7014 uses a flawed heuristic: `Boolean(process.env.SENDGRID_API_KEY || process.env.SMTP_HOST || process.env.GOOGLE_OAUTH_CLIENT_ID)`. It includes `GOOGLE_OAUTH_CLIENT_ID` as a proxy for SMTP being configured, which is wrong. Emails silently fail when only Google OAuth is set. Confirmed: `williammarieS11@gmail.com` (has owner/unit association) does not receive OTP; `chcmgmt18` works.
2. **Localhost URL in email footer** — `server/email-provider.ts` line 358 defaults `APP_BASE_URL` to `http://localhost:5000`. When `APP_BASE_URL` env var is unset in production, every outbound email footer shows a localhost link.

## Architecture notes

- Portal auth is separate from admin auth — uses `portal_access` table and `portal_login_tokens` table (not admin user system)
- OTP route: `POST /api/portal/request-login` and `POST /api/portal/verify-login` in `server/routes.ts`
- Email footer appended in `sendPlatformEmail()` in `server/email-provider.ts`
- Financial data: `GET /api/portal/financial-dashboard` returns `{ balance, totalCharged, totalPaid, feeSchedules, nextDueDate, paymentPlan, recentEntries }`
- Portal session: stored in localStorage as `portalAccessId`, passed as `x-portal-access-id` header

## Priority framework

- P0: Bugs (OTP delivery, localhost URL)
- P1: Branding and UX polish (login page, email template, welcome text, layout)
- P2: New features (financial dashboard improvements, unit/association context, hierarchical contacts, notices section)
- P3: Future (payment methods tab — dependent on payment processor integration)

## Proposed tab/section structure (from stakeholder)

1. Financial Dashboard (high priority)
2. Units & Contact Information (core)
3. Maintenance Requests
4. Payments / Payment Methods (lower priority, payment processor dependency)
