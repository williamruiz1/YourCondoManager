# FTPH Platform Roadmap — Phases 6–10

## Document Metadata
- Document Version: 1.0
- Generated On: 2026-03-07
- Status: Draft
- Scope: Strategic roadmap for phases 6–10, structured by workstreams
- Predecessor: FTPH v2.1 (phases 1–5)

---

## Platform State at Entry to Phase 6

Phases 1–5 delivered the following completed capabilities:

| Phase | Milestone | Workstreams Delivered |
|---|---|---|
| 1 | Foundation, Registry, and Core Admin | Associations, Units, Persons, Ownerships, Occupancy, Board Roles, Documents, Dashboard, Auth & Audit |
| 2 | Financial Operations and Budget Control | HOA Fee Engine, Assessment Engine, Late Fees, Owner Ledger, Expense/Invoice Tracking, Utility Payments, Budget Planning |
| 3 | Governance, Meetings, and Compliance | Meeting Tracker, Minutes Repository, Decision Log, Annual Compliance Checklist, Calendar & Tasks, Governance Dashboard |
| 4 | Document Intelligence and Operational Scale | AI Document Ingestion, Metadata Extraction, Record Suggestion Engine, Bylaw Ingestion Foundation, Smart Intake Workflows |
| 5 | Portals, Communications, and SaaS Expansion | Owner Portal, Tenant Portal Access, Communications Layer, Gmail/Email Integration Foundation, Notice Templates, Multi-Association Architecture, Subscription and SaaS Admin Controls |

**Critical gaps entering Phase 6:**
- No payment collection capability (fees are tracked, not collected digitally)
- No vendor registry or work order management
- No analytics or board reporting suite
- Owner portal is read-only (cannot transact, vote, or request services)
- No third-party integrations or API platform

---

## Phase 6 — Payment Processing and Financial Automation

**Objective:** Close the single most consequential operational gap — the platform tracks every dollar owed but cannot collect any of it digitally. Phase 6 adds end-to-end payment collection, reconciliation, and financial reporting.

**FTPH Module Alignment:** 3. Financial Operations & Fee Management

---

### Workstream 6.1 — Payment Gateway Integration

**Intent:** Enable online HOA dues and assessment payments via ACH bank debit only through a payment gateway (Stripe or equivalent).

**Functional Units:**
- 6.1.1 Connect Payment Gateway Account [Integration]
  - Configure Stripe or ACH provider credentials per association
  - Validate gateway connectivity on platform controls screen
- 6.1.2 Generate Owner Payment Link [Logic]
  - Generate a unique, secure payment link from an owner ledger balance
  - Link resolves against the correct owner and association
- 6.1.3 Record Inbound Payment Event [Data]
  - Webhook-driven payment capture that writes to the owner ledger
  - Payment event stores gateway reference, amount, method, and timestamp
- 6.1.4 Payment Method Management [UX]
  - Allow owners to save and manage ACH bank-account methods on file via portal

**Dependencies:** Owner Portal (Phase 5), Owner Ledger (Phase 2)
**Risks:** ACH authorization and return handling, gateway credential security, webhook idempotency
**Open Questions:** Support partial payments? Single gateway or pluggable? Per-association provider accounts?

---

### Workstream 6.2 — Automated Payment Scheduling and Autopay

**Intent:** Allow owners to enroll in recurring autopay so monthly dues are collected without manual action.

**Functional Units:**
- 6.2.1 Autopay Enrollment [UX]
  - Owner enrolls saved payment method in recurring schedule via portal
- 6.2.2 Recurring Charge Runner [Logic]
  - Scheduled job maps due-date fee schedules to enrolled owners and initiates charges
- 6.2.3 Autopay Event Log [Data]
  - Records each scheduled run, charge outcome, and retry state
- 6.2.4 Failed Payment Handling [Logic]
  - On failure: retry logic, failure notice to owner, flag for admin review

**Dependencies:** 6.1, HOA Fee Schedule (Phase 2)
**Risks:** Timing drift between fee schedule and charge runner; duplicate charges on retry
**Open Questions:** How many retries before escalation? Owner-cancelable or admin-only?

---

### Workstream 6.3 — Delinquency and Collections Workflow

**Intent:** Systematic escalation of unpaid balances from soft reminder through formal collections handoff.

**Functional Units:**
- 6.3.1 Delinquency Threshold Rules [Logic]
  - Configure per-association thresholds (e.g., 30/60/90 days) that trigger escalation stages
- 6.3.2 Automated Delinquency Notice Sequence [Integration]
  - Trigger notice templates (Phase 5) at each escalation stage
