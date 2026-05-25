# Privacy Policy

**YourCondoManager (YCM)**
**Effective Date:** May 25, 2026
**Last Updated:** May 25, 2026
**Version:** 2.0

---

## 1. Introduction

YourCondoManager (YCM) ("we," "us," or "our") operates yourcondomanager.org and provides HOA-management software to homeowner associations, their board members, owners, tenants of owner-rented units, and vendors that serve those associations. This Privacy Policy explains what personal information we collect, how we use it, with whom we share it, and what rights you have regarding your data.

By using YCM, you agree to the collection and use of information in accordance with this policy. If you do not agree with any part of this policy, please do not use our services.

We are committed to protecting your privacy. We collect only the minimum data necessary to provide our services. **We do not sell your personal information to third parties.**

---

## 2. Who We Are and Who You Are

YCM is a multi-tenant SaaS platform where each tenant of the platform is an **HOA association**. Your role determines what data we hold about you and what you can see in the product.

| Your role | Who you are | Where you appear in our system |
|---|---|---|
| **Board member** (president, treasurer, secretary, or other board role) | Elected or appointed to govern an association | `admin_users` (if you have a YCM admin login) and/or `portal_access` with `board-member` role |
| **Owner** | Hold title to one or more units in an association | `portal_access` with `owner` role; linked to `ownerships` rows in your association |
| **Tenant** | Rent a unit from an owner inside an association | Identity flows through your landlord-owner in v1 — you do not have a direct YCM portal login |
| **Vendor** | Provide services to an association (maintenance, inspection, etc.) | `vendors` table inside the association; do not authenticate to the YCM portal in v1 |
| **Platform admin** | YCM staff or assisted-management staff | `admin_users` with `platform-admin`, `pm-assistant`, `manager`, or other admin role |

---

## 3. Information We Collect

### 3.1 Information You Provide Directly

We collect information you provide when you create an account, use our services, or contact us:

**All authenticated users:**

- Account information: name and email address. YCM admin login is via Google OAuth — passwords are never stored or transmitted (see Section 8). Owner-portal access is via invite-activation tokens — no portal passwords are stored.
- Profile information: phone number (optional)

**Board members and platform admins:**

- Association information: legal association name, address, governing documents, fiscal-year configuration, fee schedules
- Owner roster: owner names, email addresses, phone numbers, mailing addresses, unit assignments, ownership shares
- Tenant information (when a board member or owner records it): tenant names, contact information, lease dates for `TENANT`-occupancy units. The board / owner recording this data is responsible for ensuring appropriate legal basis to share it.
- Vendor information: vendor business name, contact information, services, insurance and license details
- Financial setup: bank-account labels (the actual account numbers are held by Plaid / Stripe — see Section 9), assessment schedules, late-fee rules

**Owners:**

- Identity confirmation: your name, email, and unit assignment are populated by the board when they activate your portal access
- Maintenance requests you submit
- Payment information for assessments (handled exclusively by Stripe — see Section 9)
- Bank-account connections (when you connect a personal bank for owner-side ACH pay-flow via Plaid Link — see Section 9)

**Tenants** (where applicable, supplied by the landlord-owner or board):

- Contact information: name, email, phone

**Vendors:**

- Business contact information: name, company name, email, phone
- Work order records: work orders assigned to you, completion notes, invoices

### 3.2 What We Do NOT Collect

We do not collect:

- Social Security Numbers or government-issued ID numbers
- Payment card numbers or bank account numbers (if you pay via Stripe ACH, Stripe holds the account number; YCM never sees it)
- Bank login credentials (bank connections are made exclusively through Plaid Link — we receive only access tokens, not credentials)

### 3.3 Information We Collect Automatically

When you use YCM, we automatically collect:

- **Log data:** IP address, browser type, operating system, pages visited, time and date of visits
- **Session data:** opaque session identifiers, session duration
- **Usage data:** features used, actions taken within the platform
- **Device information:** device type, operating system version
- **Email engagement data** (if you have opted into / not opted out of tracked emails): open and click events via signed tracking tokens (`EMAIL_TRACKING_ENABLED` flag)

### 3.4 Information From Third Parties

