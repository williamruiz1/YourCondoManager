import { eq, and } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapWorkstreams, roadmapTasks } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
};

type WorkstreamDef = {
  title: string;
  description: string;
  orderIndex: number;
  tasks: TaskDef[];
};

type ProjectDef = {
  title: string;
  description: string;
  workstreams: WorkstreamDef[];
};

const projects: ProjectDef[] = [
  {
    title: "Phase 6 - Payment Processing and Financial Automation",
    description:
      "Close the most critical operational gap: the platform tracks money owed but cannot collect it digitally. Adds payment gateway, autopay, delinquency workflow, bank reconciliation, and financial reporting.",
    workstreams: [
      {
        title: "Payment Gateway Integration",
        description: "Enable online HOA dues and assessment payments via ACH and card through a payment gateway.",
        orderIndex: 0,
        tasks: [
          {
            title: "Connect payment gateway account per association",
            description: "Configure Stripe or ACH provider credentials per association with connectivity validation on platform controls screen.",
            effort: "large",
            priority: "critical",
          },
          {
            title: "Generate owner payment link from ledger balance",
            description: "Generate a unique, secure payment link from an owner ledger balance. Link resolves against the correct owner and association.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Record inbound payment event via webhook",
            description: "Webhook-driven payment capture that writes to the owner ledger. Payment event stores gateway reference, amount, method, and timestamp.",
            effort: "medium",
            priority: "critical",
          },
          {
            title: "Owner payment method management in portal",
            description: "Allow owners to save and manage ACH/card on file via the owner portal.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Autopay Scheduling",
        description: "Allow owners to enroll in recurring autopay so monthly dues are collected without manual action.",
        orderIndex: 1,
        tasks: [
          {
            title: "Autopay enrollment flow in owner portal",
            description: "Owner enrolls saved payment method in a recurring schedule via the portal. Confirmation notice sent on enrollment.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Recurring charge runner job",
            description: "Scheduled job maps due-date fee schedules to enrolled owners and initiates charges automatically.",
            effort: "large",
            priority: "critical",
          },
          {
            title: "Autopay event log",
            description: "Records each scheduled run, charge outcome, retry state, and linked owner ledger entry.",
            effort: "small",
            priority: "high",
          },
          {
            title: "Failed payment handling and retry logic",
            description: "On payment failure: configurable retry schedule, failure notice to owner, flag for admin review and escalation.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Delinquency and Collections Workflow",
        description: "Systematic escalation of unpaid balances from soft reminder through formal collections handoff.",
        orderIndex: 2,
        tasks: [
          {
            title: "Configure per-association delinquency threshold rules",
            description: "Define escalation stages at 30/60/90 days past due per association. Rules trigger notice and collections handoff.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Automated delinquency notice sequence",
            description: "Trigger notice templates from the communications layer at each escalation stage without manual admin action.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Collections handoff record",
            description: "Mark a balance as referred to collections. Log attorney or agency contact, referral date, and balance at referral.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Delinquency dashboard for board review",
            description: "Board-facing view of all outstanding balances by aging bucket. Sortable and export-ready for board meeting packets.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Bank Reconciliation Engine",
        description: "Match posted ledger entries against bank transaction feeds to detect discrepancies.",
        orderIndex: 3,
        tasks: [
          {
            title: "Bank transaction import (CSV and API)",
            description: "Import bank statement CSV or connect via Plaid or direct bank feed API. Normalize transaction format across sources.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Auto-match engine for transactions to ledger",
            description: "Match imported transactions to existing ledger entries by amount, date, and reference. Flag unmatched items.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Unmatched transaction review UI",
            description: "Surface unmatched items for admin review. Allow manual match to existing entry or creation of a new ledger entry.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Reconciliation period closure and lock",
            description: "Lock a reconciled period to prevent retroactive ledger edits. Store closure date and admin actor.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
      {
        title: "Financial Reporting Suite",
        description: "Generate board-ready financial reports from operational data without exporting to spreadsheets.",
        orderIndex: 4,
        tasks: [
          {
            title: "Income and expense summary report",
            description: "Monthly and YTD income vs. expense summary broken down by category. Comparable to prior year period.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Reserve fund status report",
            description: "Current reserve balance, monthly contribution rate, and projected coverage against known upcoming expenses.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Accounts receivable aging report",
            description: "Outstanding owner balances aged by 30/60/90+ day buckets. Identifies highest delinquency risk per unit.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Report export to PDF and CSV",
            description: "Export any financial report as a formatted PDF for board packets or CSV for further analysis.",
            effort: "small",
            priority: "medium",
          },
        ],
      },
    ],
  },
  {
    title: "Phase 7 - Vendor, Maintenance, and Property Operations",
    description:
      "Add the operational layer the platform currently lacks: vendor management, work orders, owner/tenant maintenance requests, preventive maintenance scheduling, and property inspection records.",
    workstreams: [
      {
        title: "Vendor Registry",
        description: "Maintain a structured directory of contractors and service providers used by the association.",
        orderIndex: 0,
        tasks: [
          {
            title: "Vendor profile schema and API",
            description: "Data model for vendor profiles: name, trade category, contact info, license number, insurance expiration. Full CRUD API.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Vendor-to-association linking",
            description: "Scope vendor profiles per association or share across the portfolio with visibility controls.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Vendor document storage and attachment",
            description: "Attach insurance certificates, contracts, and W-9s to a vendor profile via the document repository.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Vendor status and insurance expiration tracking",
            description: "Flag vendors as active, inactive, or pending insurance renewal. Surface expiring certificates in the admin dashboard.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Vendor registry UI",
            description: "Admin page for creating, viewing, editing, and filtering vendor profiles by trade category and status.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Work Order Management",
        description: "Create, assign, track, and close maintenance work orders linked to units, common areas, or buildings.",
        orderIndex: 1,
        tasks: [
          {
            title: "Work order schema and API",
            description: "Data model: title, description, location (unit or common area), priority, assigned vendor, estimated cost. Full CRUD API.",
            effort: "medium",
            priority: "critical",
          },
          {
            title: "Work order lifecycle status transitions",
            description: "Status states: open → assigned → in-progress → pending review → closed. Timestamps recorded at each transition.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Work order to vendor invoice linkage",
            description: "Link a completed work order to one or more vendor invoices in the expense tracker for cost reconciliation.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Per-unit work order history view",
            description: "Admin view of all work orders for a given unit, ordered chronologically with status and cost summary.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Work order management UI",
            description: "Admin page for creating, assigning, updating, and closing work orders. Filterable by status, vendor, and unit.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Owner and Tenant Maintenance Portal",
        description: "Allow owners and tenants to submit maintenance requests through the portal, routing to admin work order creation.",
        orderIndex: 2,
        tasks: [
          {
            title: "Maintenance request submission form in portal",
            description: "Portal form for owners and tenants: issue description, category, urgency, optional photo attachment.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Request-to-work-order conversion workflow",
            description: "Admin reviews submitted requests and converts approved ones directly into work orders with one action.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Request status notifications to submitter",
            description: "Submitter receives a notice at key work order status transitions: received, in progress, completed.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Submitter request history view in portal",
            description: "Owner or tenant can view their own submission history and the current status of each request.",
            effort: "small",
            priority: "medium",
          },
        ],
      },
      {
        title: "Preventive Maintenance Scheduling",
        description: "Create recurring maintenance tasks tied to property components so nothing is missed.",
        orderIndex: 3,
        tasks: [
          {
            title: "Maintenance schedule template model",
            description: "Define recurring templates: component (HVAC, elevator, fire system), frequency, responsible party, lead time.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Schedule instance generation engine",
            description: "Auto-generate future task instances from a template at the scheduled interval. Generate rolling window of upcoming instances.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Schedule-to-work-order linkage",
            description: "When a scheduled instance comes due, automatically create a work order or prompt admin to confirm creation.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Preventive maintenance calendar view",
            description: "Calendar view of all upcoming scheduled maintenance events by component and date.",
            effort: "small",
            priority: "medium",
          },
        ],
      },
      {
        title: "Property Inspection Records",
        description: "Record unit and common area inspection results with findings, photos, and follow-up actions.",
        orderIndex: 4,
        tasks: [
          {
            title: "Inspection record schema and API",
            description: "Data model: date, inspector, location, overall condition rating, linked association. Full CRUD API.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Inspection finding line items",
            description: "Per-finding records: description, severity (minor/moderate/critical), photo attachment, remediation notes.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Finding-to-work-order linkage",
            description: "Convert an open finding into a work order directly from the inspection record with a single action.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Per-unit inspection history view",
            description: "Chronological inspection history for any unit or common area with finding summaries and open item counts.",
            effort: "small",
            priority: "low",
          },
          {
            title: "Inspection records UI",
            description: "Admin page for creating inspections, logging findings, and linking work orders. Filterable by location and date.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
    ],
  },
  {
    title: "Phase 8 - Advanced Reporting, Analytics, and Compliance Intelligence",
    description:
      "Transform the operational data accumulated in phases 1–7 into actionable board intelligence: automated report packages, financial analytics, AI-assisted compliance monitoring, state regulatory templates, and cross-association benchmarking.",
    workstreams: [
      {
        title: "Board Report Package Automation",
        description: "Auto-compile and deliver a board-ready monthly or quarterly report package from financial, governance, and operational data.",
        orderIndex: 0,
        tasks: [
          {
            title: "Report package builder configuration",
            description: "Configure which sections (financial, governance, maintenance, delinquency) appear in each package and in what order.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Scheduled package generation job",
            description: "Auto-generate packages on a configured schedule relative to the next board meeting date.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Package preview and annotation UI",
            description: "Board admins preview, annotate, and approve a generated package before it is distributed.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Package distribution via communications layer",
            description: "Distribute the approved package to board member emails using the existing communications layer.",
            effort: "small",
            priority: "medium",
          },
        ],
      },
      {
        title: "Financial Analytics and Trend Visualization",
        description: "Visualize financial trends over time: collection rates, delinquency trends, reserve fund trajectory, and expense breakdowns.",
        orderIndex: 1,
        tasks: [
          {
            title: "Dues collection rate chart",
            description: "Monthly collection percentage against posted charges over a rolling 12-month window.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Delinquency trend analysis",
            description: "Track and surface changes in balance aging profile month-over-month. Flag worsening trends.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Reserve fund projection model",
            description: "Model reserve balance over 1, 3, and 5 years given current contribution rate and known upcoming expenses.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Expense category trend chart",
            description: "Stacked bar or trend chart of expense categories by month compared to budget line allocations.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
      {
        title: "AI Compliance Monitor",
        description: "Use AI against ingested bylaws and governance records to surface compliance gaps proactively.",
        orderIndex: 2,
        tasks: [
          {
            title: "Compliance rule extraction from bylaw clause records",
            description: "Parse bylaw clause records from Phase 4 ingestion for governance obligation language and extract structured rules.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Compliance gap detector",
            description: "Cross-reference extracted obligations against platform records (meetings, budgets, board terms). Flag unmet obligations.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Compliance alert dashboard",
            description: "Board-facing dashboard of open compliance gaps with source document reference and severity rating.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Alert suppression and override with rationale",
            description: "Allow admin to mark a gap as resolved or exempt with a required written rationale stored on the record.",
            effort: "small",
            priority: "medium",
          },
        ],
      },
      {
        title: "State-Specific Regulatory Compliance Templates",
        description: "Expand the annual compliance checklist with state-specific templates pre-populated with statutory requirements.",
        orderIndex: 3,
        tasks: [
          {
            title: "State template library data model",
            description: "Library of pre-built checklist templates keyed by state with statutory obligation descriptions and due dates.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Association-level template assignment",
            description: "Assign one or more state templates to an association based on its registered state. Support multiple state templates per association.",
            effort: "small",
            priority: "high",
          },
          {
            title: "Template versioning and change tracking",
            description: "Track template version history so statutory updates do not overwrite prior compliance records.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Custom requirement overlay per association",
            description: "Allow association-level additions on top of the assigned state template for bylaw-specific obligations.",
            effort: "small",
            priority: "medium",
          },
        ],
      },
      {
        title: "Cross-Association Benchmarking",
        description: "Surface comparative performance data across the portfolio for property management companies operating multiple associations.",
        orderIndex: 4,
        tasks: [
          {
            title: "Portfolio overview dashboard",
            description: "All-associations view of key KPIs: dues collection rate, open work orders, compliance health, delinquency balance.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Comparative benchmarking charts",
            description: "Rank associations on configurable metrics within the portfolio. Highlight outliers in either direction.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Portfolio-level alert thresholds",
            description: "Surface any association crossing a configurable threshold (e.g., >10% delinquency) as a portfolio-level alert.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Portfolio summary report export",
            description: "Export a portfolio summary for management company leadership or investors as PDF or CSV.",
            effort: "small",
            priority: "low",
          },
        ],
      },
    ],
  },
  {
    title: "Phase 9 - Full Owner Self-Service and Digital Experience",
    description:
      "Transform the owner portal from a read-only document viewer into a full self-service hub where owners can pay, vote, book amenities, submit requests, and sign documents without contacting the management office.",
    workstreams: [
      {
        title: "Owner Financial Dashboard",
        description: "Give owners full visibility into their account: current balance, payment history, upcoming charges, and receipts.",
        orderIndex: 0,
        tasks: [
          {
            title: "Owner balance summary widget",
            description: "Current amount due, next due date, last payment received, and any outstanding special assessments.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Payment history timeline",
            description: "Chronological list of all payments, assessments, and fees on the owner ledger. Filterable by date range.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Account statement download",
            description: "Generate and download a formatted account statement for any selected date range as a PDF.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Payment initiation from portal balance view",
            description: "One-click payment from the balance summary using a saved or new payment method via Phase 6 gateway.",
            effort: "medium",
            priority: "critical",
          },
        ],
      },
      {
        title: "Online Voting and Ballot System",
        description: "Conduct official association elections and resolution votes digitally with a full auditable record.",
        orderIndex: 1,
        tasks: [
          {
            title: "Ballot creation by board admin",
            description: "Board admin creates a ballot with candidate names or resolution text, voting window open/close dates, and eligible voter scope.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Owner ballot access in portal",
            description: "Eligible owner accesses their ballot from the portal. Each eligible owner receives exactly one vote opportunity.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Vote recording with audit trail",
            description: "Vote is recorded against the ballot with timestamp and portal session reference. Audit log captures access and submission events.",
            effort: "medium",
            priority: "critical",
          },
          {
            title: "Ballot result tabulation on close",
            description: "Auto-tally votes on window close. Display results with vote counts, abstentions, and quorum status.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Amenity Booking and Reservation System",
        description: "Allow owners and tenants to reserve common areas through the portal with availability enforcement.",
        orderIndex: 2,
        tasks: [
          {
            title: "Amenity configuration by admin",
            description: "Admin defines amenities: name, capacity, booking hours, advance notice requirement, approval required flag.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Availability calendar for owners",
            description: "Owner-facing availability view per amenity with current bookings shown. No personally identifiable info on other bookings.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Reservation request and confirmation flow",
            description: "Submit reservation. Auto-confirm if rules pass or route to admin approval. Confirmation notice sent on approval.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Reservation conflict detection",
            description: "Block overlapping reservations. Enforce per-unit booking limits within a rolling window. Transactionally safe.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Cancellation and waitlist handling",
            description: "Cancel a reservation and notify next-in-queue if a waitlist exists for the time slot.",
            effort: "small",
            priority: "low",
          },
        ],
      },
      {
        title: "E-Signature and Digital Document Execution",
        description: "Allow owners to digitally sign governing documents, consent forms, and proxy forms directly in the portal.",
        orderIndex: 3,
        tasks: [
          {
            title: "Signature request creation by admin",
            description: "Admin creates a signature request linking a document to one or more required signatories with a completion deadline.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Owner signature UI in portal",
            description: "Owner views the document and applies a signature with identity confirmation step. Mobile-friendly layout.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Executed document storage with metadata",
            description: "Signed document stored with signature metadata (timestamp, IP, method) in the document repository.",
            effort: "small",
            priority: "high",
          },
          {
            title: "Signature audit trail",
            description: "Complete log of who signed, when, and from where. Linked to the original unsigned document for chain of custody.",
            effort: "small",
            priority: "high",
          },
        ],
      },
      {
        title: "Community Announcements and Bulletin Board",
        description: "Give boards a broadcast channel and owners a community space for news, updates, and non-financial communication.",
        orderIndex: 4,
        tasks: [
          {
            title: "Board announcement publishing UI",
            description: "Admin posts announcements with title, body, visibility dates, optional attachment, and category tag.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "Announcement feed for owners in portal",
            description: "Owner portal landing section showing recent announcements ordered by publish date. Unread indicator.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Announcement categories and tags",
            description: "Categorize announcements as maintenance notice, event, rule reminder, or emergency alert. Filterable by owners.",
            effort: "small",
            priority: "low",
          },
          {
            title: "Critical announcement push notification",
            description: "Optionally push emergency or critical announcements via email to all portal users in the association immediately.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
    ],
  },
  {
    title: "Phase 10 - Platform Maturity, Integrations, and Market Expansion",
    description:
      "Make the platform a true enterprise SaaS product with a public integration ecosystem, SSO, white-label capabilities, a developer API, tiered subscription billing, and regulatory filing automation.",
    workstreams: [
      {
        title: "Third-Party Integration Hub",
        description: "Connect the platform to accounting, banking, and property management systems that associations already use.",
        orderIndex: 0,
        tasks: [
          {
            title: "QuickBooks Online bi-directional sync",
            description: "Sync accounts, expenses, and vendor invoices between the platform and QBO. Handle chart of accounts mapping.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Plaid bank feed integration",
            description: "Direct bank feed connection via Plaid for reconciliation without manual CSV import.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Integration credential vault",
            description: "Encrypted per-association storage of third-party API credentials. Rotation and expiration tracking.",
            effort: "medium",
            priority: "critical",
          },
          {
            title: "Integration health monitor",
            description: "Surface sync errors, token expiration, and data conflicts per active integration. Alert admin on degraded state.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Integration marketplace admin UI",
            description: "Admin dashboard to enable, configure, and disable integrations per association.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
      {
        title: "SSO and Identity Provider Integration",
        description: "Allow enterprise property management companies to authenticate through their corporate identity provider.",
        orderIndex: 1,
        tasks: [
          {
            title: "Google OAuth / OIDC login for admin users",
            description: "Platform-level Google sign-in for admin users. Map Google identity to platform user record.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Microsoft Entra ID integration",
            description: "SAML/OIDC login for Microsoft-based enterprise customers. Group membership maps to platform roles.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Okta and generic SAML SP configuration",
            description: "Generic SAML service provider configuration for any SAML-compliant identity provider.",
            effort: "large",
            priority: "medium",
          },
          {
            title: "IdP group-to-platform-role mapping",
            description: "Automatically map identity provider group memberships to platform roles on login without manual role assignment.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Session lifetime and single logout",
            description: "Proper session lifetime, refresh token handling, and single logout propagation across SSO sessions.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
      {
        title: "Public API and Developer Platform",
        description: "Expose a documented, versioned API so third-party vendors and enterprise customers can build on the platform.",
        orderIndex: 2,
        tasks: [
          {
            title: "REST API v1 — core resources",
            description: "Public endpoints for associations, units, persons, ownerships, and owner ledger with authentication and scoping.",
            effort: "large",
            priority: "high",
          },
          {
            title: "API key management per association",
            description: "Per-association API key generation, rotation, and scoped permission sets. Key lifecycle management UI.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Webhook framework for platform events",
            description: "Event-driven webhooks for key platform events: payment received, work order closed, document uploaded, vote cast.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Developer documentation portal",
            description: "Public documentation site with API reference, authentication guide, webhook event catalog, and sample code.",
            effort: "medium",
            priority: "medium",
          },
          {
            title: "API usage monitoring and rate limiting",
            description: "Per-key usage tracking, rate limit enforcement by tier, overage alerting, and usage dashboard for platform admin.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
      {
        title: "White-Label and Reseller Architecture",
        description: "Allow property management companies to offer the platform under their own brand to client associations.",
        orderIndex: 3,
        tasks: [
          {
            title: "Custom domain and branding configuration",
            description: "Per-reseller: custom domain, logo, color palette, and email sender name. Applied across all association portals under the reseller.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Reseller account hierarchy",
            description: "Reseller > Association > User permission tree with fully isolated data scopes and no cross-reseller visibility.",
            effort: "large",
            priority: "critical",
          },
          {
            title: "Reseller billing pass-through",
            description: "Reseller is billed for all associations under their account at platform cost. Reseller marks up for their clients independently.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Reseller admin console",
            description: "Reseller-facing management console: provision associations, manage users, view billing, and access support.",
            effort: "large",
            priority: "high",
          },
          {
            title: "White-label outbound email domain",
            description: "All outbound emails from associations under a reseller are sent from the reseller's domain, not the platform domain.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
      {
        title: "Subscription Billing and Plan Management",
        description: "Replace stub SaaS controls from Phase 5 with a fully operational billing engine for direct and reseller customers.",
        orderIndex: 4,
        tasks: [
          {
            title: "Plan definition and feature flag system",
            description: "Define tiered plans (Starter, Growth, Enterprise) with feature entitlements enforced via feature flags across all surfaces.",
            effort: "large",
            priority: "critical",
          },
          {
            title: "Subscription lifecycle management",
            description: "Trial start, plan activation, upgrade, downgrade, cancellation, and grace period handling with state machine.",
            effort: "large",
            priority: "critical",
          },
          {
            title: "Usage-based billing meters",
            description: "Metered billing for unit count, document storage volume, or API call volume. Usage aggregated and reported to billing.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Automated invoice generation and dunning",
            description: "Subscription invoices generated via Stripe Billing with dunning logic for failed payments and grace period enforcement.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Subscription analytics dashboard",
            description: "Internal dashboard: MRR, churn rate, plan distribution, trial conversion rate, and revenue by plan.",
            effort: "medium",
            priority: "medium",
          },
        ],
      },
      {
        title: "Regulatory Filing Automation",
        description: "Automate the generation of state-required regulatory filings that board officers currently produce manually.",
        orderIndex: 5,
        tasks: [
          {
            title: "Filing template library by state",
            description: "Per-state library of required annual filings with form structure, required fields, and statutory due dates.",
            effort: "large",
            priority: "high",
          },
          {
            title: "Filing pre-population from platform data",
            description: "Pull association name, address, board officers, and registered agent from platform records into the filing template automatically.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Filing review and approval workflow",
            description: "Board officer reviews the pre-populated filing, makes corrections, and approves for submission. Approval recorded with timestamp and actor.",
            effort: "medium",
            priority: "high",
          },
          {
            title: "Filing document export as submission-ready PDF",
            description: "Export approved filing as a formatted PDF or state-specific format for manual submission.",
            effort: "small",
            priority: "medium",
          },
          {
            title: "Filing due date tracking and reminders",
            description: "Surface upcoming filing deadlines in the compliance dashboard with escalating reminders at 60, 30, and 7 days prior.",
            effort: "medium",
            priority: "high",
          },
        ],
      },
    ],
  },
];

async function upsertProject(projectDef: ProjectDef) {
  let [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, projectDef.title));

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({
        title: projectDef.title,
        description: projectDef.description,
        status: "active",
        isCollapsed: 1,
      })
      .returning();
    console.log(`  Created project: ${project.title}`);
  } else {
    console.log(`  Project already exists: ${project.title}`);
  }

  for (const wsDef of projectDef.workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(
        and(
          eq(roadmapWorkstreams.projectId, project.id),
          eq(roadmapWorkstreams.title, wsDef.title),
        ),
      );

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({
          projectId: project.id,
          title: wsDef.title,
          description: wsDef.description,
          orderIndex: wsDef.orderIndex,
          isCollapsed: 0,
        })
        .returning();
      console.log(`    Created workstream: ${wsDef.title}`);
    } else {
      console.log(`    Workstream already exists: ${wsDef.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existing] = await db
        .select()
        .from(roadmapTasks)
        .where(
          and(
            eq(roadmapTasks.projectId, project.id),
            eq(roadmapTasks.workstreamId, workstream.id),
            eq(roadmapTasks.title, taskDef.title),
          ),
        );

      if (existing) {
        console.log(`      Task already exists: ${taskDef.title}`);
        continue;
      }

      await db.insert(roadmapTasks).values({
        projectId: project.id,
        workstreamId: workstream.id,
        title: taskDef.title,
        description: taskDef.description,
        status: "todo",
        effort: taskDef.effort,
        priority: taskDef.priority,
        dependencyTaskIds: [],
      });
      console.log(`      Created task: ${taskDef.title}`);
    }
  }
}

async function run() {
  console.log("Adding Phase 6–10 roadmap projects, workstreams, and tasks...\n");

  for (const projectDef of projects) {
    console.log(`\nProcessing: ${projectDef.title}`);
    await upsertProject(projectDef);
  }

  console.log("\nPhase 6–10 roadmap setup complete.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