- 6.3.3 Collections Handoff Record [Data]
  - Mark balance as referred to collections; log attorney/agency contact and referral date
- 6.3.4 Delinquency Dashboard [UX]
  - Board-facing view of all balances by aging bucket; export-ready for meetings

**Dependencies:** Owner Ledger (Phase 2), Notice Templates (Phase 5), 6.1
**Risks:** Legal compliance requirements for collections notices vary by state
**Open Questions:** Should CT statutory cure periods be encoded as defaults?

---

### Workstream 6.4 — Bank Reconciliation Engine

**Intent:** Match posted ledger entries against bank transaction feeds to detect discrepancies.

**Functional Units:**
- 6.4.1 Bank Transaction Import [Integration]
  - Import bank statement CSV or connect via Plaid/bank feed API
- 6.4.2 Auto-Match Engine [Logic]
  - Match imported transactions to existing ledger entries by amount, date, and reference
- 6.4.3 Unmatched Transaction Review [UX]
  - Surface unmatched items for admin review; allow manual match or new entry creation
- 6.4.4 Reconciliation Period Closure [Logic]
  - Lock a reconciled period; prevent retroactive ledger edits within closed period

**Dependencies:** Owner Ledger (Phase 2), Expense & Invoice Tracking (Phase 2)
**Risks:** Bank API availability; statement format normalization complexity
**Open Questions:** Plaid or manual import first? How far back should historical imports go?

---

### Workstream 6.5 — Financial Reporting Suite

**Intent:** Generate board-ready financial reports from operational data without exporting to spreadsheets.

**Functional Units:**
- 6.5.1 Income and Expense Summary Report [UX]
  - Monthly and YTD income vs. expense summary by category
- 6.5.2 Reserve Fund Status Report [Logic]
  - Current reserve balance, monthly contribution rate, and projected coverage
- 6.5.3 Accounts Receivable Aging Report [Logic]
  - Outstanding owner balances aged by 30/60/90+ days
- 6.5.4 Report Export [UX]
  - PDF and CSV export of any financial report for board packet use

**Dependencies:** Budget Planning (Phase 2), Owner Ledger (Phase 2), 6.3
**Risks:** Report accuracy depends on consistent ledger posting discipline
**Open Questions:** Should reports be auto-generated on a schedule for board email distribution?

---

## Phase 7 — Vendor, Maintenance, and Property Operations

**Objective:** Add the operational layer the platform currently lacks entirely — vendor management, work orders, maintenance requests, and property-level inspection records. This closes the gap between financial tracking and physical property operations.

**FTPH Module Alignment:** New — Operational Property Management (to be added to FTPH v3.0)

---

### Workstream 7.1 — Vendor Registry

**Intent:** Maintain a structured directory of contractors and service providers used by the association.

**Functional Units:**
- 7.1.1 Create Vendor Profile [Data]
  - Name, trade, contact info, license number, insurance expiration date
- 7.1.2 Link Vendor to Association [Logic]
  - Vendor profiles are scoped per association or shared across the portfolio
- 7.1.3 Vendor Document Storage [Data]
  - Attach insurance certificates, contracts, and W-9s to vendor profile (links to Document Repository)
- 7.1.4 Vendor Status Tracking [Logic]
  - Flag vendors as active, inactive, or pending insurance renewal

**Dependencies:** Document Repository (Phase 1), Association Registry (Phase 1)
**Risks:** Insurance expiration tracking requires proactive admin discipline
**Open Questions:** Should vendors be a shared portfolio-level record or association-scoped?

---

### Workstream 7.2 — Work Order Management

**Intent:** Create, assign, track, and close maintenance work orders linked to units, common areas, or buildings.

**Functional Units:**
- 7.2.1 Create Work Order [Data]
  - Title, description, location (unit/common area), priority, assigned vendor, estimated cost
- 7.2.2 Work Order Lifecycle Tracking [Logic]
  - Status states: open → assigned → in-progress → pending review → closed
- 7.2.3 Work Order Expense Linkage [Logic]
  - Link completed work orders to vendor invoices in the expense tracker
- 7.2.4 Work Order History by Unit [UX]
  - Per-unit maintenance history view for admins and board

**Dependencies:** 7.1, Expense & Invoice Tracking (Phase 2), Unit Registry (Phase 1)
**Risks:** Cost overrun tracking only works if invoice linkage is consistently applied
**Open Questions:** Should work orders support internal (staff-assigned) vs. external (vendor-assigned) tracks?

---