- **Google OAuth:** if you sign in with Google as an admin or board member, we receive your name, email address, Google subject identifier (`sub`), and profile picture URL from Google. We do not receive your Google password.
- **Plaid:** when an association or owner connects a bank account through Plaid, we receive account metadata (institution name, account name, account-number mask = last 4) and transaction data as described in Section 9. We do not receive bank login credentials.
- **Stripe:** when an owner pays an assessment via Stripe Connect, we receive the payment confirmation, charge ID, and statement-descriptor data — never the bank-account number.

---

## 4. How We Use Your Information

### 4.1 Providing and Operating the Service

- Creating and managing your account or portal access
- Enabling boards to manage their association, governance documents, owner roster, and finances
- Enabling owners to view their unit, ledger, payments, assessments, and maintenance requests
- Processing assessment payments via Stripe Connect Standard (HOA-as-merchant) over ACH
- Reconciling association bank-account deposits against expected owner payments via Plaid bank-feed sync
- Managing work orders, vendor invoices, and maintenance records
- Sending service-related notifications (assessment notices, payment receipts, maintenance updates, board-package distributions)
- Responding to support requests

### 4.2 Financial Operations

- Processing owner monthly-assessment ACH payments via **Stripe Connect Standard** (live in production; each HOA is its own Connect sub-merchant under the YCM platform account)
- Processing SaaS subscription billing for paid YCM tiers via Stripe billing (live in production; subscription tiers per the `STRIPE_PRICE_*` Fly secrets inventory)
- Reconciling association bank-account transactions to populate the `bank_transactions` table via **Plaid Sandbox** (Plaid Production access not yet provisioned)
- Generating board-facing financial reports (assessment aging, payment ledger, reconciliation summary)

### 4.3 Product Improvement

- Analyzing usage patterns to improve features and user experience
- Diagnosing technical issues
- Developing new features

We use aggregated, anonymized data for product improvement. We do not analyze individual users' private financial or governance data for marketing purposes.

### 4.4 Communications

- Transactional emails: account creation, assessment notices, payment receipts, password resets, maintenance updates, delinquency notices, dispatch notifications. Outbound transactional email is sent via Gmail SMTP (`GMAIL_SENDER_EMAIL`) in production as of this policy date.
- Service announcements: important policy or security updates (cannot be opted out of)
- Optional product updates: only if you opt in

### 4.5 Legal and Compliance

- Complying with applicable laws and regulations
- Responding to valid legal process
- Enforcing our Terms of Service

---

## 5. How We Share Your Information

We do not sell your personal information. We share information only as described below.

### 5.1 Within the Platform (Role-Based Sharing)

YCM's functionality requires sharing certain data between parties **within a single association**:

- **Board members** see association-wide data they are entitled to under their board role, including owner roster, ledger, payments, and maintenance history
- **Owners** see their own unit, ledger, payments, assessments, maintenance requests, board announcements at the visibility level they are entitled to, and contact information for their board / property manager
- **Tenants** (where their landlord-owner has chosen to expose information) see only what their landlord-owner has explicitly shared with them
- **Vendors** see only work orders assigned to them, including the association address and description of the work needed
- **Owners and tenants do not see bank-account details of other owners; boards do not see personal bank-account details of owners** — Plaid handles financial connections for each party separately, and the actual bank-account number is never exposed in the YCM UI

**Cross-association isolation:** at no point does a user from one association see data from another association. Every multi-tenant table carries an `associationId` column; every query filters by it.

### 5.2 Service Providers (Subprocessors)

We share data with service providers who assist us in operating YCM. The canonical inventory with data categories, regions, and compliance documentation is the [Subprocessor List](subprocessor-list-v1.md). Summary:

| Service Provider | Purpose | Data Shared |
|---|---|---|
| Fly.io | Application + database hosting | All application data, encrypted at rest |
| Neon | Managed Postgres (via Fly) | Database storage, backups |
| Google (Google Cloud) | OAuth 2.0 authentication | OAuth tokens; user email, name, profile photo URL |
| Stripe (Connect Standard) | HOA-as-merchant ACH for owner assessments + YCM SaaS subscription billing | Connect account metadata; charge / payment-intent IDs; statement descriptors; subscription tier |
| Plaid Technologies | Bank-feed reconciliation (association + owner side) | Plaid access tokens (app-layer encrypted); account metadata (last-4 masks, institution names); transaction history |
| Cloudflare | DNS + inbound email routing for `yourcondomanager.org` aliases | Operator-directed email messages (forwarded to a single ops mailbox) |
| GitHub | Source-code hosting + CI | Source code (no production user data) |
| Anthropic | Claude API for AI Assistant features | When AI Assistant is in use, the prompt text + a scoped context window. No credentials, full database contents, or session tokens are sent. |

