/**
 * UI Audit Roadmap Seed Script
 * Populates the admin roadmap with findings from a full UI analysis
 * conducted from both a Property Manager and Self-Managed Association perspective.
 *
 * Run with: npx tsx scripts/seed-ui-audit-roadmap.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const {
  roadmapProjects,
  roadmapWorkstreams,
  roadmapTasks,
} = schema;

async function createProject(data: schema.InsertRoadmapProject) {
  const [result] = await db.insert(roadmapProjects).values(data).returning();
  return result;
}

async function createWorkstream(data: schema.InsertRoadmapWorkstream) {
  const [result] = await db.insert(roadmapWorkstreams).values(data).returning();
  return result;
}

async function createTask(data: schema.InsertRoadmapTask) {
  const [result] = await db.insert(roadmapTasks).values(data).returning();
  return result;
}

async function main() {
  console.log("Creating UI Audit Roadmap project...");

  // ── PROJECT ─────────────────────────────────────────────────────────────────
  const project = await createProject({
    title: "UI/UX Audit — Property Manager & Self-Managed Association",
    description:
      "End-to-end findings from a full UI audit conducted from two distinct user perspectives: (1) a professional property manager overseeing multiple associations, and (2) a volunteer board member running a self-managed HOA. Tasks are organized by product area and prioritized by adoption impact.",
    status: "active",
  });

  console.log(`  ✓ Project created: ${project.id}`);

  // ── WORKSTREAM 1: Dashboard & Navigation ────────────────────────────────────
  const wsNav = await createWorkstream({
    projectId: project.id,
    title: "Dashboard & Navigation",
    description:
      "Improve the first-run experience, role-based navigation, and the dashboard's ability to surface actionable information rather than raw totals.",
    orderIndex: 0,
  });

  const navTasks: schema.InsertRoadmapTask[] = [
    {
      projectId: project.id,
      workstreamId: wsNav.id,
      title: "Replace static 'Recommended Actions' with data-driven alerts",
      description:
        "The dashboard shows static suggestions (e.g., 'review coverage') regardless of actual data. Replace with live alerts: overdue work orders, delinquent accounts, compliance deadlines, and expiring vendor insurance — all scoped to the selected association.\n\n**PM perspective:** Needs a single pane showing which of their 5+ properties has fires to put out.\n**Self-managed:** A board treasurer checking in monthly should immediately see what needs attention.",
      priority: "critical",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsNav.id,
      title: "Add quick-action buttons to the dashboard",
      description:
        "Common operations — create work order, send meeting notice, post ledger entry, invite board member — should be one click from the dashboard. Currently requires navigating 2–3 levels deep.\n\n**PM perspective:** Saves 2-3 minutes per association per day across a portfolio.\n**Self-managed:** Volunteer board members coming in monthly need shortcuts, not deep menus.",
      priority: "high",
      effort: "small",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsNav.id,
      title: "Implement role-based navigation and dashboard view",
      description:
        "Treasurer role should lead with Finance. President role should lead with Governance. Manager role should see all. Currently every role sees an identical 6-section sidebar with 20+ items.\n\n**Self-managed:** A secretary who only manages meeting minutes is overwhelmed by financial forms and payment gateway setup.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsNav.id,
      title: "Build onboarding wizard for new associations",
      description:
        "New associations face a blank slate with no guidance on setup order. Build a step-by-step wizard: (1) Create Association, (2) Add Buildings & Units, (3) Set Financial Accounts, (4) Configure Fees, (5) Invite Board Members. Include validation gates so users can't skip critical steps.\n\n**Self-managed:** This is the single biggest adoption blocker — volunteer boards give up at step 2.",
      priority: "critical",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsNav.id,
      title: "Add portfolio-level health summary for property managers",
      description:
        "Professional property managers need a cross-association view: collection rates by property, open work orders by priority, compliance gaps, upcoming meeting deadlines. The current dashboard forces them to context-switch per association with no aggregate view.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
  ];

  for (const t of navTasks) {
    await createTask(t);
  }
  console.log(`  ✓ Workstream '${wsNav.title}': ${navTasks.length} tasks`);

  // ── WORKSTREAM 2: Financial Module ───────────────────────────────────────────
  const wsFinance = await createWorkstream({
    projectId: project.id,
    title: "Financial Module",
    description:
      "Close critical gaps in the payments workflow, delinquency management, financial reporting, and cross-module financial integration.",
    orderIndex: 1,
  });

  const financeTasks: schema.InsertRoadmapTask[] = [
    {
      projectId: project.id,
      workstreamId: wsFinance.id,
      title: "Redesign Payments page — collapse 4 numbered forms into a guided workflow",
      description:
        "The current page has 4 stacked forms labeled '0', '1', '2', '3' with no explanation of whether they're sequential, optional, or mutually exclusive. Redesign as a tabbed or wizard workflow: (A) Configure payment methods, (B) Connect payment gateway (optional), (C) Generate payment links, (D) Monitor webhooks.\n\n**PM perspective:** Technical setup should not require reading source code.\n**Self-managed:** A treasurer who set up one Zelle method is confused by Stripe webhook testing appearing on the same page.",
      priority: "critical",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsFinance.id,
      title: "Connect delinquency view to communication actions",
      description:
        "The Owner Ledger has aging buckets and delinquency analytics but zero integration with communications. A property manager should be able to: select delinquent accounts → choose notice template → send notices → log action in owner history. Currently these are completely disconnected modules.\n\n**PM perspective:** This is a core daily workflow — delinquency management — and it requires leaving the financial module entirely.",
      priority: "critical",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsFinance.id,
      title: "Add automated late fee application workflow",
      description:
        "Late fee rules exist in the system but are never automatically applied. The grace days field on fee schedules is also disconnected from late fee rules. Build an automation that: applies late fees after grace period, creates ledger entries, and queues payment reminder notices.\n\n**PM perspective:** Manual late fee posting across 100+ units in multiple associations is not scalable.",
      priority: "high",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsFinance.id,
      title: "Add financial reporting: P&L, balance sheet, collection report",
      description:
        "There are no financial reports in the system. At minimum, add: (1) income/expense summary by period, (2) collection rate report by fee type, (3) budget vs. actual variance report (exportable to PDF/CSV), (4) AR aging report.\n\n**Self-managed:** Boards are legally required to present financials at annual meetings. Currently there's no way to generate these.\n**PM perspective:** CPA handoff requires structured reports — manual data copy is a liability.",
      priority: "critical",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsFinance.id,
      title: "Build accounts payable workflow for vendor invoices",
      description:
        "Vendor invoices are tracked (draft → received → approved → paid) but there's no: payment scheduling, check request workflow, approval routing, or bank reconciliation. Add an AP workflow where invoices can be flagged for payment, approved by board, and marked paid with check number.\n\n**PM perspective:** This is a gap that forces parallel spreadsheet tracking.\n**Self-managed:** Treasurer needs a simple 'invoices to pay this month' view.",
      priority: "high",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsFinance.id,
      title: "Fix budget setup UX — simplify triple-dropdown selection",
      description:
        "Budget page requires 3 cascading dropdowns (Association → Budget → Version) before any data is shown. Streamline to default to the current/active budget for the selected association with a clear 'select different budget' option. Also add inline explanations of version statuses (what does 'proposed' mean for a board?).\n\n**Self-managed:** This is the top abandonment point in the financial module.",
      priority: "high",
      effort: "small",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsFinance.id,
      title: "Add payment plan support for delinquent accounts",
      description:
        "There is no way to set up a payment arrangement for an owner who is delinquent. Add a payment plan workflow: propose plan → board approves → owner receives terms → payments tracked against plan → late fees suspended during active plan.\n\n**PM perspective:** Payment plans reduce collections costs and keep owners in good standing.",
      priority: "medium",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsFinance.id,
      title: "Add bulk CSV import for owner ledger entries",
      description:
        "Ledger entries must be created one at a time. Add CSV import for bulk posting of payments received (e.g., from bank statement). Format: unit, date, amount, type, memo.\n\n**PM perspective:** End-of-month bank reconciliation requires importing 50-200 payments at once.",
      priority: "medium",
      effort: "medium",
      status: "todo",
    },
  ];

  for (const t of financeTasks) {
    await createTask(t);
  }
  console.log(`  ✓ Workstream '${wsFinance.title}': ${financeTasks.length} tasks`);

  // ── WORKSTREAM 3: Governance Module ─────────────────────────────────────────
  const wsGov = await createWorkstream({
    projectId: project.id,
    title: "Governance Module",
    description:
      "Close workflow gaps in meetings, compliance, board packages, and board member management that currently require off-platform coordination.",
    orderIndex: 2,
  });

  const govTasks: schema.InsertRoadmapTask[] = [
    {
      projectId: project.id,
      workstreamId: wsGov.id,
      title: "Add meeting notice generation integrated with Communications",
      description:
        "Creating a meeting does not trigger any owner notice. Add a 'Generate Notice' action on the meeting form that: selects a meeting notice template, pre-fills meeting details (date, time, location, agenda), and sends via the communications module.\n\n**Self-managed:** Legally required notice is currently a fully manual, off-platform step.\n**PM perspective:** Each association may have different notice requirements (7 days, 14 days) — should be configurable.",
      priority: "critical",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsGov.id,
      title: "Add quorum tracking and attendance roster to meetings",
      description:
        "Votes are recorded but there's no attendance tracking. A meeting with < quorum can't legally proceed. Add an attendance roster per meeting that (1) validates quorum before allowing vote recording, and (2) persists attendance for minutes generation.\n\n**Self-managed:** A common board mistake is holding a vote without verifying quorum — this creates legal exposure.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsGov.id,
      title: "Build minutes generation from meeting notes",
      description:
        "Meeting notes can be added but minutes must be manually composed elsewhere. Add a 'Generate Minutes' action that formats notes + resolutions + attendance into a structured minutes template. Include a minutes approval workflow: draft → board review → ratified → distributed.\n\n**PM perspective:** Eliminates hours of manual formatting per meeting.\n**Self-managed:** Boards consistently underinvest in documentation — automation increases compliance.",
      priority: "high",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsGov.id,
      title: "Add resolution numbering and searchable resolution index",
      description:
        "Resolutions are created without numbering. There is no way to search or filter resolutions across meetings. Add auto-numbering (e.g., RES-2025-001), categorization (financial, rule change, approval), and a searchable resolution index page.\n\n**PM perspective:** Clients ask 'did we pass a resolution on short-term rentals?' — currently requires manually scanning each meeting.",
      priority: "medium",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsGov.id,
      title: "Add compliance deadline reminders and escalation",
      description:
        "Compliance tasks have status and due dates but no automated reminders. Add: email reminders at 30/14/7 days before deadline, escalation to property manager when overdue, and a 'compliance readiness' percentage on the dashboard.\n\n**Self-managed:** Annual meeting, audit deadline, reserve study — these slip without prompts.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsGov.id,
      title: "Fix board package distribution — add recipient management and delivery tracking",
      description:
        "Board packages can be 'distributed' but the recipient list is ad-hoc email entry each time. Add: (1) default board recipient list per association, (2) delivery tracking (sent/opened/bounced), (3) re-send capability, (4) portal attachment so board members can access packages in the portal.\n\n**PM perspective:** No proof of delivery is a liability issue — 'I never received the package' is a common board complaint.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsGov.id,
      title: "Add board term expiration tracking and vacancy alerts",
      description:
        "Board roles have end dates but there's no alert when a term is approaching expiration or when a position becomes vacant. Add a 'board roster health' indicator showing vacant seats and roles expiring within 90 days.\n\n**Self-managed:** Boards routinely miss election requirements because terms expire unnoticed.",
      priority: "medium",
      effort: "small",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsGov.id,
      title: "Add compliance document upload for completed governance tasks",
      description:
        "Compliance tasks can be marked complete but there's no way to attach proof (meeting minutes, filed documents, signed forms). Add a document attachment field to each governance task so the audit trail has evidence.\n\n**PM perspective:** When associations face audits or legal challenges, documented compliance is the defense.",
      priority: "medium",
      effort: "small",
      status: "todo",
    },
  ];

  for (const t of govTasks) {
    await createTask(t);
  }
  console.log(`  ✓ Workstream '${wsGov.title}': ${govTasks.length} tasks`);

  // ── WORKSTREAM 4: Operations Module ─────────────────────────────────────────
  const wsOps = await createWorkstream({
    projectId: project.id,
    title: "Operations Module",
    description:
      "Improve work order management, vendor oversight, inspection workflows, and preventive maintenance to reduce reactive maintenance costs.",
    orderIndex: 3,
  });

  const opsTasks: schema.InsertRoadmapTask[] = [
    {
      projectId: project.id,
      workstreamId: wsOps.id,
      title: "Add vendor assignment notifications for work orders",
      description:
        "When a work order is assigned to a vendor, the vendor receives no notification. Add email notification to vendor contact with: work order details, location, priority, and a link to acknowledge/respond. Track acknowledgment status in the work order.\n\n**PM perspective:** Vendors currently call to ask if assignments are real — no closed-loop confirmation.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsOps.id,
      title: "Add photo upload and before/after documentation to work orders",
      description:
        "Work orders have no photo upload capability. Vendors and managers should be able to attach photos at different stages (reported condition, in-progress, completed). This is essential for insurance claims and vendor accountability.\n\n**PM perspective:** Photo documentation is standard in AppFolio/Buildium — its absence is a blocker for professional use.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsOps.id,
      title: "Add SLA enforcement and escalation for work orders",
      description:
        "Work orders have priority levels but no response/completion time targets. Add configurable SLAs: urgent = 4hr response / 24hr completion, high = 24hr/72hr, etc. Alert property manager when SLA is breached.\n\n**PM perspective:** SLA tracking is a client KPI — currently there's no way to show response time metrics.",
      priority: "medium",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsOps.id,
      title: "Build vendor performance metrics dashboard",
      description:
        "Vendors have no performance tracking. Add: (1) total work orders assigned/completed, (2) average cost per category, (3) on-time completion rate, (4) re-work frequency. Display on vendor profile and in a vendor comparison report.\n\n**PM perspective:** Bid comparisons and vendor replacement decisions require this data.",
      priority: "medium",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsOps.id,
      title: "Add automated vendor insurance renewal alerts",
      description:
        "Insurance expiry dates are stored but there's no automated alert when insurance is approaching expiration. Add email alerts at 60/30/14 days before expiry to both the property manager and the vendor contact. Flag expired insurance on work order assignment.\n\n**Self-managed:** Allowing uninsured vendors to work on property is a direct liability — this is non-negotiable.",
      priority: "high",
      effort: "small",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsOps.id,
      title: "Connect inspection findings to work order creation",
      description:
        "Inspection findings have status (open/monitoring/resolved) but no direct link to work orders. Add a 'Create Work Order' action on open findings that pre-populates work order with finding details, location, and urgency rating.\n\n**PM perspective:** Currently requires copy-pasting inspection notes into a separate work order — creates data drift.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsOps.id,
      title: "Add work order status notifications to requesting residents",
      description:
        "When a resident submits a maintenance request, they receive no status updates. Add automated notifications when: request is converted to work order, vendor is assigned, work is completed. Notification should go via email and appear in the owner portal.\n\n**Self-managed:** 'Where is my repair?' is the #1 resident complaint in HOAs.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsOps.id,
      title: "Build preventive maintenance schedule and asset registry",
      description:
        "There's a maintenance schedules page but no underlying asset registry. Add common association assets (HVAC, roof, elevator, pool, etc.) with expected service intervals. Generate preventive maintenance work orders automatically per schedule.\n\n**PM perspective:** Preventive maintenance tracking is a contractual obligation in management agreements.",
      priority: "medium",
      effort: "large",
      status: "todo",
    },
  ];

  for (const t of opsTasks) {
    await createTask(t);
  }
  console.log(`  ✓ Workstream '${wsOps.title}': ${opsTasks.length} tasks`);

  // ── WORKSTREAM 5: Communications & Notifications ─────────────────────────────
  const wsComms = await createWorkstream({
    projectId: project.id,
    title: "Communications & Notifications",
    description:
      "Integrate the communications module with all other product areas, add a template library, and build automated notification sequences for critical workflows.",
    orderIndex: 4,
  });

  const commsTasks: schema.InsertRoadmapTask[] = [
    {
      projectId: project.id,
      workstreamId: wsComms.id,
      title: "Build automated payment reminder sequence",
      description:
        "There is no automated payment reminder workflow. Build a configurable sequence: (1) dues notice 5 days before due date, (2) first reminder 3 days past due, (3) second reminder 14 days past due, (4) late fee notice when applied. Each template should pull owner name, amount, and payment link dynamically.\n\n**PM perspective:** Collection rate improvement is the #1 ROI feature for management companies.\n**Self-managed:** Manual reminder calls are the most time-consuming board task.",
      priority: "critical",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsComms.id,
      title: "Add template variable reference panel to notice editor",
      description:
        "Notice templates use {{variables}} but there's no documented list of available variables in the UI. Users must guess variable names. Add a sidebar panel showing all available variables with descriptions and example values. Validate variables at save time.\n\n**Self-managed:** Boards send notices with broken {{variables}} due to typos — this is an embarrassment.",
      priority: "high",
      effort: "small",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsComms.id,
      title: "Add notice preview and recipient list confirmation before send",
      description:
        "Notices can be sent to 'all owners' without previewing who is in the recipient list or what the rendered email will look like. Add: (1) rendered preview mode for any template, (2) show exact recipient list before send, (3) require confirmation with count displayed.\n\n**PM perspective:** Sending wrong notices to wrong recipients is a client relations crisis.",
      priority: "critical",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsComms.id,
      title: "Add delivery tracking and bounce handling to notices",
      description:
        "Emails are sent but there's no visibility into delivery status, open rates, or bounces. Add per-send tracking: sent count, delivered, opened, bounced, unsubscribed. Flag bounced addresses for contact update. For legal notices, add proof-of-mailing report.\n\n**PM perspective:** 'We sent the notice' requires proof for disputes and hearings.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsComms.id,
      title: "Build notice template library with pre-built HOA templates",
      description:
        "The system has 3 hardcoded templates. Add a library of 20+ pre-built templates: annual meeting notice, special assessment notice, rule violation notice, welcome letter, payment reminder series, maintenance notice, insurance request, move-in/move-out notice. Organize by category.\n\n**Self-managed:** Boards don't know what legally required notices look like — pre-built templates reduce risk.",
      priority: "high",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsComms.id,
      title: "Add emergency mass notification capability",
      description:
        "There's no way to send urgent/emergency notifications. Add an 'Emergency Alert' workflow for situations like water shutoff, building access issues, or safety events. Should support: all units in a building, all association members, with immediate send (no scheduling delay).\n\n**Self-managed:** A burst pipe at 11pm requires immediate mass notification — no current path exists.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
  ];

  for (const t of commsTasks) {
    await createTask(t);
  }
  console.log(`  ✓ Workstream '${wsComms.title}': ${commsTasks.length} tasks`);

  // ── WORKSTREAM 6: Owner Portal & Self-Service ────────────────────────────────
  const wsPortal = await createWorkstream({
    projectId: project.id,
    title: "Owner Portal & Self-Service",
    description:
      "Complete the owner-facing portal with payment, document access, maintenance request submission, and contact management — reducing inbound service calls for property managers.",
    orderIndex: 5,
  });

  const portalTasks: schema.InsertRoadmapTask[] = [
    {
      projectId: project.id,
      workstreamId: wsPortal.id,
      title: "Add online payment capability to owner portal",
      description:
        "The owner portal shows account balance but has no payment functionality. Connect the payment link generation workflow to display a 'Pay Now' button on the owner portal dashboard that shows current balance and accepts payment.\n\n**PM perspective:** Online payment is the single highest-impact resident-facing feature.\n**Self-managed:** Reduces check collection, manual posting, and deposit runs.",
      priority: "critical",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsPortal.id,
      title: "Add document access to owner portal",
      description:
        "Owners have no way to access association documents (CC&Rs, rules, meeting minutes) through the portal. Add a 'Documents' section in the portal that shows documents with portal visibility set to 'owner' or 'public', with category filtering.\n\n**Self-managed:** 'Where are the rules?' is the most common new-owner question — portal access eliminates it.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsPortal.id,
      title: "Add maintenance request submission from owner portal",
      description:
        "Owners cannot submit maintenance requests through the portal. Add a form allowing owners to: describe the issue, select category, indicate urgency, and attach photos. Automatically creates a maintenance request linked to their unit.\n\n**PM perspective:** Email/phone maintenance reporting is hard to track — portal submissions create an automatic audit trail.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsPortal.id,
      title: "Add contact info self-update in owner portal",
      description:
        "Owners cannot update their contact information. Contact update requests exist in the data model but there's no portal UI. Add a 'My Profile' section where owners can submit contact info changes, which route to a manager for approval before applying.\n\n**PM perspective:** Outdated contact info causes missed notices — having owners self-maintain reduces manual updates.",
      priority: "medium",
      effort: "small",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsPortal.id,
      title: "Add owner portal onboarding flow for new residents",
      description:
        "New owners/tenants gain portal access but see a blank dashboard with no guidance. Add a first-login onboarding flow: (1) confirm contact info, (2) set notification preferences, (3) review key documents (rules, move-in checklist), (4) see payment methods available.\n\n**Self-managed:** Board members spend hours onboarding new residents — portal onboarding eliminates most of this.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsPortal.id,
      title: "Add account statement and payment history view in portal",
      description:
        "Owners cannot see their payment history or account statement in the portal. Add a paginated transaction history showing: date, description, amount, running balance, and payment method. Allow export to PDF.\n\n**PM perspective:** 'What did I pay?' is the most common owner question — portal self-service eliminates the support call.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
  ];

  for (const t of portalTasks) {
    await createTask(t);
  }
  console.log(`  ✓ Workstream '${wsPortal.title}': ${portalTasks.length} tasks`);

  // ── WORKSTREAM 7: Data Integrity, Audit & Reporting ──────────────────────────
  const wsData = await createWorkstream({
    projectId: project.id,
    title: "Data Integrity, Audit & Reporting",
    description:
      "Address data quality gaps, add missing audit trails, and build reporting capabilities required for professional and legal compliance use cases.",
    orderIndex: 6,
  });

  const dataTasks: schema.InsertRoadmapTask[] = [
    {
      projectId: project.id,
      workstreamId: wsData.id,
      title: "Add visible audit trail / change history to financial records",
      description:
        "Financial records (ledger entries, budget amounts, fee schedules) can be modified without any change history visible to users. While audit_logs exist in the database, they're not surfaced in the UI. Add a 'History' tab or expandable row on financial records showing who changed what and when.\n\n**PM perspective:** CPA audit requirements include change logs — this is a compliance necessity for managed accounts.\n**Self-managed:** Board member accountability requires transparency in financial edits.",
      priority: "critical",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsData.id,
      title: "Add two-person approval for material financial changes",
      description:
        "Any authorized user can currently modify ledger amounts, ratify budgets, or void invoices without a second approval. Add configurable approval workflows: (1) ledger entries above a threshold require board approval, (2) budget ratification requires designated board vote record, (3) invoice approval requires manager + board-admin sign-off.\n\n**PM perspective:** Fraud prevention is a core fiduciary requirement — no dual-control is a liability.",
      priority: "high",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsData.id,
      title: "Add orphaned record warnings and data relationship validation",
      description:
        "Deleting a vendor doesn't warn about assigned work orders. Removing an owner doesn't check for ledger balances. Add relationship validation: warn before deleting entities that have dependent records, and run a background orphan-detection sweep that flags data anomalies on the dashboard.\n\n**PM perspective:** Orphaned data causes reconciliation issues discovered months later.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsData.id,
      title: "Add CSV/Excel export to all data tables",
      description:
        "No data table in the application supports export. Add CSV export to: owner ledger, fee schedule, delinquency report, work order list, vendor list, compliance tasks, meeting list. This is foundational for accountants, attorneys, and board member review.\n\n**Self-managed:** Boards need to present data at annual meetings — lack of export forces manual transcription.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsData.id,
      title: "Add bulk CSV import for owner/unit data",
      description:
        "Owner and unit data must be entered one record at a time. Add CSV import for: (1) units with building assignment, (2) owners with unit/ownership linkage, (3) ledger entries for balance migration. Include validation preview before committing.\n\n**PM perspective:** Onboarding a new 200-unit association requires importing data — one-by-one entry is not viable.",
      priority: "high",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsData.id,
      title: "Improve empty state messaging with actionable next steps",
      description:
        "Empty states across the app say 'No [X] yet' but don't explain what to do first, in what order, or why it matters. Rewrite all empty states with: (1) what this section is for, (2) what you need to set up first, (3) a direct action button.\n\n**Self-managed:** Most module abandonment happens on first visit when the page is empty and there's no guidance.",
      priority: "medium",
      effort: "small",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsData.id,
      title: "Add insurance tracking for association-level policies (D&O, fidelity bond, master policy)",
      description:
        "Vendor insurance is tracked but there's no place to record the association's own insurance: master property policy, D&O insurance for board members, fidelity bond. Add an 'Association Insurance' section with policy details and expiry alerts.\n\n**Self-managed:** Board members are personally liable if D&O coverage lapses — this is a critical compliance gap.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
  ];

  for (const t of dataTasks) {
    await createTask(t);
  }
  console.log(`  ✓ Workstream '${wsData.title}': ${dataTasks.length} tasks`);

  // ── WORKSTREAM 8: UX Polish & Accessibility ──────────────────────────────────
  const wsUX = await createWorkstream({
    projectId: project.id,
    title: "UX Polish & Accessibility",
    description:
      "Address interaction design anti-patterns, dense forms, and missing confirmations that cause user errors or loss of confidence in the system.",
    orderIndex: 7,
  });

  const uxTasks: schema.InsertRoadmapTask[] = [
    {
      projectId: project.id,
      workstreamId: wsUX.id,
      title: "Add confirmation/review screens before irreversible actions",
      description:
        "Several critical actions have no confirmation: distributing a board package, sending a bulk notice, ratifying a budget, voiding an invoice. Add a confirmation step that shows a summary of what will happen and who will be affected, with a required explicit confirmation.\n\n**PM perspective:** Accidental sends to all owners of a wrong notice are client-relationship crises.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsUX.id,
      title: "Add contextual help tooltips and field descriptions to complex forms",
      description:
        "Technical fields like 'Publishable Key', 'Webhook Secret', 'Grace Days', 'Budget Version', and 'Obligation Type' have no explanations. Add tooltip icons (?) on every non-obvious field with a plain-language explanation and example value.\n\n**Self-managed:** A treasurer who doesn't understand 'grace days' will either skip the field or set it wrong.",
      priority: "high",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsUX.id,
      title: "Add global search across all modules",
      description:
        "There is a command palette UI but no cross-module search. Property managers need to search by owner name, unit number, work order title, or vendor name and navigate directly to the record. Implement full-text search across: persons, units, work orders, vendors, meetings.\n\n**PM perspective:** 'Find owner Smith' currently requires knowing which association they're in and navigating there.",
      priority: "medium",
      effort: "large",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsUX.id,
      title: "Add loading state indicators for long-running operations",
      description:
        "Board package generation, bulk notice sends, and scheduled sweeps can take seconds with no feedback. Users click away thinking nothing happened. Add progress indicators or status messages for any operation that may take > 1 second.\n\n**PM perspective:** Duplicate board packages were generated by impatient users clicking the button multiple times.",
      priority: "medium",
      effort: "small",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsUX.id,
      title: "Add saved filters and date range presets to all table views",
      description:
        "Every list view resets to defaults on navigation. Add: (1) saved filter sets ('My open work orders', 'Delinquent accounts > 60 days'), (2) date range presets ('This month', 'This quarter', 'YTD'), (3) filter persistence within a session.\n\n**PM perspective:** Re-applying the same 5 filters on every visit is a daily friction point.",
      priority: "medium",
      effort: "medium",
      status: "todo",
    },
    {
      projectId: project.id,
      workstreamId: wsUX.id,
      title: "Audit and fix color-only status indicators for accessibility",
      description:
        "Status badges (work order priority, invoice status, compliance gaps) use color as the sole differentiator. Users with color vision deficiency cannot distinguish statuses. Add icon + text label to all status indicators. Conduct a full WCAG 2.1 AA audit.\n\n**PM perspective:** ADA compliance in software is increasingly a procurement requirement for large management companies.",
      priority: "medium",
      effort: "medium",
      status: "todo",
    },
  ];

  for (const t of uxTasks) {
    await createTask(t);
  }
  console.log(`  ✓ Workstream '${wsUX.title}': ${uxTasks.length} tasks`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalTasks =
    navTasks.length +
    financeTasks.length +
    govTasks.length +
    opsTasks.length +
    commsTasks.length +
    portalTasks.length +
    dataTasks.length +
    uxTasks.length;

  console.log(`\n✅ Done. Project '${project.title}' created with:`);
  console.log(`   8 workstreams`);
  console.log(`   ${totalTasks} tasks`);
  console.log(`\nProject ID: ${project.id}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