### Workstream 7.3 — Owner and Tenant Maintenance Request Portal

**Intent:** Allow owners and tenants to submit maintenance requests through the portal, which route to admin work order creation.

**Functional Units:**
- 7.3.1 Submit Maintenance Request [UX]
  - Portal form: issue description, category, urgency, photo attachment
- 7.3.2 Request-to-Work-Order Conversion [Logic]
  - Admin reviews and converts approved requests into work orders
- 7.3.3 Request Status Notifications [Integration]
  - Submitter receives notice at key work order status transitions
- 7.3.4 Request History per Submitter [UX]
  - Owner/tenant can view their own submission history and current status

**Dependencies:** Owner Portal (Phase 5), 7.2, Communications Layer (Phase 5)
**Risks:** Volume of requests could overwhelm admin capacity without triage rules
**Open Questions:** Should high-priority requests auto-escalate after a response SLA window?

---

### Workstream 7.4 — Preventive Maintenance Scheduling

**Intent:** Create recurring maintenance tasks tied to property components (elevators, HVAC, fire systems) so nothing is missed.

**Functional Units:**
- 7.4.1 Create Maintenance Schedule Template [Logic]
  - Frequency (monthly/quarterly/annual), component, responsible party
- 7.4.2 Schedule Instance Generation [Logic]
  - Automatically generate future task instances from a template at the scheduled interval
- 7.4.3 Schedule-to-Work-Order Linkage [Logic]
  - When a scheduled instance comes due, create a work order automatically or prompt admin
- 7.4.4 Preventive Maintenance Calendar View [UX]
  - Calendar view of all upcoming scheduled maintenance events

**Dependencies:** 7.2, Calendar and Task Workflows (Phase 3)
**Risks:** Generating too many future instances too far out creates stale data
**Open Questions:** Should compliance checklists (Phase 3) feed into preventive maintenance scheduling?

---

### Workstream 7.5 — Property Inspection Records

**Intent:** Record unit and common area inspection results with findings, photos, and follow-up actions.

**Functional Units:**
- 7.5.1 Create Inspection Record [Data]
  - Date, inspector, location, overall condition, findings
- 7.5.2 Inspection Finding Items [Data]
  - Per-finding: description, severity, photo attachment, linked work order
- 7.5.3 Inspection History per Unit [UX]
  - Chronological inspection history for any unit with finding summaries
- 7.5.4 Inspection-to-Work-Order Linkage [Logic]
  - Convert an open finding into a work order directly from the inspection record

**Dependencies:** Unit Registry (Phase 1), 7.2, Document Repository (Phase 1)
**Risks:** Inspection records without photo attachments reduce evidentiary value
**Open Questions:** Should move-in/move-out inspections be a distinct inspection type?

---

## Phase 8 — Advanced Reporting, Analytics, and Compliance Intelligence

**Objective:** Transform the operational data accumulated in phases 1–7 into actionable intelligence. Boards and managers get automated report packages, AI-assisted compliance monitoring, and cross-association performance visibility without building spreadsheets.

**FTPH Module Alignment:** 6. Operational Tasks, Compliance & Calendar (extension); 4. Document & Record Management (AI extension); New — Analytics Module

---

### Workstream 8.1 — Board Reporting Package Automation

**Intent:** Automatically compile and deliver a board-ready monthly/quarterly report package combining governance, financial, and operational data.

**Functional Units:**
- 8.1.1 Report Package Builder [Logic]
  - Configure which report sections (financial, governance, maintenance, delinquency) appear in each package
- 8.1.2 Scheduled Package Generation [Logic]
  - Auto-generate packages on a configured schedule (e.g., 5 days before board meeting)
- 8.1.3 Package Preview and Edit [UX]
  - Board admins can preview, annotate, and approve a package before distribution
- 8.1.4 Package Distribution via Notice [Integration]
  - Distribute the final package to board member emails via Communications Layer

**Dependencies:** Financial Reporting (6.5), Meeting Tracker (Phase 3), 7.2, Communications (Phase 5)
**Risks:** Report quality depends on upstream data completeness
**Open Questions:** Should packages be sent as PDF attachments or as a portal-hosted link?

---

### Workstream 8.2 — Financial Analytics and Trend Visualization

**Intent:** Visualize financial trends over time — dues collection rates, delinquency trends, reserve fund trajectory, and expense category breakdowns.

**Functional Units:**
- 8.2.1 Dues Collection Rate Chart [UX]
  - Monthly collection % against posted charges over rolling 12-month window
- 8.2.2 Delinquency Trend Analysis [Logic]
  - Track and surface changes in balance aging profile month-over-month
