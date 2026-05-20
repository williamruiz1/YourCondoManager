> **⚠️ STATUS: DRAFT — NOT YET PARTNER-READY**
>
> This document was derived from PlinthKeep's canonical policy (PR #105) via placeholder substitution. Plinthkeep's domain is single-family-rental; YourCondoManager's domain is HOA management. The high-level structure transfers but **role taxonomy** (HOA boards / owners / occupancy-typed tenants / vendors / platform admins) and **feature claims** (HOA assessments, Stripe Connect Standard for HOA-as-merchant, Plaid bank-feed reconciliation, multi-tenant association isolation) need a YCM-specific honest-claims rewrite per founder-os#1783 Phase 1 follow-on.
>
> The fully customized YCM-specific version is the **subprocessor-list-v1.md** file in this directory — that one is partner-questionnaire-ready and reflects YCM's actual stack as of 2026-05-20. The other policies follow once the Phase 1 honest-claims pass lands.
>
> ---

# Information Security Policy

**YourCondoManager (YCM)**
**Effective Date:** May 20, 2026
**Version:** 1.2
**Owner:** yourcondomanagement@gmail.com

---

## 1. Purpose and Scope

This Information Security Policy establishes the security controls, practices, and responsibilities for YourCondoManager (YCM) (yourcondomanager.org). It applies to all systems, data, and personnel involved in operating or administering YourCondoManager (YCM), including third-party service providers with access to YourCondoManager (YCM) systems or data.

The goal is to protect the confidentiality, integrity, and availability of information entrusted to YourCondoManager (YCM) by landlords, property managers, tenants, and vendors — and to comply with requirements imposed by financial service partners, including Plaid.

This policy is reviewed annually and updated as needed when significant changes occur.

---

## 2. Security Principles

**Least Privilege:** every user, service account, and process operates with the minimum permissions necessary. Access is granted explicitly; no access is assumed by default.

**Defense in Depth:** security controls are layered. No single control is the sole protection for sensitive data.

**Secure by Default:** new features and configurations default to the most secure option. Security is designed in from the beginning.

**Tenant Isolation:** landlords see only their properties and tenants. Tenants see only their own lease and payment data. Vendors see only work orders assigned to them. There is no cross-account data access at any role level.

**Transparency:** security practices are documented and available for review by users and partners.

---

## 3. Access Control

### 3.1 User Authentication

All YourCondoManager (YCM) user accounts are authenticated via **Google OAuth 2.0** — YourCondoManager (YCM) does not store or transmit passwords. The authentication stack uses:

- **Google OAuth 2.0:** OAuth tokens validated server-side on every request via Google's public signing keys
- **Signed JWTs:** issued by YourCondoManager (YCM) after a successful OAuth callback. Signed with a Fly.io-secret-stored `JWT_SECRET` (HS256). Used for subsequent session-validation requests
- **Session management:** HTTP-only, Secure, SameSite=Strict session cookies to prevent XSS and CSRF attacks
- **Session expiration:** sessions expire after the configurable `SESSION_TTL_DAYS` window (default: 7 days)

### 3.2 Role-Based Access Control (RBAC)

YourCondoManager (YCM) implements role-based access control with the following roles:

| Role                        | Access                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Platform Admin              | All properties, all accounts, admin dashboard                                          |
| Landlord / Property Manager | Their own properties, tenants in their properties, financial data for their properties |
| Tenant                      | Their own lease, payment history, maintenance requests                                 |
| Vendor                      | Work orders assigned to them; no lease or financial data                               |

Every API endpoint and data access point enforces the correct role. No cross-role or cross-landlord data leakage is permitted. The role check is performed server-side on every request — the client role declaration is not trusted.

### 3.3 Administrative Access

- Admin accounts are provisioned explicitly by email address
- Admin actions are logged with user ID, timestamp, and action type
- Administrative interfaces require authenticated admin sessions; no publicly accessible admin endpoints
- Admin account list is reviewed quarterly

**Current admin accounts:**

- yourcondomanagement@gmail.com (platform admin)

### 3.4 Service Account and Third-Party Access

Service accounts have only the permissions required for their specific function. All credentials are stored as Fly.io secrets and are never committed to version control.

---

## 4. Data Protection

### 4.1 Encryption in Transit

All data between users and YourCondoManager (YCM) servers is encrypted with TLS 1.2 or higher. HTTP connections redirect to HTTPS. HSTS headers are configured.

### 4.2 Encryption at Rest

