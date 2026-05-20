> **⚠️ STATUS: DRAFT — NOT YET PARTNER-READY**
>
> This document was derived from PlinthKeep's canonical policy (PR #105) via placeholder substitution. Plinthkeep's domain is single-family-rental; YourCondoManager's domain is HOA management. The high-level structure transfers but **role taxonomy** (HOA boards / owners / occupancy-typed tenants / vendors / platform admins) and **feature claims** (HOA assessments, Stripe Connect Standard for HOA-as-merchant, Plaid bank-feed reconciliation, multi-tenant association isolation) need a YCM-specific honest-claims rewrite per founder-os#1783 Phase 1 follow-on.
>
> The fully customized YCM-specific version is the **subprocessor-list-v1.md** file in this directory — that one is partner-questionnaire-ready and reflects YCM's actual stack as of 2026-05-20. The other policies follow once the Phase 1 honest-claims pass lands.
>
> ---

# Privacy Policy

**YourCondoManager (YCM)**
**Effective Date:** May 20, 2026
**Last Updated:** May 20, 2026
**Version:** 1.1

---

## 1. Introduction

YourCondoManager (YCM) ("we," "us," or "our") operates yourcondomanager.org and provides property management services to landlords, property managers, tenants, and vendors. This Privacy Policy explains what personal information we collect, how we use it, with whom we share it, and what rights you have regarding your data.

By using YourCondoManager (YCM), you agree to the collection and use of information in accordance with this policy. If you do not agree with any part of this policy, please do not use our services.

We are committed to protecting your privacy. We collect only the minimum data necessary to provide our services. We do not sell your personal information to third parties.

---

## 2. Information We Collect

### 2.1 Information You Provide Directly

We collect information you provide when you create an account, use our services, or contact us:

**All users:**

- Account information: name and email address. YourCondoManager (YCM) authenticates via Google OAuth — passwords are never stored or transmitted (see Section 7).
- Profile information: phone number, company or organization name

**Landlords and property managers:**

- Property information: property addresses, property descriptions, unit configurations
- Lease and rental data: lease terms, rental rates, lease start and end dates, lease documents you upload
- Tenant information: names, email addresses, phone numbers, and lease terms for tenants you manage through YourCondoManager (YCM). You are responsible for ensuring you have appropriate consent or legal basis to share tenant information with YourCondoManager (YCM).
- Billing information for the YourCondoManager (YCM) subscription: handled by Stripe; YourCondoManager (YCM) stores subscription tier + billing status only, never payment card data (see Section 8)
- Business bank-account information: when you connect a property/business bank account through Plaid, we receive account metadata and transaction data to populate your expense ledger (see Section 8 for details)
- Vendor and contractor information: names, contact details, and work order history

**Tenants:**

- Contact information: name, email address, phone number
- Maintenance requests: descriptions of maintenance issues you submit
- (Future) bank-account information for tenant-to-landlord rent payment via Stripe Connect — not in current v1 scope

**Vendors:**

- Business contact information: name, company name, email, phone
- Work order records: work orders assigned to you, completion notes

### 2.2 What We Do NOT Collect

We do not collect:

- Social Security Numbers or government-issued ID numbers
- Payment card numbers (if card payments are implemented, they are processed exclusively by Stripe — we receive only confirmation and card metadata)
- Bank login credentials (bank connections are made exclusively through Plaid — we receive only access tokens, not credentials)

### 2.3 Information We Collect Automatically

When you use YourCondoManager (YCM), we automatically collect:

- **Log data:** IP address, browser type, operating system, pages visited, time and date of visits
- **Session data:** session identifiers, session duration
- **Usage data:** features used, actions taken within the platform
- **Device information:** device type, operating system version

### 2.4 Information From Third Parties

- **Google OAuth:** if you sign in with Google, we receive your name, email address, and profile picture from Google. We do not receive your Google password.
- **Plaid:** when you connect a bank account through Plaid, we receive account information and transaction data as described in Section 8. We do not receive your bank login credentials.

---

## 3. How We Use Your Information

### 3.1 Providing and Operating the Service