- 8.2.3 Reserve Fund Projection Model [Logic]
  - Model reserve balance over 1/3/5 years given current contribution rate and known upcoming expenses
- 8.2.4 Expense Category Trend Chart [UX]
  - Stacked bar / trend chart of expense categories by month vs. budget lines

**Dependencies:** Financial Reporting (6.5), Budget Planning (Phase 2), Delinquency (6.3)
**Risks:** Projection accuracy depends on completeness of budgeted expense entries
**Open Questions:** Should reserve projections incorporate the association's formal reserve study data?

---

### Workstream 8.3 — AI Compliance Monitor

**Intent:** Use AI against ingested bylaws and governance records to surface compliance gaps proactively — e.g., missing required meetings, unratified budgets, expired board terms.

**Functional Units:**
- 8.3.1 Compliance Rule Extraction from Bylaws [Logic]
  - Parse bylaw clause records (Phase 4) for governance obligation language
- 8.3.2 Compliance Gap Detector [Logic]
  - Cross-reference extracted obligations against platform records; flag unmet obligations
- 8.3.3 Compliance Alert Dashboard [UX]
  - Board-facing dashboard of open compliance gaps with source document reference
- 8.3.4 Alert Suppression and Override [Logic]
  - Allow admin to mark a gap as resolved or exempt with rationale

**Dependencies:** Bylaw Ingestion Foundation (Phase 4), Annual Compliance Checklist (Phase 3), Governance Dashboard (Phase 3)
**Risks:** Incorrect extraction leads to false compliance alerts — human review gate is critical
**Open Questions:** Should AI rules be editable by admin, or fully AI-maintained?

---

### Workstream 8.4 — Managed Regulatory Record System

**Intent:** Maintain a living, jurisdiction-aware regulatory record base for CT, FL, CA, and other active markets, sourced from authoritative internet or source-document references, versioned over time, and monitored for freshness so platform compliance workflows are not powered by stale static templates.

**Functional Units:**
- 8.4.1 Regulatory Source Registry [Data]
  - Store authoritative source metadata per jurisdiction record: source URL, source authority, jurisdiction, document title, effective date, last verified date, and last updated date
- 8.4.2 Jurisdiction Record Sync and Review [Logic]
  - Fetch or stage updated regulatory records from authoritative internet sources, route changes through review, and publish approved updates into the platform record set
- 8.4.3 Regulatory Record Versioning and Effective Dating [Logic]
  - Preserve prior record versions, effective windows, and superseded content so historical compliance periods remain reproducible
- 8.4.4 Association Regulatory Applicability Overlay [Logic]
  - Apply state and jurisdiction records to associations, then layer association-specific or bylaw-specific requirements without forking the core regulatory base
- 8.4.5 Staleness Monitoring and Refresh Cadence [Logic]
  - Flag records that have not been verified within policy windows and run periodic review/update sweeps

**Dependencies:** Annual Compliance Checklist (Phase 3), Association Registry (Phase 1), Document Repository (Phase 1), AI Ingestion (Phase 4)
**Risks:** Statutory content requires legal review to remain accurate; source sites change format; automated refresh without review can propagate bad legal guidance
**Open Questions:** Which jurisdictions should receive automatic source refresh first, and what verification SLA should govern published regulatory records?

---

### Workstream 8.5 — Cross-Association Benchmarking

**Intent:** For property management companies operating multiple associations, surface comparative performance data — collection rates, maintenance turnaround times, delinquency rates — across the portfolio.

**Functional Units:**
- 8.5.1 Portfolio Overview Dashboard [UX]
  - All-associations view of key KPIs: dues collection rate, open work orders, compliance health, delinquency balance
- 8.5.2 Comparative Benchmarking Charts [Logic]
  - Rank associations on configurable metrics within the portfolio
- 8.5.3 Portfolio-Level Alerts [Logic]
  - Surface any association that crosses a configurable threshold (e.g., >10% delinquency) as a portfolio-level alert
- 8.5.4 Portfolio Report Export [UX]
  - Export a portfolio summary for management company leadership or investors

**Dependencies:** 8.1, 8.2, Multi-Association Architecture (Phase 5)
**Risks:** Data quality differences across associations affect comparability
**Open Questions:** Should benchmarks be visible to individual association boards?

---

### Workstream 8.6 — Association-Scoped Board Member Workspace

**Intent:** Allow invited board members to work directly inside a board-oriented association view with association-scoped edit rights, while ensuring owners who also serve on the board keep one combined identity.

