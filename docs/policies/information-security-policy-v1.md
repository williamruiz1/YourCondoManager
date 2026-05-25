# Information Security Policy

**YourCondoManager (YCM)**
**Effective Date:** May 25, 2026
**Version:** 2.0
**Owner:** yourcondomanagement@gmail.com

---

## 1. Purpose and Scope

This Information Security Policy establishes the security controls, practices, and responsibilities for YourCondoManager (YCM) (yourcondomanager.org). It applies to all systems, data, and personnel involved in operating or administering YCM, including third-party service providers with access to YCM systems or data.

The goal is to protect the confidentiality, integrity, and availability of information entrusted to YCM by HOA boards, owners, tenants, vendors, and platform admins — and to comply with requirements imposed by financial service partners, including Stripe and Plaid.

This policy is reviewed annually and updated as needed when significant changes occur.

---

## 2. Security Principles

**Least Privilege:** every user, service account, and process operates with the minimum permissions necessary. Access is granted explicitly; no access is assumed by default.

**Defense in Depth:** security controls are layered. No single control is the sole protection for sensitive data.

**Secure by Default:** new features and configurations default to the most secure option. Security is designed in from the beginning.

**Association Isolation:** every HOA association is a fully isolated tenant of the platform. Board members and owners of one association cannot read, write, or enumerate data belonging to another association. Isolation is enforced at the database query layer via the `associationId` column on every multi-tenant table.

**Role Isolation Within an Association:** board members see association-wide data they are entitled to under their board role; owners see only their own unit, ledger, and payments; tenants (renters of owner units) see only what their landlord-owner has chosen to expose; vendors see only the work orders or invoices assigned to them; YCM platform admins see what the canonical admin role taxonomy permits.

**Transparency:** security practices are documented and available for review by users and partners.

---

## 3. Access Control

### 3.1 User Authentication

YCM has two authentication paths, both passwordless server-side:

- **YCM platform admins and board members with a YCM admin login:** authenticate via **Google OAuth 2.0**. OAuth tokens are validated server-side on every request via Google's public signing keys. YCM does not store, hash, or transmit passwords for these users.
- **Owners and board members accessing the resident/owner portal:** authenticate via the `portal_access` token-based provisioning model (invite → activate → session). No passwords are stored for portal users either.

After a successful OAuth or portal activation, YCM issues a server-managed session backed by `express-session`:

- **Session cookies:** HTTP-only, `Secure`, `SameSite=Strict`
- **Session storage:** server-side via `connect-pg-simple` against the application Postgres database; cookies carry an opaque session ID, never user data
- **Session expiration:** controlled by `SESSION_MAX_AGE_MS` (Fly secret); rotation supported by rotating `SESSION_SECRET`

### 3.2 Role-Based Access Control (RBAC)

YCM implements role-based access control with two distinct enum systems matching the live database schema (`shared/schema.ts`):

**Admin roles** (`admin_user_role` enum — for YCM admin console + assisted-management staff):

| Role | Access |
|---|---|
| `platform-admin` | Full cross-association access; YCM platform staff only |
| `board-officer` | One association; full board-level rights |
| `assisted-board` | Board member receiving YCM-assisted management |
| `pm-assistant` | YCM property-management assistant operating on behalf of one or more associations |
| `manager` | Association manager; scoped via `admin_association_scopes` |
| `viewer` | Read-only, scoped access |

**Portal roles** (`portal_access_role` enum — for the owner/board-member portal):

| Role | Access |
|---|---|
| `owner` | Their own unit(s), ledger, payments, assessments, maintenance requests |
| `board-member` | Board-package view; combined with a row in `board_roles` (president / treasurer / secretary / other) for specific privileges |

**Occupancy types** (`occupancy_type` enum on unit ownerships):

| Type | Meaning |
|---|---|
| `OWNER_OCCUPIED` | The owner lives in the unit |
| `TENANT` | The unit is rented to a tenant; the owner is the landlord-of-record |