- Creating and managing your account
- Enabling landlords to manage properties, leases, and tenants
- Enabling tenants to view their lease information and submit maintenance requests
- Processing rent payments via ACH through Plaid
- Tracking rent deposits and property income for landlords
- Managing work orders and maintenance records
- Sending service-related notifications (lease reminders, rent receipts, maintenance updates)
- Responding to support requests

### 3.2 Financial Operations

- Processing SaaS subscription billing for paid tiers (Stripe — live as of May 2026)
- Aggregating landlord business-account transactions to populate the expense ledger (Plaid — Sandbox active; production gated)
- Tracking rent payment status and history (manual entry in v1; Stripe Connect rent collection on roadmap)
- Generating financial reports for landlords (rent roll, income/expense tracking, Schedule E export at year-end)

### 3.3 Product Improvement

- Analyzing usage patterns to improve features and user experience
- Diagnosing technical issues
- Developing new features

We use aggregated, anonymized data for product improvement. We do not analyze individual users' private property or financial data for marketing purposes.

### 3.4 Communications

- Transactional emails: account creation, password reset, rent payment receipts, lease reminders, maintenance updates
- Service announcements: important policy or security updates (cannot be opted out of)
- Optional product updates: only if you opt in

### 3.5 Legal and Compliance

- Complying with applicable laws and regulations
- Responding to valid legal process
- Enforcing our Terms of Service

---

## 4. How We Share Your Information

We do not sell your personal information. We share information only as described below.

### 4.1 Within the Platform (Role-Based Sharing)

YourCondoManager (YCM)'s functionality requires sharing certain data between parties:

- **Landlords and property managers** see the contact information and lease details of tenants in their properties
- **Tenants** see their lease details, payment history, and can view contact information for their property manager
- **Vendors** see work orders assigned to them, including the property address and description of the work needed
- **Tenants do not see financial account details of landlords; landlords do not see bank account details of tenants** — Plaid handles financial connections for each party separately

### 4.2 Service Providers

We share data with service providers who assist us in operating YourCondoManager (YCM):

| Service Provider      | Purpose                                              | Data Shared                                                           |
| --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| Fly.io                | Application + database hosting                       | All application data, encrypted at rest                               |
| Neon                  | Managed Postgres (via Fly)                           | Database storage, backups                                             |
| Google (Google Cloud) | OAuth 2.0 authentication                             | Authentication tokens; user email, name, profile photo URL            |
| Stripe                | SaaS subscription billing                            | Account email, subscription tier, payment-method tokens (Stripe-held) |
| Plaid Technologies    | Bank-account aggregation (landlord business-expense) | Plaid access tokens, account metadata, transaction data per Section 8 |
| Cloudflare            | Inbound email routing for yourcondomanager.org aliases     | Operator-directed email messages (forwarded to a single ops mailbox)  |
| GitHub                | Source-code hosting + CI                             | Source code (no production user data)                                 |