**Functional Units:**
- 8.6.1 Board Member Invite and Activation [Security]
  - Admin invites a person into board-member access for one association; access becomes active only after invite acceptance and active board service validation
- 8.6.2 Effective Permission Resolution for Owner-Board Members [Logic]
  - If the invited person is also an owner in that association, combine owner self-service permissions with board-member workspace permissions under one sign-in
- 8.6.3 Association-Scoped Access Enforcement [Security]
  - Permit view/edit access for the invited association only; block platform-global administration and access to other associations
- 8.6.4 Board Member Workspace and Navigation [UX]
  - Present a dedicated board-oriented landing view and navigation set without exposing platform-admin-only modules
- 8.6.5 Board Access Audit and Revocation [Data]
  - Record invite, accept, suspend, revoke, and write events and remove elevated access when service ends

**Dependencies:** Board Member Registry (Phase 1), Role-Based Permissions (Phase 1), Single-Association Context, Auth/session foundations
**Risks:** Permission leakage across associations or accidental promotion into global admin behavior
**Open Questions:** Should financial editing rights ship as part of the first board-member bundle or be configurable by association policy?

---

## Phase 9 — Full Owner Self-Service and Digital Experience

**Objective:** Transform the owner portal from a read-only document viewer into a full self-service hub where owners can pay, vote, book amenities, submit requests, and sign documents without calling the management office.

**FTPH Module Alignment:** 7. Communications & Notice System (extension); 8. Platform Services, Permissions & Audit (extension); New — Owner Experience Module

---

### Workstream 9.1 — Owner Financial Dashboard

**Intent:** Give owners full visibility into their account — current balance, payment history, upcoming charges, and receipts — directly in the portal.

**Functional Units:**
- 9.1.1 Owner Balance Summary [UX]
  - Current amount due, next due date, last payment, and any outstanding assessments
- 9.1.2 Payment History Timeline [UX]
  - Chronological list of all payments, assessments, and fees on the owner's ledger
- 9.1.3 Statement Download [UX]
  - Generate and download a formatted account statement for any date range
- 9.1.4 Payment Initiation from Portal [Integration]
  - One-click payment from balance summary using saved or new payment method (requires Phase 6)

**Dependencies:** Owner Portal (Phase 5), Owner Ledger (Phase 2), Payment Gateway (Phase 6)
**Risks:** Ledger display accuracy depends on timely admin posting
**Open Questions:** Should ledger entries be fully visible to owners or only balance summaries?

---

### Workstream 9.2 — Online Voting and Ballot System

**Intent:** Conduct official association elections and resolution votes digitally with an auditable record.

**Functional Units:**
- 9.2.1 Create Ballot [Logic]
  - Board admin creates a ballot with candidates, resolution text, and voting window
- 9.2.2 Owner Ballot Access [UX]
  - Owner accesses their ballot from portal; each eligible owner receives exactly one vote
- 9.2.3 Vote Recording [Data]
  - Anonymous or attributed vote recorded against the ballot with timestamp and portal session
- 9.2.4 Ballot Result Tabulation [Logic]
  - Auto-tally on close; display results with vote counts and abstentions
- 9.2.5 Ballot Audit Record [Data]
  - Full audit log of ballot creation, voter access events, and result finalization

**Dependencies:** Owner Portal (Phase 5), Vote Records schema (existing), Board Member Registry (Phase 1)
**Risks:** Eligibility enforcement (only active owners vote) requires accurate ownership data
**Open Questions:** Should proxy voting be supported? What quorum enforcement rules apply?

---

### Workstream 9.3 — Amenity Booking and Reservation System

**Intent:** Allow owners and tenants to reserve common areas (pool, gym, clubhouse, parking) through the portal with availability enforcement.

**Functional Units:**
- 9.3.1 Amenity Configuration [Data]
  - Admin defines amenities: name, capacity, booking hours, advance notice requirement, approval required
- 9.3.2 Availability Calendar [UX]
  - Owner-facing availability view per amenity with current bookings shown
- 9.3.3 Reservation Request and Confirmation [Logic]
  - Submit reservation; auto-confirm if rules pass or route to admin approval
- 9.3.4 Reservation Conflict Detection [Logic]
  - Block overlapping reservations; enforce per-unit booking limits within a window
- 9.3.5 Reservation Cancellation and Waitlist [Logic]
  - Cancel a reservation; notify next-in-queue if waitlist exists

**Dependencies:** Owner Portal (Phase 5), Unit Registry (Phase 1), Calendar (Phase 3)
**Risks:** Conflict detection must be transactionally safe; race conditions on concurrent bookings
**Open Questions:** Should damage deposits be collected for amenity bookings? (Requires Phase 6)

