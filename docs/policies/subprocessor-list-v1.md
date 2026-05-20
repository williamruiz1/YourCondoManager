# Subprocessor List

**YourCondoManager (YCM)**
**Effective Date:** May 20, 2026
**Version:** 1.0
**Owner:** yourcondomanagement@gmail.com

---

## 1. Purpose

This document is the canonical inventory of third-party services ("subprocessors") that YourCondoManager (YCM) uses to deliver its HOA-management platform. Each entry lists the subprocessor, the categories of data shared with them, the purpose, the data residency, and a link to their security or compliance documentation.

It is maintained as part of YCM's vendor management program (see [Information Security Policy §9](information-security-policy-v1.md) once the Phase 1 honest-claims rewrite of that doc lands). It is updated whenever a subprocessor is added, removed, or has a material change in scope.

---

## 2. Current Subprocessors

| Subprocessor                     | Service                                                            | Data Categories Shared                                                                                                                                              | Purpose                                                                                                                                                                                                                | Region                                                | Security & Compliance                                                                                              |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Fly.io, Inc.**                 | Application + database hosting                                     | All application data (encrypted at rest); logs; backups                                                                                                             | Run the YCM application server (Express + Vite SPA at `yourcondomanager.fly.dev`) and Postgres database                                                                                                                | US (configurable region; currently `iad` Ashburn, VA) | [Fly.io security overview](https://fly.io/docs/security/); SOC 2 in progress per Fly.io public statements          |
| **Neon, Inc.**                   | Managed Postgres                                                   | Application data (encrypted at rest)                                                                                                                                | Database storage and backups; underlying Postgres provider                                                                                                                                                             | US                                                    | [Neon security](https://neon.tech/security); SOC 2 Type II                                                         |
| **Stripe, Inc.**                 | Payments — Connect Standard + Subscription billing                 | HOA admin email; subscription tier; HOA owner payment-method tokens; charge records; Connect platform account metadata; statement-descriptor (`YCM-CHRY HILL HOA`) | Process HOA owner monthly-assessment payments via Stripe Connect Standard (HOA-as-merchant model); collect YCM platform SaaS subscription fees from HOA admins. Live in production (`PLATFORM_STRIPE_*` Fly secrets deployed). | US (primary)                                          | [Stripe security](https://stripe.com/docs/security); PCI DSS Level 1, SOC 1 + SOC 2, ISO 27001                     |
| **Plaid Inc.**                   | Bank-account aggregation (HOA bank-feed reconciliation)            | Plaid access tokens; HOA operating-account metadata (last 4, name, type); transaction history                                                                       | Reconcile HOA bank-account deposits against expected owner assessment payments (`server/services/bank-feed/plaid-provider.ts`). **Sandbox live** as of 2026-05; **Production access pending** (founder-os#1266).         | US                                                    | [Plaid security](https://plaid.com/safety/); SOC 2 Type II, ISO 27001                                              |
| **Google LLC** (Google Identity) | OAuth 2.0 authentication                                           | Email address; name; Google subject identifier (`sub`); profile picture URL                                                                                         | Sign-in for HOA admin users (sole platform-admin authentication mechanism; YCM stores no passwords for admins). Owner portal uses separate token-based access.                                                          | US                                                    | [Google Cloud security](https://cloud.google.com/security); SOC 1/2/3, ISO 27001/27017/27018/27701, PCI DSS, HIPAA |
| **Cloudflare, Inc.**             | DNS + email routing                                                | DNS records for `yourcondomanager.org`; inbound email forwarding for `*@yourcondomanager.org`                                                                       | DNS authority for the production domain; forward operator email aliases to a single inbox                                                                                                                              | US/Global edge                                        | [Cloudflare security](https://www.cloudflare.com/trust-hub/); SOC 2 Type II, ISO 27001, PCI DSS                    |
| **Sentry** (Functional Software) | Application performance + error monitoring                         | Stack traces; request URLs (PII-scrubbed via `beforeSend` hook); release/environment tags                                                                           | Capture runtime errors + p95 performance metrics from the YCM production app (`SENTRY_DSN` Fly secret deployed via PR #125 / founder-os#1030)                                                                          | US                                                    | [Sentry security](https://sentry.io/security/); SOC 2 Type II, ISO 27001, HIPAA, PCI DSS                           |
| **GitHub, Inc.** (Microsoft)     | Source-code hosting + CI                                           | Source code; commit history; CI logs; Dependabot vulnerability alerts                                                                                               | Version control + CI pipeline (`williamruiz1/YourCondoManager`); Dependabot weekly cadence per founder-os#1586 Trust WS1                                                                                                | US/Global                                             | [GitHub security](https://github.com/security); SOC 1/2, FedRAMP Moderate, ISO 27001                               |
| **Resend, Inc.**                 | Transactional email delivery                                       | Recipient email; email subject; rendered email HTML/text body (assessment notices, password resets, dispatch notifications, etc.)                                  | Deliver transactional emails to HOA owners and admins (`EMAIL_FROM=noreply@yourcondomanager.org`; `RESEND_API_KEY` Fly secret deployed via PR #126 / founder-os#1042)                                                  | US                                                    | [Resend security](https://resend.com/security); SOC 2 Type II                                                      |

---

## 3. Pending / Future Subprocessors

These are subprocessors that may be added as roadmap features ship. Each will move to §2 with a clear effective date when the corresponding feature goes live.

| Subprocessor                   | Service                                | Status  | Triggering Feature                                           |
| ------------------------------ | -------------------------------------- | ------- | ------------------------------------------------------------ |
| **Anthropic PBC**              | Claude AI API (Sonnet 4.6 + Haiku 4.5) | Planned | YCM AI Assistant Phase 1 (founder-os#1256 — currently Phase 0 mock adapter; real LLM wiring pending) |
| **Plaid Inc.** (production)    | Bank-account aggregation               | Pending | Currently Sandbox-only; production access submission pending per founder-os#1266 |

When AI Assistant Phase 1 activates, Anthropic will receive HOA-owner natural-language prompts and document text. It will not receive credentials, full database contents, or session data. Per-call cost is tracked via the `ai_assistant_interactions` table (founder-os#1316).

---

## 4. Removed / Historical Subprocessors

None as of v1.0. This section tracks subprocessors that were used historically but are no longer part of the data flow.

---

## 5. Subprocessor Engagement Process

Before engaging a new subprocessor with access to user data, YCM:

1. **Reviews** the subprocessor's published security documentation and compliance certifications
2. **Evaluates** the data scope (does the subprocessor need this data; can scope be narrowed)
3. **Confirms** the subprocessor has a documented Data Processing Agreement (DPA) or equivalent contract for the data categories shared
4. **Documents** the engagement in this list before production data flows to the new subprocessor
5. **Notifies** users via Privacy Policy update if the change is material (e.g., new category of data shared, new region)

---

## 6. Notice of Subprocessor Changes

For material changes (new subprocessor receiving new categories of personal or financial data; removal of a subprocessor; significant change in data residency):

- This document is updated within 7 days of the change
- The Privacy Policy is updated to match (cross-reference once the Phase 1 honest-claims pass of `privacy-policy-v1.md` lands)
- Users may be notified by email if the change affects their existing data

Material-change definition aligns with industry DPA standard subprocessor-notice clauses (typically 30-day advance notice for substantive changes).

---

## 7. Inquiries

Questions about YCM's subprocessor list, vendor management practices, or to request a Data Processing Agreement: **yourcondomanagement@gmail.com**.

---

## Version history

- **v1.0 (2026-05-20):** Initial canonical list per founder-os#1783 (security & compliance baseline Cherry Hill #1276 gate). Subprocessor inventory verified live against `flyctl secrets list -a yourcondomanager` and the YCM portfolio ledger at `wiki/portfolio/ycm.md` (founder-os).