All service providers are contractually required to use data only for the purposes of providing services to YourCondoManager (YCM). The canonical inventory with data categories, regions, and compliance documentation is the [Subprocessor List](https://github.com/williamruiz1/plinthkeep/blob/upload/docs/policies/subprocessor-list-v1.md), updated whenever a subprocessor is added, removed, or has a material change in scope.

### 4.3 Legal Requirements

We may disclose information if required by law, court order, or government request. We will make reasonable efforts to notify you unless prohibited.

### 4.4 Business Transfers

If YourCondoManager (YCM) is acquired or merged, your information may transfer as part of that transaction. We will notify you before data is transferred to a different privacy policy.

---

## 5. Data Retention

We retain your information for as long as your account is active, plus the periods required by law:

| Data Type                            | Retention Period                                               | Basis                         |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------------- |
| Account information                  | Duration of account + 30 days after deletion                   | Service delivery              |
| Lease agreements                     | 7 years after lease end date                                   | Legal/tax compliance          |
| Rent payment records                 | 7 years from payment date                                      | Financial record requirements |
| Late payment and rent demand records | 7 years                                                        | Legal compliance              |
| Security deposit records             | 7 years after deposit return                                   | Legal compliance              |
| Maintenance records                  | 5 years after resolution                                       | Business records              |
| Tenant application data (accepted)   | Duration of tenancy + 1 year post-tenancy end                  | Business records              |
| Tenant PII (name, email, phone)      | Duration of tenancy + 1 year post-tenancy end, then anonymized | Privacy best practice         |
| Bank account connection data (Plaid) | Until disconnected + 30 days                                   | Service delivery              |
| Authentication and audit logs        | 1 year                                                         | Security compliance           |
| Application error logs               | 90 days                                                        | Debugging                     |

When you request account deletion, we delete or anonymize your personal data within 30 days, except for records we are legally required to retain (primarily financial records for tax compliance). We will notify you of any data retained beyond your deletion request and specify the legal basis.

---

## 6. Your Rights

### 6.1 Access and Portability

You may request a copy of the personal information we hold about you, or a portable export of your data. Contact us at yourcondomanagement@gmail.com.

### 6.2 Correction

You may correct inaccurate information in your account settings or by contacting us.

### 6.3 Deletion

You may request deletion of your account and personal data:

1. Email yourcondomanagement@gmail.com with the subject "Account Deletion Request," or
2. Use the Account Settings → Delete Account option (when available)

We will confirm receipt within 5 business days and complete deletion within 30 days.

**Note for landlords:** deleting your landlord account does not automatically delete tenant accounts or records. Tenant data associated with your properties is handled per our data retention schedule above.

### 6.4 Opt-Out of Marketing

You may opt out of marketing emails by clicking "Unsubscribe" in any marketing email or emailing us at yourcondomanagement@gmail.com.

### 6.5 California Residents — CCPA Rights

California residents have the right to know what personal information we collect, delete it, and opt out of its sale (we do not sell personal information). To exercise CCPA rights, contact yourcondomanagement@gmail.com. We respond within 45 days.

### 6.6 European Residents — GDPR Rights

EEA/UK/Swiss residents have rights under GDPR including access, rectification, erasure, restriction, portability, and objection. Our legal basis is primarily the performance of our service contract and legitimate interests. Contact yourcondomanagement@gmail.com or your local data protection authority.

---

## 7. Security

We implement the following technical and organizational security measures:

- **Encryption in transit:** TLS 1.2 or higher for all data between your browser and our servers; HTTP redirects to HTTPS; HSTS headers configured
- **Encryption at rest:** database encrypted at rest (Neon/Fly.io Postgres AES-256)
- **Application-layer encryption — Plaid access tokens:** required gate before the production `plaid-bank-aggregation` feature flag is enabled (see Section 8.2). Until that gate clears, no real-bank data flows through the production app.
- **Payment data:** never stored by YourCondoManager (YCM) — Stripe holds card data exclusively; PCI scope outsourced to Stripe (PCI DSS Level 1).
- **Access controls:** role-based access control — landlords see only their properties; tenants see only their own lease; vendors see only assigned work orders; no cross-tenant data access at any role level
- **Authentication:** HTTP-only, Secure, SameSite=Strict session cookies; sole authentication via Google OAuth 2.0 — YourCondoManager (YCM) stores no passwords
- **Monitoring:** authentication events and admin actions are logged; failed login attempts are monitored; webhook signature failures are alerted

No security system is impenetrable. If you believe your account has been compromised, contact us immediately at yourcondomanagement@gmail.com.

---

## 8. Financial Data — Stripe and Plaid

### 8.1 Stripe (SaaS subscription billing — live)

YourCondoManager (YCM) uses **Stripe, Inc.** to process subscription billing for landlord/property-manager accounts on paid tiers (Growth, Pro, and credit-pack purchases). Stripe billing is live in production as of May 2026.

- All payment-card data is captured and stored exclusively by Stripe — YourCondoManager (YCM) never receives or stores card numbers, expirations, or CVV.
- YourCondoManager (YCM) stores only Stripe's customer + subscription identifiers, subscription tier, and billing status to power the in-app experience.
- Stripe's privacy and security disclosures: https://stripe.com/privacy and https://stripe.com/docs/security
- Stripe is PCI DSS Level 1 certified, SOC 1/2/3, ISO 27001.

### 8.2 Plaid (bank-account aggregation — Sandbox active; Production pending)

YourCondoManager (YCM) is integrating **Plaid, Inc.** to let landlords connect their business bank and credit-card accounts so transactions auto-flow into their rental expense ledger, categorize against rental expense categories, and roll up at tax time for Schedule E exports.

**Current status (May 20, 2026):** Phase 1 scaffolded; Sandbox environment is active for development. Production access application was submitted to Plaid on 2026-05-20 and is under review. The `plaid-bank-aggregation` feature flag is OFF in production pending (a) Plaid production approval and (b) application-layer encryption of Plaid access tokens. Until both gates clear, no real bank connections flow through production.

**v1 scope (when enabled):** landlord business-expense ledger sync only — Plaid Transactions + Identity for the landlord's own connected accounts. Tenant rent collection is a separate roadmap item (Stripe Connect, not Plaid).

**How Plaid Link works:** when you connect a bank account, you enter your bank credentials directly into Plaid Link — YourCondoManager (YCM) never sees or stores your bank login credentials.

**What we receive from Plaid:**

- **Transactions:** transaction history for connected business accounts (used to populate your expense ledger)
- **Identity:** account-holder information (used to confirm the connected account belongs to you)
- (Future-proofed but unused in v1: Auth — for tenant ACH verification when Stripe Connect ships; Balance — for in-app balance display)

We do not receive your bank login credentials. We receive Plaid access tokens (which authorize YourCondoManager (YCM) to retrieve data from Plaid on your behalf) and the financial data Plaid retrieves.

**How we store Plaid data:**

- **Access tokens:** stored in the `plaid_items.plaid_access_token` column with Postgres at-rest AES-256 encryption (Neon default). Application-layer AES-256 encryption keyed by `PLAID_TOKEN_ENCRYPTION_KEY` (Fly.io secret) is required before the production feature flag is enabled.
- **Transaction data:** stored in `plaid_transactions`, scoped to the authenticated user and accessible only to that user.
- **Per-user isolation:** every Plaid Item is associated with a single `user_id`. Every API query filters by the authenticated user; cross-user access is impossible at the application + query layer.

**Disconnecting your account:**

- We call Plaid's `/item/remove` endpoint to revoke the access token at Plaid
- We delete the access token from the YourCondoManager (YCM) database
- Historical transaction data may be retained per our retention schedule in Section 5 (typically 7 years for financial records required for tax compliance)
- You may also manage Plaid connections directly at https://my.plaid.com

**Plaid's privacy and security disclosures:** https://plaid.com/legal/#privacy-policy and https://plaid.com/safety/ — Plaid is SOC 2 Type II and ISO 27001 certified.

---

## 9. Children's Privacy

YourCondoManager (YCM) is not directed to children under 13 (or 16 in the EEA). We do not knowingly collect information from children under these ages. If you believe we have inadvertently collected such information, contact yourcondomanagement@gmail.com.

---

## 10. International Data Transfers

YourCondoManager (YCM) is operated from the United States. If you are outside the United States, your data may be transferred to and processed in the United States. For EEA users, we rely on Standard Contractual Clauses or other approved transfer mechanisms.

---

## 11. Cookies

| Cookie Type           | Purpose                                       | Duration |
| --------------------- | --------------------------------------------- | -------- |
| Session cookie        | Maintains your logged-in session              | Session  |
| Authentication cookie | Keeps you logged in if "Remember me" selected | 30 days  |
| Preference cookies    | Stores UI preferences                         | 1 year   |

We do not use cookies for advertising or cross-site tracking.

---

## 12. Changes to This Policy

We may update this policy. For material changes, we will:

- Update the "Last Updated" date
- Notify you by email at least 14 days before the change takes effect
- Post a notice in the platform

Continued use after changes indicates acceptance. If you do not agree, you may request account deletion.

---

## 13. Contact Us

**YourCondoManager (YCM)**
Email: yourcondomanagement@gmail.com
Website: https://yourcondomanager.org

We respond to all privacy inquiries within 5 business days.

---

**Version history:**

- v1.1 (2026-05-20): reflects Stripe Phase A live (PR #58 + #59) and Plaid Phase 1 scaffolded with Sandbox active and production access submitted; honest token-encryption posture; scoped Plaid v1 usage to landlord business-expense ledger sync (tenant rent via Stripe Connect is roadmap, not Plaid); §4.2 subprocessor list expanded; §3.2 Financial Operations updated to reflect actual capabilities.
- v1.0 (2026-05-10): initial policy