---

### Workstream 9.4 — E-Signature and Digital Document Execution

**Intent:** Allow owners to digitally sign documents — governing document acknowledgements, consent forms, lease addenda, proxy forms — directly in the portal.

**Functional Units:**
- 9.4.1 Signature Request Creation [Logic]
  - Admin creates a signature request linking a document to one or more required signatories
- 9.4.2 Owner Signature UI [UX]
  - Owner views the document and applies a signature with identity confirmation
- 9.4.3 Executed Document Storage [Data]
  - Signed document stored with signature metadata (timestamp, IP, method) in Document Repository
- 9.4.4 Signature Audit Trail [Data]
  - Complete log of who signed, when, and from where; linked to the original unsigned document

**Dependencies:** Document Repository (Phase 1), Owner Portal (Phase 5)
**Risks:** Legal validity of e-signatures varies by document type and jurisdiction
**Open Questions:** Native e-signature or integrate DocuSign/HelloSign for legal standing?

---

### Workstream 9.5 — Community Announcements and Bulletin Board

**Intent:** Give boards a broadcast channel and owners a community space for news, announcements, and non-financial communication.

**Functional Units:**
- 9.5.1 Board Announcement Publishing [UX]
  - Admin/board posts announcements with title, body, visibility dates, and attachment
- 9.5.2 Announcement Feed for Owners [UX]
  - Owner portal landing page shows recent announcements ordered by publish date
- 9.5.3 Announcement Categories and Tags [Data]
  - Categorize announcements (maintenance notice, event, rule reminder, emergency alert)
- 9.5.4 Announcement Push Notification [Integration]
  - Optionally push critical announcements via email to all portal users in the association

**Dependencies:** Owner Portal (Phase 5), Communications Layer (Phase 5)
**Risks:** Announcement channel could be used for improper or disputed communications; moderation needed
**Open Questions:** Should announcements support owner replies/comments, or remain one-directional?

---

## Phase 10 — Platform Maturity, Third-Party Integrations, and Market Expansion

**Objective:** Make the platform a true enterprise SaaS product with a public integration ecosystem, SSO, white-label capabilities, a developer API, and tiered subscription infrastructure. This phase positions the platform for direct market competition and reseller distribution.

**FTPH Module Alignment:** 8. Platform Services, Permissions & Audit (extension); New — Integration Platform; New — Market Infrastructure

---

### Workstream 10.1 — Third-Party Integration Hub

**Intent:** Connect the platform to the accounting, banking, and property management systems that associations and property managers already use.

**Functional Units:**
- 10.1.1 QuickBooks Online Integration [Integration]
  - Bi-directional sync of accounts, expenses, and vendor invoices with QBO
- 10.1.2 Banking API Integration (Plaid) [Integration]
  - Direct bank feed for reconciliation without CSV import
- 10.1.3 Integration Credential Vault [Security]
  - Encrypted per-association storage of third-party API credentials
- 10.1.4 Integration Health Monitor [Logic]
  - Surface sync errors, token expiration, and data conflicts per integration
- 10.1.5 Integration Marketplace Admin UI [UX]
  - Admin dashboard to enable/disable integrations per association

**Dependencies:** Bank Reconciliation (6.4), Expense Tracking (Phase 2), Platform Controls (Phase 5)
**Risks:** Third-party API changes; data model mismatches between platform and QBO chart of accounts
**Open Questions:** Which integrations generate the most customer demand? Prioritize by pilot association survey.

---

### Workstream 10.2 — SSO and Identity Provider Integration

**Intent:** Allow enterprise property management companies to authenticate through their corporate identity provider rather than platform-local credentials.

**Functional Units:**
- 10.2.1 Google OAuth / OIDC Login [Integration]
  - Platform-level Google sign-in for admin users
- 10.2.2 Microsoft Entra ID Integration [Integration]
  - SAML/OIDC login for Microsoft-based enterprise customers
- 10.2.3 Okta and Generic SAML Support [Integration]
  - Generic SAML SP configuration for any SAML-compliant IdP
- 10.2.4 SSO-to-Role Mapping [Logic]
  - Map identity provider group memberships to platform roles automatically
- 10.2.5 Session and Token Management [Security]
  - Proper session lifetime, refresh token handling, and single logout

**Dependencies:** Auth system (Phase 1), Role-Based Permissions (Phase 1)
**Risks:** SAML configuration errors can lock customers out; recovery path must be tested
**Open Questions:** Should owner portal SSO be separate from admin SSO, or unified?