All service providers are contractually required to use data only for the purposes of providing services to YCM. See [Subprocessor List](subprocessor-list-v1.md) for the up-to-date inventory; it is updated whenever a subprocessor is added, removed, or has a material change in scope.

### 5.3 Legal Requirements

We may disclose information if required by law, court order, or government request. We will make reasonable efforts to notify you unless prohibited.

### 5.4 Business Transfers

If YCM is acquired or merged, your information may transfer as part of that transaction. We will notify you before data is transferred to a different privacy policy.

---

## 6. Data Retention

We retain your information for as long as your account or your association's account is active, plus the periods required by law. The full retention schedule lives in [Data Retention Policy](data-retention-policy-v1.md). Summary:

| Data Type | Retention Period | Basis |
|---|---|---|
| Account / portal-access records | Duration of active access + 30 days after deactivation | Service delivery |
| Association governance and owner-roster data | Duration of association tenancy on the platform | Service delivery |
| Owner ledger and assessment records | 7 years from transaction date | Financial / tax compliance |
| Stripe payment records (charge IDs, statement descriptors) | 7 years | Financial / tax compliance |
| Bank-account connection metadata (Plaid) | Active connection + 30 days after disconnection | Service delivery |
| Bank-feed transactions | 7 years (financial reconciliation history) | Financial / tax compliance |
| Maintenance and work-order records | 5 years after resolution | Business records |
| Vendor records | Duration of active relationship + 2 years | Business records |
| Authentication and audit logs | 1 year | Security / compliance |
| Application error logs | 90 days | Debugging |
| Email engagement events | 1 year | Audit + deliverability |

When you request account deletion, we delete or anonymize your personal data within 30 days, except for records we are legally required to retain (primarily financial records for tax compliance). We will notify you of any data retained beyond your deletion request and specify the legal basis. See [Data Retention Policy](data-retention-policy-v1.md) for full procedures.

---

## 7. Your Rights

### 7.1 Access and Portability

You may request a copy of the personal information we hold about you, or a portable export of your data. Contact us at yourcondomanagement@gmail.com.

### 7.2 Correction

You may correct inaccurate information in your portal / admin settings, or by contacting us. For board-controlled fields (owner roster, unit assignments), correction requests are routed to your association's board.

### 7.3 Deletion

You may request deletion of your account and personal data:

1. Email yourcondomanagement@gmail.com with the subject "Account Deletion Request," or
2. Use the Account Settings → Delete Account option (when available)

We will confirm receipt within 5 business days and complete deletion within 30 days.

**Note for boards:** deleting an association from the platform does not automatically delete individual owner accounts that have linked to other associations. Owner data associated with the deleted association is handled per our retention schedule.

**Note for owners:** deleting your owner portal access does not erase your unit-ownership record from the association — the board controls that record. To remove the underlying ownership record, contact your association's board.

### 7.4 Opt-Out of Marketing

YCM does not currently send marketing emails. If we begin doing so, opt-out will be available via the "Unsubscribe" link in any marketing email or by emailing yourcondomanagement@gmail.com.

### 7.5 California Residents — CCPA Rights

California residents have the right to know what personal information we collect, delete it, and opt out of its sale (we do not sell personal information). To exercise CCPA rights, contact yourcondomanagement@gmail.com. We respond within 45 days.

### 7.6 European Residents — GDPR Rights

EEA/UK/Swiss residents have rights under GDPR including access, rectification, erasure, restriction, portability, and objection. Our legal basis is primarily the performance of our service contract and legitimate interests. Contact yourcondomanagement@gmail.com or your local data protection authority.

---

## 8. Security

We implement the following technical and organizational security measures:

- **Encryption in transit:** TLS 1.2 or higher for all data between your browser and our servers; HTTP redirects to HTTPS; HSTS headers configured
- **Encryption at rest:** database encrypted at rest (Neon Postgres AES-256)
- **Application-layer encryption — Plaid access tokens:** Plaid access tokens are stored in `bank_connections.access_token_encrypted` and encrypted at the application layer with AES-256 (key `PLAID_TOKEN_ENCRYPTION_KEY` in Fly secrets) before being written to the database
- **Payment data:** never stored by YCM — Stripe holds bank-account and card data exclusively; YCM operates under the PCI-DSS SAQ-A profile (outsourcing all cardholder-data handling to Stripe)
- **Association isolation:** every multi-tenant table carries an `associationId` column; cross-association data access is impossible at the application + query layer
- **Role isolation within an association:** board / owner / vendor / admin roles enforced server-side on every request via the live `admin_user_role` + `portal_access_role` enums
- **Authentication:** Google OAuth 2.0 for admin/board logins (no passwords stored); token-invite activation for owner portal (no passwords stored); HTTP-only, Secure, SameSite=Strict session cookies for all sessions
- **Monitoring:** authentication events and admin actions are logged in the application audit log; failed login attempts are monitored

For full details see the [Information Security Policy](information-security-policy-v1.md).

No security system is impenetrable. If you believe your account has been compromised, contact us immediately at yourcondomanagement@gmail.com.

---

## 9. Financial Data — Stripe and Plaid

### 9.1 Stripe — Stripe Connect Standard (live)

YCM uses **Stripe, Inc.** in two distinct flows:

**(a) Stripe Connect Standard for HOA-as-merchant assessment collection (live in production):**

Each HOA association is onboarded as a Stripe Connect Standard sub-merchant under the YCM platform account. When an owner pays an assessment, the funds flow through the HOA's Connect account, not YCM's platform account. YCM is a connect platform; the HOA is the merchant of record.

- ACH is the v1 owner-payment rail (`us_bank_account` payment method)
- Statement descriptor is set per HOA so the owner's bank statement shows the right HOA name
- YCM never receives or stores bank-account numbers — Stripe handles bank-account capture via Stripe Financial Connections (instant verification) or microdeposits
- YCM stores only Stripe identifiers (Connect account ID, payment intent ID, charge ID) and the statement-descriptor used

**(b) Stripe billing for YCM SaaS subscriptions (live in production):**

YCM uses Stripe billing for the platform-tier subscriptions that boards and property managers pay to YCM (per `STRIPE_PRICE_*` Fly secrets).

- All payment-card data is captured and stored exclusively by Stripe — YCM never receives or stores card numbers, expirations, or CVV
- YCM stores only Stripe customer + subscription identifiers, subscription tier, and billing status

Stripe disclosures: https://stripe.com/privacy and https://stripe.com/docs/security. Stripe holds PCI DSS Level 1 certification, SOC 1/2/3, and ISO 27001.

### 9.2 Plaid — Bank-Feed Reconciliation (Sandbox live; Production pending)

YCM uses **Plaid, Inc.** to enable two bank-connection flows:

**(a) Association-side:** the board / treasurer connects the HOA's operating bank account so that incoming assessment payments and other transactions auto-flow into the YCM reconciliation engine (the `bank_transactions` table) and reconcile against expected owner payments.