- **Database encryption:** Fly.io / Neon Postgres provides AES-256 encryption at the storage layer by default
- **Application-layer encryption — Plaid access tokens:** Plaid Phase 1 was scaffolded May 20, 2026 (PR #104) with the `plaid-bank-aggregation` feature flag OFF in production. Tokens currently land in the `plaid_items.plaid_access_token` column protected by Postgres at-rest encryption only and access-gated through authenticated API. **Before the feature flag is enabled in production, application-layer AES-256 encryption keyed by `PLAID_TOKEN_ENCRYPTION_KEY` (Fly.io secret) is a mandatory gate.** This is tracked as a Phase 2 work item and called out as a SEV-2 follow-up in PR #104's description; the gate is enforced by the feature flag remaining OFF until the encryption ships.
- **Application-layer encryption — Stripe:** Stripe customer/subscription identifiers stored in `stripe_customers` and `stripe_subscriptions` tables (PR #58, live as of May 2026) are non-secret references; the underlying payment-method data never enters YourCondoManager (YCM)'s database — Stripe holds it. Webhook signatures verified via `STRIPE_WEBHOOK_SECRET` (Fly.io secret).

### 4.3 Data Classification

| Classification   | Examples                                          | Handling                                                 |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------- |
| Highly Sensitive | Bank credentials, payment card numbers            | Not stored by YourCondoManager (YCM); processed only by Plaid/Stripe |
| Sensitive        | Plaid access tokens, OAuth tokens, session tokens | Application-layer encryption; stored in secrets manager  |
| Personal         | Names, emails, phone numbers, addresses           | Encrypted at rest; RBAC-controlled access                |
| Internal         | Lease records, rent history, maintenance records  | Encrypted at rest; RBAC-controlled access                |
| Non-confidential | Anonymized usage statistics                       | Standard protection                                      |

### 4.4 Financial Data Handling

> **Status as of policy v1.2 (2026-05-20):** Stripe billing is live in production (PR #58 + #59). Plaid Phase 1 is scaffolded with Sandbox keys; the `plaid-bank-aggregation` feature flag is OFF in production. Plaid production access application was submitted to Plaid May 20, 2026 and is pending review. Application-layer Plaid access-token encryption is a gate before the feature flag is enabled.

**Stripe (live):**

- All payment-method data (card numbers, expirations, CVV) is captured and stored exclusively by Stripe. YourCondoManager (YCM) never receives or stores card data.
- YourCondoManager (YCM) stores only Stripe's customer/subscription identifiers, subscription tier, and billing status — no sensitive payment data.
- Webhook events are signature-verified via `STRIPE_WEBHOOK_SECRET` and idempotency-tracked in the `stripe_webhook_events` table to prevent replay.

**Plaid (Sandbox active; Production pending):**

- We never receive or store bank login credentials. All credential entry goes through Plaid Link directly.
- v1 scope is **landlord business-expense ledger sync only** — using Plaid Transactions + Identity to auto-categorize the landlord's own bank-account activity. Tenant rent collection is a separate roadmap item (Stripe Connect, not Plaid).
- Auth + Balance are checked in our Plaid product set as future-proof options but unused in v1 routes.
- Plaid access tokens are stored in `plaid_items.plaid_access_token` with Postgres at-rest encryption (Neon AES-256). Application-layer AES-256 encryption is gated before production feature-flag enable (see §4.2).
- Per-user data isolation: each Plaid Item is scoped to a single `user_id`. Every API access path filters by the authenticated user's ID; cross-user access is impossible at the application + database query layer.
- Plaid-sourced transaction data lives in `plaid_transactions`, accessible only to the account holder.

---

## 5. Secure Development

### 5.1 Code Security Standards

- **Input validation:** all API inputs validated with Zod at the API boundary before processing
- **Parameterized queries:** all database queries use the Drizzle ORM; raw SQL string interpolation is prohibited
- **Output encoding:** all user-supplied content rendered in HTML is properly encoded to prevent XSS
- **CSRF protection:** SameSite=Strict session cookies and CSRF tokens on state-mutating endpoints

### 5.2 Secrets Management

- All secrets stored as Fly.io secrets for the `plinthkeep` app
- Secrets never committed to version control
- `.env` files listed in `.gitignore`
- `.env.example` contains only placeholder values
- Secrets rotated quarterly per the Security Compliance Runbook

**Keys managed as Fly.io secrets (live):**

- `SESSION_SECRET` — signs session cookies
- `JWT_SECRET` — signs YourCondoManager (YCM)-issued JWTs after OAuth callback
- `DATABASE_URL` — Neon/Fly.io Postgres connection string
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `STRIPE_SECRET_KEY` — Stripe API (live as of PR #58 + #59, May 2026)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signature verification
- `PLAID_CLIENT_ID` + `PLAID_SECRET` + `PLAID_ENV` — Plaid API (Sandbox active as of May 20, 2026)
- `ANTHROPIC_API_KEY` — Claude API for AI features (set when Phase 1 AI ships)

**Planned secrets (set before Plaid feature flag is enabled in production):**

- `PLAID_TOKEN_ENCRYPTION_KEY` — application-layer AES-256 encryption of Plaid access tokens at rest; gate before `plaid-bank-aggregation` feature flag is enabled

### 5.3 Dependency Vulnerability Management

- `npm audit --audit-level=high` runs in CI on every pull request
- Dependabot is configured on the `williamruiz1/plinthkeep` GitHub repository
- High and critical vulnerabilities are patched within SLAs defined in `docs/policies/vulnerability-management-program-v1.md`

### 5.4 Code Review

All code changes go through pull request review before merging to main. Authentication, authorization, data handling, and encryption changes receive security-focused review.

---

## 6. Infrastructure Security

### 6.1 Hosting

YourCondoManager (YCM) is hosted on Fly.io:

- Physical and network security managed by Fly.io
- Application isolation between Fly.io apps
- Automated TLS certificate management via Let's Encrypt
- DDoS mitigation at the network layer

**Fly.io app name:** `plinthkeep` (production-live; serving yourcondomanager.org)

### 6.2 Network Security

- Application accessible only over HTTPS (port 443)
- Database not publicly accessible; restricted to application servers within Fly.io's internal network
- Admin endpoints protected by role-based authentication

### 6.3 Monitoring and Alerting

- Application errors monitored and alerted to yourcondomanagement@gmail.com
- Failed authentication attempts logged
- Admin security dashboard shows active admin accounts and recent authentication events

---

## 7. Incident Response

If a security incident is suspected or confirmed, we follow the Incident Response Runbook at `toolbox/runbooks/incident-response-runbook.md`. Key steps:

1. **Containment:** isolate affected systems
2. **Assessment:** determine nature and scope
3. **Notification:** notify affected users within 72 hours of confirmed breach; notify Plaid immediately upon confirmation of any incident involving Plaid data
4. **Remediation:** address root cause and restore operations
5. **Post-incident review:** document and improve controls

Security incidents are reported to yourcondomanagement@gmail.com.

### Responsible Disclosure

To report a vulnerability: email yourcondomanagement@gmail.com, subject "Security Vulnerability Report — YourCondoManager (YCM)." We acknowledge within 2 business days and respond within 14 days. We do not pursue legal action against good-faith researchers.

---

## 8. Business Continuity

### 8.1 Backups

- **Database:** Fly.io Postgres automated daily backups, 7-day retention
- **Recovery Point Objective (RPO):** 24 hours
- **Recovery Time Objective (RTO):** 4 hours

### 8.2 Availability Target

YourCondoManager (YCM) targets 99.5% monthly uptime. Planned maintenance is scheduled during off-peak hours.

---

## 9. Vendor Management

Vendors with access to YourCondoManager (YCM) data are inventoried in the canonical [Subprocessor List](subprocessor-list-v1.md). Summary table:

| Vendor                | Purpose                                            | Status                                                                                  |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Fly.io                | Application + database hosting                     | Live                                                                                    |
| Neon                  | Managed Postgres (via Fly)                         | Live                                                                                    |
| Stripe                | SaaS subscription billing                          | Live (PR #58 + #59, May 2026)                                                           |
| Plaid Technologies    | Bank-account aggregation (landlord expense ledger) | Sandbox active; Production access submitted 2026-05-20; flag OFF until encryption ships |
| Google (Google Cloud) | OAuth 2.0 authentication                           | Live                                                                                    |
| Cloudflare            | Email Routing (operator aliases → ops gmail)       | Live                                                                                    |
| GitHub                | Source control + CI                                | Live                                                                                    |

Refer to [Subprocessor List v1.0](subprocessor-list-v1.md) for full data categories, regions, and compliance documentation per subprocessor.

New vendors with access to user data are evaluated for security posture before engagement.

---

## 10. Policy Enforcement and Review

This policy is reviewed annually as part of the Security Compliance Runbook. Non-compliance may result in access revocation. Questions: yourcondomanagement@gmail.com.

Operational cadence is enforced by `.github/workflows/security-compliance-calendar.yml` which auto-files an Issue for each review. See `docs/policies/security-compliance-calendar-v1.md`.

---

**Version history:**

- v1.2 (2026-05-20): reflects Stripe Phase A live (PR #58 + #59), Plaid Phase 1 scaffolded with Sandbox active + production application submitted (PR #104); honest token-encryption posture with feature-flag gate; expanded secrets inventory; vendor table now points at the canonical Subprocessor List v1.0; production-live status for Fly app.
- v1.1 (2026-05-11): post-audit revisions (Issue #429 Stream 4) — §3.1 dropped vacuous password/bcrypt claim and reflects OAuth-only auth; §4.2 + §4.4 gated Plaid sections as planned/not-yet-shipped.
- v1.0 (2026-05-10): initial policy