---

### Workstream 10.3 — Public API and Developer Platform

**Intent:** Expose a documented, versioned API so third-party vendors, integration partners, and enterprise customers can build on the platform.

**Functional Units:**
- 10.3.1 REST API v1 — Core Resources [Integration]
  - Public endpoints for associations, units, persons, owners, ledger (read/write)
- 10.3.2 API Key Management [Security]
  - Per-association API key generation, rotation, and scoped permission sets
- 10.3.3 Webhook Framework [Logic]
  - Event-driven webhooks for key platform events (payment received, work order closed, document uploaded)
- 10.3.4 Developer Documentation Portal [UX]
  - Public docs site with API reference, authentication guide, and sample code
- 10.3.5 API Usage Monitoring and Rate Limiting [Logic]
  - Per-key usage tracking, rate limit enforcement, and overage alerting

**Dependencies:** All core platform modules, Auth system (Phase 1)
**Risks:** Public API surface requires stable versioning discipline; breaking changes must be managed
**Open Questions:** GraphQL as a future API layer, or REST-only for v1?

---

### Workstream 10.4 — White-Label and Reseller Architecture

**Intent:** Allow property management companies to offer the platform under their own brand to their client associations, with full visual and domain customization.

**Functional Units:**
- 10.4.1 Custom Domain and Branding Configuration [UX]
  - Per-reseller: custom domain, logo, color palette, email sender name
- 10.4.2 Reseller Account Hierarchy [Data]
  - Reseller > Association > User permission tree with isolated data scopes
- 10.4.3 Reseller Billing Pass-Through [Logic]
  - Reseller is billed for all associations under their account; can mark up for their clients
- 10.4.4 Reseller Admin Portal [UX]
  - Reseller-facing management console: provision associations, manage users, view billing
- 10.4.5 White-Label Email Domain [Integration]
  - All outbound emails sent from reseller's domain, not platform domain

**Dependencies:** Multi-Association Architecture (Phase 5), Subscription Admin (Phase 5), Communications (Phase 5)
**Risks:** Brand isolation bugs could surface platform branding to end users of resellers
**Open Questions:** Should resellers have read access to all their clients' data, or only their own management records?

---

### Workstream 10.5 — Subscription Billing and Plan Management

**Intent:** Replace the stub subscription admin controls from Phase 5 with a fully operational billing engine for direct and reseller customers.

**Functional Units:**
- 10.5.1 Plan Definition and Feature Flags [Logic]
  - Define tiered plans (Starter, Growth, Enterprise) with associated feature entitlements
- 10.5.2 Subscription Lifecycle Management [Logic]
  - Trial start, plan activation, upgrade, downgrade, cancellation, and grace period logic
- 10.5.3 Usage-Based Billing Meters [Logic]
  - Metered billing for unit count, document storage volume, or API call volume
- 10.5.4 Invoice Generation and Payment [Integration]
  - Automated subscription invoices via Stripe Billing with dunning logic for failed payments
- 10.5.5 Subscription Analytics Dashboard [UX]
  - MRR, churn rate, plan distribution, trial conversion rate — internal business metrics

**Dependencies:** Payment Gateway (Phase 6), Platform Controls (Phase 5), 10.4
**Risks:** Plan feature flag enforcement must be consistent across all API and UI surfaces
**Open Questions:** Should associations be billed by unit count or flat rate per association?

---

### Workstream 10.6 — Regulatory Filing Automation

**Intent:** Automate the generation of state-required regulatory filings (annual corporate reports, notice filings) that board officers currently produce manually.

**Functional Units:**
- 10.6.1 Filing Template Library [Data]
  - Per-state library of required annual filings with their form structure and due dates
- 10.6.2 Filing Pre-Population [Logic]
  - Pull association data (name, address, board officers, registered agent) into the filing template
- 10.6.3 Filing Review and Approval Workflow [UX]
  - Board officer reviews pre-populated filing, makes corrections, and approves for submission
- 10.6.4 Filing Document Export [UX]
  - Export approved filing as a submission-ready PDF or state-specific format
- 10.6.5 Filing Due Date Tracking [Logic]
  - Surface upcoming filing deadlines in compliance dashboard with escalating reminders

**Dependencies:** State Regulatory Templates (8.4), Board Member Registry (Phase 1), Annual Compliance Checklist (Phase 3)
**Risks:** State form formats change; filing content has legal consequences if incorrect
**Open Questions:** Should the platform submit filings directly via state e-filing portals (high risk), or only generate documents for manual submission?