Tenants (the renter occupants of `TENANT`-type units) are **not** first-class portal users in v1. Tenant identity flows through their landlord-owner; only the landlord-owner appears in the owner portal. Adding a tenant-direct portal access path is on the roadmap (founder-os#1780-followup) but not in production.

**Vendors** are managed as records (`vendors` table) by the board or platform admin; they do not authenticate against the YCM portal in v1.

Every API endpoint and data access point enforces (a) the correct association context (`associationId`) and (b) the correct role within that association. No cross-association or cross-role data leakage is permitted. The role check is performed server-side on every request — the client role declaration is not trusted.

### 3.3 Administrative Access

- Platform-admin accounts are provisioned by adding the email to `PLATFORM_ADMIN_EMAILS` (Fly secret) and are created on first OAuth sign-in
- Admin actions are logged with `admin_user_id`, timestamp, and action type in the application audit log
- Administrative interfaces require an authenticated admin session; no publicly accessible admin endpoints
- Admin account list is reviewed quarterly per the Security Compliance Calendar

**Current platform-admin accounts:**

- yourcondomanagement@gmail.com

### 3.4 Service Account and Third-Party Access

Service accounts (Stripe API key, Plaid client ID + secret, Google OAuth client, Anthropic API key) have only the permissions required for their specific function. All credentials are stored as Fly.io secrets and are never committed to version control. The canonical inventory of subprocessors and their data scope lives in the [Subprocessor List](subprocessor-list-v1.md).

---

## 4. Data Protection

### 4.1 Encryption in Transit

All data between users and YCM servers is encrypted with TLS 1.2 or higher. HTTP connections redirect to HTTPS. HSTS headers are configured at the Fly.io edge.

### 4.2 Encryption at Rest

- **Database encryption:** Neon Postgres (via Fly.io) provides AES-256 encryption at the storage layer by default
- **Application-layer encryption — Plaid access tokens:** Plaid item access tokens are stored in `bank_connections.access_token_encrypted` and are encrypted at the application layer with AES-256 keyed by `PLAID_TOKEN_ENCRYPTION_KEY` (deployed as a Fly secret). The encrypted column protects tokens against database-snapshot exposure, not just storage-media compromise.
- **Stripe credentials & webhook signatures:** Stripe API keys live exclusively in Fly secrets (`PLATFORM_STRIPE_SECRET_KEY`). Webhook signatures are verified via `PLATFORM_STRIPE_WEBHOOK_SECRET` on every Stripe-originated request. YCM does not store payment-method numbers — Stripe holds them.

### 4.3 Data Classification

| Classification | Examples | Handling |
|---|---|---|
| Highly Sensitive | Bank login credentials, payment card numbers | Not stored by YCM; processed only by Plaid/Stripe |
| Sensitive | Plaid access tokens, OAuth tokens, session IDs, Stripe Connect account secrets | Application-layer encryption (Plaid) + secrets-store-only (Stripe, OAuth) |
| Personal (PII) | Owner / board-member / tenant names, emails, phone numbers, unit + property addresses | Encrypted at rest; RBAC + association-scoped query enforcement |
| Internal | Assessment ledgers, owner payment history, board packages, maintenance records | Encrypted at rest; RBAC + association-scoped query enforcement |
| Non-confidential | Anonymized usage statistics | Standard protection |

### 4.4 Financial Data Handling

> **Status as of policy v2.0 (2026-05-25):**
> - **Stripe Connect Standard** is live in production for HOA-as-merchant payment collection. Owner monthly-assessment payments via ACH (`us_bank_account`) are processed; each HOA onboards as a Standard Connect sub-merchant under the YCM platform account. Closed-out via founder-os#968.
> - **Plaid Sandbox** is live for bank-feed reconciliation; the application-layer token encryption is deployed (`PLAID_TOKEN_ENCRYPTION_KEY` in Fly secrets). The owner-side Plaid Link flow was unblocked in founder-os#1780. **Plaid Production access is not yet provisioned** — there is no `PLAID_SECRET_PRODUCTION` in Fly secrets as of this policy date.

**Stripe (Stripe Connect Standard — live):**

- All payment-method data (bank account numbers, routing numbers, card data if added later) is captured and stored exclusively by Stripe. YCM never receives or stores bank account or card numbers.
- YCM stores only Stripe identifiers (Connect account IDs, payment intent IDs, charge IDs) on its own tables; the underlying payment-method data never enters the YCM database.
- Webhook events are signature-verified via `PLATFORM_STRIPE_WEBHOOK_SECRET` and processed idempotently.
- Statement descriptor is set per HOA so the owner's bank statement shows the right HOA name (e.g. `YCM-CHRY HILL HOA`) rather than a generic platform string.
- ACH is the v1 owner-payment rail (`payment_method_types: ["us_bank_account"]`, instant verification via Stripe Financial Connections).

**Plaid (bank-feed reconciliation — Sandbox live, Production pending):**

- YCM never receives or stores bank login credentials. All credential entry goes through Plaid Link directly.
- v1 scope is **HOA bank-feed reconciliation** — pulling association bank-account transactions into the `bank_transactions` table and reconciling them against expected owner assessment payments. The owner-side Plaid Link flow (owner connects their own bank for ACH pay-flow) was unblocked in founder-os#1780.
- Plaid access tokens are stored in `bank_connections.access_token_encrypted` with application-layer AES-256 encryption (key `PLAID_TOKEN_ENCRYPTION_KEY` in Fly secrets) plus Postgres at-rest AES-256 (Neon default).
- Association isolation: every `bank_connections`, `bank_accounts`, and `bank_transactions` row carries an `associationId`. Every API access path filters by the authenticated session's association context; cross-association access is impossible at the application + database query layer.
- Plaid product set in production app: `PLAID_PRODUCTS` Fly secret defines the requested scopes; v1 uses Transactions (with Identity available for owner-side flow when production is provisioned).

---

## 5. Secure Development

### 5.1 Code Security Standards

- **Input validation:** all API inputs validated with Zod at the API boundary before processing
- **Parameterized queries:** all database queries use the Drizzle ORM; raw SQL string interpolation is prohibited
- **Output encoding:** all user-supplied content rendered in HTML is properly encoded to prevent XSS
- **CSRF protection:** `SameSite=Strict` session cookies; state-mutating endpoints additionally validate origin / referrer where applicable

### 5.2 Secrets Management

- All secrets stored as Fly.io secrets for the `yourcondomanager` app
- Secrets never committed to version control
- `.env` files listed in `.gitignore`
- `.env.example` contains only placeholder values
- Secrets rotated per the Security Compliance Calendar (`docs/policies/security-compliance-calendar-v1.md`)

**Keys managed as Fly.io secrets (live in production as of 2026-05-25):**

- `SESSION_SECRET` — signs session cookies
- `DATABASE_URL` — Neon/Fly.io Postgres connection string
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `PLATFORM_STRIPE_SECRET_KEY` — Stripe Connect platform API key (live)
- `PLATFORM_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (frontend init)
- `PLATFORM_STRIPE_WEBHOOK_SECRET` — Stripe webhook signature verification
- `PLAID_CLIENT_ID` + `PLAID_SECRET_SANDBOX` + `PLAID_ENV` — Plaid API (Sandbox active)
- `PLAID_TOKEN_ENCRYPTION_KEY` — application-layer AES-256 encryption of Plaid access tokens at rest
- `ANTHROPIC_API_KEY` — Claude API for AI Assistant features (current Phase 0 mock + real-LLM path)
- `GMAIL_APP_PASSWORD` + `GMAIL_SENDER_EMAIL` — outbound transactional email via Gmail SMTP
- `ADMIN_API_KEY` — server-to-server admin API authentication
- `AUTH_RESTORE_SECRET` — auth-restore token signing for break-glass admin recovery

**Pending production rollout (not currently in Fly secrets):**

- `PLAID_SECRET_PRODUCTION` — required before any non-Sandbox Plaid traffic
- `RESEND_API_KEY` — Resend client code exists in the repo as a configurable fallback (`server/email/resend-client.ts`); production email path is currently SMTP via Gmail. Resend may be promoted in a future release.
- `SENTRY_DSN` — application error monitoring; observability wiring is dynamic-import-gated and inactive until the DSN + `@sentry/node` are added together.

### 5.3 Dependency Vulnerability Management

- `npm audit --audit-level=high` runs in CI on every pull request
- Dependabot is configured on the `williamruiz1/YourCondoManager` GitHub repository
- High and critical vulnerabilities are patched within SLAs defined in `docs/policies/vulnerability-management-program-v1.md`

### 5.4 Code Review

All code changes go through pull request review before merging to main. Authentication, authorization, data handling, financial flows, and encryption changes receive security-focused review.

---

## 6. Infrastructure Security

### 6.1 Hosting

YCM is hosted on Fly.io:

- Physical and network security managed by Fly.io
- Application isolation between Fly.io apps
- Automated TLS certificate management via Let's Encrypt
- DDoS mitigation at the network layer

**Fly.io app name:** `yourcondomanager` (production-live; serving yourcondomanager.org)

### 6.2 Network Security

- Application accessible only over HTTPS (port 443)
- Database not publicly accessible; restricted to application servers within Fly.io's internal network
- Admin endpoints protected by role-based authentication

### 6.3 Monitoring and Alerting

- Application errors logged at the server and surfaced to the platform admin via the admin dashboard
- Failed authentication attempts logged in the application audit log
- Admin security view shows active admin accounts and recent authentication events
- Sentry-based external error monitoring is **not yet active** — see §5.2 pending list

---

## 7. Incident Response

If a security incident is suspected or confirmed, we follow the Incident Response Runbook at `toolbox/runbooks/incident-response-runbook.md`. Key steps:

1. **Containment:** isolate affected systems
2. **Assessment:** determine nature and scope
3. **Notification:** notify affected users within 72 hours of confirmed breach; notify Plaid and Stripe immediately upon confirmation of any incident involving their data or credentials
4. **Remediation:** address root cause and restore operations
5. **Post-incident review:** document and improve controls

Security incidents are reported to yourcondomanagement@gmail.com.

### Responsible Disclosure

To report a vulnerability: email yourcondomanagement@gmail.com, subject "Security Vulnerability Report — YCM." We acknowledge within 2 business days and respond within 14 days. We do not pursue legal action against good-faith researchers (see Vulnerability Management Program §6 for the full Safe Harbor terms).

---

## 8. Business Continuity

### 8.1 Backups

- **Database:** Neon Postgres automated daily backups, 7-day rolling retention
- **Recovery Point Objective (RPO):** 24 hours
- **Recovery Time Objective (RTO):** 4 hours

### 8.2 Availability Target

YCM targets 99.5% monthly uptime. Planned maintenance is scheduled during off-peak hours.

---

## 9. Vendor Management

Vendors with access to YCM data are inventoried in the canonical [Subprocessor List](subprocessor-list-v1.md). Summary table:

| Vendor | Purpose | Status |
|---|---|---|
| Fly.io | Application + database hosting | Live |
| Neon | Managed Postgres (via Fly) | Live |
| Stripe | Stripe Connect Standard (HOA-as-merchant ACH) + SaaS subscription billing | Live |
| Plaid Technologies | Bank-feed reconciliation (association + owner side) | Sandbox live; Production access pending |
| Google (Google Cloud) | OAuth 2.0 authentication | Live |
| Cloudflare | DNS + inbound email routing | Live |
| GitHub | Source control + CI | Live |
| Anthropic | Claude API for AI Assistant | Configured (key in Fly secrets) |

Refer to [Subprocessor List](subprocessor-list-v1.md) for full data categories, regions, and compliance documentation per subprocessor.

New vendors with access to user data are evaluated for security posture before engagement.

---

## 10. Compliance Framework Alignment

YCM claims **alignment** with the following frameworks; YCM does **not** hold third-party certification under any of them. Certification is on the roadmap once the company crosses the thresholds where partner / customer demand justifies the audit cost.

- **SOC 2 (Trust Services Criteria):** controls in this policy + the supporting policies are aligned to SOC 2 Security and Availability TSCs. No SOC 2 Type I or Type II report has been issued.
- **ISO 27001:** access control, asset management, cryptography, supplier relationships, and incident management are aligned to ISO 27001 Annex A controls. No certification.
- **PCI DSS:** YCM never stores, processes, or transmits cardholder data in scope — Stripe holds the PCI scope. YCM operates under the SAQ-A profile (e-commerce merchants outsourcing all cardholder-data handling to a PCI-DSS-validated third party).
- **GDPR / CCPA:** privacy controls, data subject rights, breach-notification SLAs, and data retention are aligned to GDPR and CCPA requirements (see [Privacy Policy](privacy-policy-v1.md)).

---

## 11. Policy Enforcement and Review

This policy is reviewed annually as part of the Security Compliance Calendar. Non-compliance may result in access revocation. Questions: yourcondomanagement@gmail.com.

Operational cadence is enforced by `docs/policies/security-compliance-calendar-v1.md`.

---

**Version history:**

- **v2.0 (2026-05-25):** HOA-specific honest-claims rewrite per founder-os#2469. Replaced landlord/tenant role taxonomy with HOA role taxonomy (board / owners / tenants / vendors / admins per live `admin_user_role` + `portal_access_role` + `occupancy_type` enums). §3.2 reflects real role enums. §4.4 reflects Stripe Connect Standard live, Plaid Sandbox live + Production pending, app-layer token encryption deployed. §5.2 reflects actual Fly secrets inventory (Gmail SMTP for email; Resend + Sentry called out as pending). §10 added compliance-framework alignment claims (alignment, not certification).
- v1.2 (2026-05-20): initial DRAFT derived from Plinthkeep skeleton; landed in PR #168 with DRAFT banner pending Phase 1 honest-claims pass.