**(b) Owner-side:** the owner connects their personal bank account so they can pay their assessment via ACH (`react-plaid-link` flow; unblocked in founder-os#1780).

**Current status (May 25, 2026):** Plaid Sandbox is live for both flows. Application-layer encryption of Plaid access tokens is deployed (`PLAID_TOKEN_ENCRYPTION_KEY` is in Fly secrets and is wired into `bank_connections.access_token_encrypted`). **Plaid Production access is not yet provisioned** — there is no `PLAID_SECRET_PRODUCTION` in Fly secrets as of this policy date, so no real-bank data flows through production yet.

**How Plaid Link works:** when you connect a bank account, you enter your bank credentials directly into Plaid Link — YCM never sees or stores your bank login credentials.

**What we receive from Plaid:**

- **Transactions:** transaction history for connected accounts (used to populate the `bank_transactions` reconciliation feed)
- **Account metadata:** institution name, account name, account-number mask (last 4 digits only), account type and subtype

We do not receive your bank login credentials. We receive Plaid access tokens (which authorize YCM to retrieve data from Plaid on your behalf) and the financial data Plaid retrieves.

**How we store Plaid data:**

- **Access tokens:** stored in `bank_connections.access_token_encrypted` with application-layer AES-256 encryption (keyed by `PLAID_TOKEN_ENCRYPTION_KEY` in Fly secrets) plus Postgres at-rest AES-256 (Neon default)
- **Account metadata:** stored in `bank_accounts`, scoped to the connecting association (`associationId`) and, where applicable, the connecting portal user (`portalAccessId`)
- **Transaction data:** stored in `bank_transactions`, scoped to the connecting association
- **Association isolation:** every row in `bank_connections`, `bank_accounts`, and `bank_transactions` carries an `associationId`. Every API query filters by it; cross-association access is impossible at the application + query layer.

**Disconnecting your account:**

- We call Plaid's `/item/remove` endpoint to revoke the access token at Plaid
- We mark the `bank_connections` row as `revoked` and delete the encrypted access token
- Historical transaction data may be retained per the retention schedule (typically 7 years for financial records required for tax compliance)
- You may also manage Plaid connections directly at https://my.plaid.com

**Plaid disclosures:** https://plaid.com/legal/#privacy-policy and https://plaid.com/safety/. Plaid holds SOC 2 Type II and ISO 27001 certifications.

---

## 10. AI Assistant — Anthropic Claude

YCM has an optional AI Assistant feature backed by **Anthropic PBC's** Claude API (`ANTHROPIC_API_KEY` in Fly secrets). When the AI Assistant is invoked:

- The prompt text + a scoped context window are sent to Anthropic
- We do not send credentials, full database contents, or session tokens
- Per-interaction telemetry (token use, cost, success / failure) is recorded in the `ai_assistant_interactions` table for cost tracking and quality review

Phase 0 (currently shipped) is the mock-adapter scaffold; Phase 1 (real-LLM wiring) is in flight. When Phase 1 is live, this section will be updated with the specific prompt + context categories sent. Anthropic disclosures: https://www.anthropic.com/legal/privacy.

---

## 11. Children's Privacy

YCM is not directed to children under 13 (or 16 in the EEA). We do not knowingly collect information from children under these ages. If you believe we have inadvertently collected such information, contact yourcondomanagement@gmail.com.

---

## 12. International Data Transfers

YCM is operated from the United States. If you are outside the United States, your data may be transferred to and processed in the United States. For EEA users, we rely on Standard Contractual Clauses or other approved transfer mechanisms.

---

## 13. Cookies

| Cookie Type | Purpose | Duration |
|---|---|---|
| Session cookie | Maintains your logged-in session | Session |
| Authentication cookie | Keeps you logged in if "Remember me" selected | Per `SESSION_MAX_AGE_MS` (Fly secret) |
| Preference cookies | Stores UI preferences | 1 year |

We do not use cookies for advertising or cross-site tracking.

---

## 14. Changes to This Policy

We may update this policy. For material changes, we will:

- Update the "Last Updated" date
- Notify you by email at least 14 days before the change takes effect
- Post a notice in the platform

Continued use after changes indicates acceptance. If you do not agree, you may request account deletion.

---

## 15. Contact Us

**YourCondoManager (YCM)**
Email: yourcondomanagement@gmail.com
Website: https://yourcondomanager.org

We respond to all privacy inquiries within 5 business days.

---

**Version history:**

- **v2.0 (2026-05-25):** HOA-specific honest-claims rewrite per founder-os#2469. Replaced landlord/tenant taxonomy with HOA roles (board / owners / tenants / vendors / admins). §2 added explicit role table. §4.2 reflects Stripe Connect Standard live + Plaid Sandbox-only state. §5.2 subprocessor table updated to match the live Subprocessor List. §8 reflects deployed app-layer Plaid token encryption. §9 split into Stripe + Plaid sections with accurate Sandbox-vs-Production status. §10 added for Anthropic / AI Assistant.
- v1.1 (2026-05-20): initial DRAFT derived from Plinthkeep skeleton; landed in PR #168 with DRAFT banner pending Phase 1 honest-claims pass.