---

## Workstream Cross-Reference Summary

| Workstream | Phase | Primary FTPH Module | Key Upstream Dependencies |
|---|---|---|---|
| 6.1 Payment Gateway | 6 | 3. Financial Ops | Phase 5 Portal, Phase 2 Ledger |
| 6.2 Autopay Scheduling | 6 | 3. Financial Ops | 6.1, Phase 2 Fee Engine |
| 6.3 Delinquency Workflow | 6 | 3. Financial Ops | 6.1, Phase 5 Notices |
| 6.4 Bank Reconciliation | 6 | 3. Financial Ops | Phase 2 Ledger |
| 6.5 Financial Reporting | 6 | 3. Financial Ops | Phase 2 Budget, 6.3 |
| 7.1 Vendor Registry | 7 | New: Ops | Phase 1 Documents |
| 7.2 Work Order Mgmt | 7 | New: Ops | 7.1, Phase 2 Invoices |
| 7.3 Maintenance Portal | 7 | New: Ops | Phase 5 Portal, 7.2 |
| 7.4 Preventive Maintenance | 7 | New: Ops | 7.2, Phase 3 Calendar |
| 7.5 Inspection Records | 7 | New: Ops | Phase 1 Units, 7.2 |
| 8.1 Board Report Packages | 8 | New: Analytics | 6.5, Phase 3 Meetings |
| 8.2 Financial Analytics | 8 | New: Analytics | 6.5, Phase 2 Budget |
| 8.3 AI Compliance Monitor | 8 | 6. Compliance | Phase 4 AI, Phase 3 Checklist |
| 8.4 State Regulatory Templates | 8 | 6. Compliance | Phase 3 Checklist |
| 8.5 Cross-Association Benchmarking | 8 | New: Analytics | 8.1, 8.2, Phase 5 Multi-Assoc |
| 9.1 Owner Financial Dashboard | 9 | New: Owner XP | Phase 5 Portal, Phase 2 Ledger, Phase 6 |
| 9.2 Online Voting | 9 | New: Owner XP | Phase 5 Portal, Phase 1 Board |
| 9.3 Amenity Booking | 9 | New: Owner XP | Phase 5 Portal, Phase 3 Calendar |
| 9.4 E-Signature | 9 | New: Owner XP | Phase 1 Documents, Phase 5 Portal |
| 9.5 Community Announcements | 9 | 7. Communications | Phase 5 Portal, Phase 5 Comms |
| 10.1 Integration Hub | 10 | New: Integration | Phase 6 Payments, Phase 2 Expenses |
| 10.2 SSO / IdP | 10 | 8. Platform Services | Phase 1 Auth |
| 10.3 Public API | 10 | New: Integration | All core modules |
| 10.4 White-Label Architecture | 10 | New: Market Infra | Phase 5 Multi-Assoc |
| 10.5 Subscription Billing | 10 | New: Market Infra | Phase 6 Payments, Phase 5 SaaS |
| 10.6 Regulatory Filing | 10 | 6. Compliance | Phase 8 Templates, Phase 1 Board |

---

## Phasing Rationale

| Phase | Core Bet | Why Now |
|---|---|---|
| 6 | Collect money digitally | Tracking without collection is incomplete; highest operational impact per unit of effort |
| 7 | Manage physical property | Property operations are the other half of management; vendor/maintenance data feeds every future analytics use case |
| 8 | Turn data into insight | After 7 phases of data accumulation, the platform can generate meaningful board intelligence without new data entry |
| 9 | Owner becomes a participant | Portal self-service reduces management labor and improves owner satisfaction — a core SaaS retention driver |
| 10 | Platform becomes a product | Integrations, API, white-label, and billing infrastructure are what separate a good app from a market platform |

---

## Open FTPH Module Gaps to Address in v3.0

The following items should be promoted from Open Questions or Scope Boundaries in FTPH v2.1 into first-class feature sets in FTPH v3.0:

1. **Vendor Management** — referenced as a future consideration in 3.2 (Expense & Invoice Tracking); now promoted to a full module in Phase 7
2. **Maintenance and Work Orders** — not in FTPH v2.1; should become Module 9
3. **Analytics and Reporting** — not in FTPH v2.1; should become Module 10
4. **Owner Transactional Experience** — Phase 5 portal was read-only; full transactional layer should be Module 11
5. **Integration Platform** — referenced loosely in future expansion scope; should become Module 12
6. **Regulatory Filing Automation** — state-level compliance was deferred from Phase 3; should become Feature Set 6.2 (extension of Compliance module)
