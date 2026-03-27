import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { roadmapProjects, roadmapTasks, roadmapWorkstreams } from "../shared/schema";

type TaskDef = {
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  priority: "low" | "medium" | "high" | "critical";
  status: "todo" | "in-progress" | "done";
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
  // ── 1. SMS & Push Notifications ─────────────────────────────────────────────
  {
    title: "SMS & Push Notifications",
    description:
      "Extend the communications module beyond email to support SMS (via Twilio or equivalent) and web push notifications, enabling property managers and boards to reach residents immediately for urgent time-sensitive situations like water shutoffs, emergency repairs, security alerts, and parking notices.",
    workstreams: [
      {
        title: "SMS Integration",
        description: "Provider setup, association-level phone number config, opt-in/out management, and SMS sending from the existing announcements and communications flows.",
        orderIndex: 0,
        tasks: [
          {
            title: "Select and integrate SMS provider (Twilio or equivalent)",
            description: "Evaluate SMS providers (Twilio, Vonage, AWS SNS). Provision account, obtain number(s), and wire up a server-side SMS dispatch service. Store API credentials securely in environment config.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Association-level SMS phone number configuration",
            description: "Add SMS phone number field to tenant/association config. Allow platform admin to assign a sending number per association. Expose in platform controls.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Resident SMS opt-in / opt-out preference management",
            description: "Add opt-in/opt-out flag to person/portal-access records. Surface in owner portal profile settings. Handle STOP/START reply keywords per TCPA requirements. Log all preference changes.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "SMS send action in communications and announcements",
            description: "Add SMS as a selectable channel when sending announcements or notices. Respect opt-out list before dispatch. Show recipient count (opted-in only) before confirming send.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "SMS delivery status tracking and failure handling",
            description: "Receive delivery receipts (DLRs) from the SMS provider via webhook. Store delivery status per message per recipient. Surface failures in communication history so managers can follow up.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
        ],
      },
      {
        title: "Web Push Notifications",
        description: "Service worker setup, push subscription management for owner portal users, and push sending from the announcements flow.",
        orderIndex: 1,
        tasks: [
          {
            title: "Service worker and VAPID push subscription setup",
            description: "Register a service worker in the owner portal client. Generate VAPID keys server-side. Implement push subscription creation and storage linked to portal-access records.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Opt-in prompt on owner portal login",
            description: "Show a browser permission prompt (or a soft UI prompt first) when residents log in to the owner portal. Store subscription on acceptance. Allow dismissal without blocking access.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Push send action from announcements flow",
            description: "Add web push as a selectable channel in the announcements and communications pages. Dispatch push payloads to all subscribed residents in the association. Handle stale/expired subscriptions gracefully.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Push notification badge and click-through routing",
            description: "Configure push payloads with title, body, and icon. Set click-through URL to the relevant page in the owner portal (e.g. announcements, work order). Handle notification click events in the service worker.",
            effort: "small",
            priority: "low",
            status: "todo",
          },
        ],
      },
      {
        title: "Unified Delivery Log",
        description: "Shared notification history across email, SMS, and push with per-channel delivery receipts visible to managers.",
        orderIndex: 2,
        tasks: [
          {
            title: "Extend communication history to show channel per message",
            description: "Add channel field (email / sms / push) to the communication log. Update the communications history UI to show which channels were used per send and the delivery outcome for each.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Per-recipient delivery receipt view for managers",
            description: "Add a detail drill-down on each sent communication showing per-recipient delivery status across all channels. Flag undelivered recipients so managers can follow up manually if needed.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Rate limiting and compliance guardrails",
            description: "Enforce per-association SMS rate limits to prevent accidental spam. Validate opt-out status before every SMS dispatch. Log all TCPA-relevant events (opt-in, opt-out, message sent) for compliance audit.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
        ],
      },
    ],
  },

  // ── 2. Vendor Portal ─────────────────────────────────────────────────────────
  {
    title: "Vendor Portal",
    description:
      "Build a dedicated vendor-facing portal where contractors can log in independently, view their assigned work orders, update job status, upload completion photos, and submit invoices — keeping the full maintenance workflow inside CondoManager without requiring managers to relay information manually.",
    workstreams: [
      {
        title: "Vendor Authentication",
        description: "Invitation-based vendor login with scoped access — vendors see only associations and work orders assigned to them.",
        orderIndex: 0,
        tasks: [
          {
            title: "Vendor invitation flow",
            description: "Add an 'Invite to Portal' action on the vendor record. Generate a time-limited invitation token sent to the vendor's email. On acceptance, create a vendor portal credential scoped to that vendor's associations.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Vendor portal login (magic link or password)",
            description: "Implement a vendor-specific login page separate from the admin and owner portals. Support magic link (passwordless email) for v1. Vendor session is isolated from admin and owner sessions.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Association and work order scope enforcement",
            description: "Ensure all vendor portal API endpoints filter strictly by the authenticated vendor's assigned associations and work orders. Vendor cannot browse or access any data outside their scope.",
            effort: "medium",
            priority: "critical",
            status: "todo",
          },
        ],
      },
      {
        title: "Work Order Interface",
        description: "Mobile-friendly work order list and detail view for vendors, with status update and notes capability.",
        orderIndex: 1,
        tasks: [
          {
            title: "Vendor work order list view",
            description: "Show the vendor a list of their open, in-progress, and recently completed work orders. Display property name, unit, description, priority, and requested completion date. Mobile-optimized layout for on-site use.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Work order detail view for vendors",
            description: "Full detail page: description, location, property manager notes, priority, requested completion date, and any attachments from the manager. Read-only view of manager-added information.",
            effort: "small",
            priority: "high",
            status: "todo",
          },
          {
            title: "Vendor status update on work orders",
            description: "Allow vendor to change work order status (Accepted, In Progress, Completed, On Hold). Require a brief note on status change. Timestamp and attribute each status change to the vendor for audit trail.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Estimated completion date entry",
            description: "Vendor can set or update an estimated completion date on any active work order. Date is surfaced to property managers in the main work orders view.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Vendor notes / comments on work orders",
            description: "Vendor can add notes to a work order (e.g. parts ordered, follow-up needed). Notes are timestamped and visible to managers. Notes are read-only to the vendor once submitted.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
        ],
      },
      {
        title: "Document & Invoice Uploads",
        description: "Vendor-side file uploads for completion photos and invoice documents, linked directly to work orders.",
        orderIndex: 2,
        tasks: [
          {
            title: "Completion photo upload from vendor portal",
            description: "Vendor can upload one or more photos to a work order from the portal. Photos are stored and linked to the work order record. Immediately visible to the property manager in the main work orders page.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Invoice upload as PDF or image attachment",
            description: "Vendor can upload an invoice file (PDF or image) to a completed or in-progress work order. Invoice is linked to the work order and flagged for manager review in the financial module.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Link vendor invoice uploads to financial module for review",
            description: "When a vendor submits an invoice, create a pending invoice record in the financial-invoices module linked to the work order. Manager can review, approve, and process from the existing invoices page.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
        ],
      },
      {
        title: "Manager-Side Integration",
        description: "Real-time updates for managers when vendors act, notifications on job completion, and full visibility into vendor activity from the existing work orders page.",
        orderIndex: 3,
        tasks: [
          {
            title: "Manager notification when vendor marks a job complete",
            description: "Trigger an in-platform notification (and email) to the assigned manager when a vendor updates a work order status to Completed. Include the work order title, property, and a link to review.",
            effort: "small",
            priority: "high",
            status: "todo",
          },
          {
            title: "Vendor activity feed on work order detail (manager view)",
            description: "Show a timeline of vendor actions on each work order in the manager's existing work orders page: status changes, notes added, photos uploaded, invoices submitted — each attributed and timestamped.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Vendor portal status indicator on vendor record",
            description: "On the vendor management page, show whether the vendor has an active portal invitation, their last login date, and count of open work orders. Allows managers to quickly see vendor engagement.",
            effort: "small",
            priority: "low",
            status: "todo",
          },
        ],
      },
    ],
  },

  // ── 3. Full Digital Voting & Elections ───────────────────────────────────────
  {
    title: "Full Digital Voting & Elections",
    description:
      "Extend the existing board vote recording in the meetings module into a complete digital voting system covering formal board elections, community-wide votes, proxy submissions, unit-weighted balloting, secret ballots, and certified result reporting — all with a tamper-evident audit trail.",
    workstreams: [
      {
        title: "Election & Vote Configuration",
        description: "Creation and configuration of elections and community votes with support for multiple vote types, voting rules, and open/close dates.",
        orderIndex: 0,
        tasks: [
          {
            title: "Election / vote creation form",
            description: "Add an 'Create Election or Vote' action accessible from the board meetings and governance pages. Fields: title, description, vote type (Board Election, Resolution, Community Referendum, Amendment Ratification), open date, close date, and result visibility.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Voting rule configuration (unit-weighted vs person-weighted vs board-only)",
            description: "Allow the creator to select the voting rule for each election: 1 unit = 1 vote (unit-weighted), 1 person = 1 vote, or board members only. Rules are locked once the election opens.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Asynchronous vote period (not tied to a live meeting)",
            description: "Elections can be open for a defined period (days/weeks) independent of a meeting session. The system tracks open/closed state automatically based on the configured dates. Notify eligible voters when voting opens.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Secret ballot configuration option",
            description: "When creating a vote, allow the creator to mark it as a secret ballot. In secret mode, individual choices are anonymized after submission — only totals are visible to administrators. The voter's participation (but not choice) is recorded.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
        ],
      },
      {
        title: "Ballot & Proxy Management",
        description: "Unique ballot link generation for eligible owners, proxy designation and upload, and duplicate vote prevention.",
        orderIndex: 1,
        tasks: [
          {
            title: "Generate unique ballot tokens per eligible owner",
            description: "For each election, generate a unique, signed ballot token per eligible voter (based on active memberships and voting rule). Tokens are emailed to owners via the owner portal. Tokens expire when the election closes.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Proxy designation: owner designates another person to vote",
            description: "Owner can log in to the portal and designate a proxy — another member who will vote on their behalf. Proxy designation is timestamped and linked to the election record. Proxy holder's ballot counts for the designating unit.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Proxy document upload (scanned/PDF proxy forms)",
            description: "Accept scanned proxy form uploads as attachments to the election record. Manager can upload on behalf of an owner who submitted a physical proxy. Uploaded proxies are logged in the election audit trail.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Duplicate vote prevention per unit",
            description: "Enforce one vote per eligible unit (or person, per the voting rule). Once a ballot is cast, the token is consumed and cannot be reused. Proxy votes lock out the original voter's token.",
            effort: "medium",
            priority: "critical",
            status: "todo",
          },
        ],
      },
      {
        title: "Voting Interface (Owner Portal)",
        description: "Simple, mobile-friendly ballot UI in the owner portal with confirmation receipts for voters.",
        orderIndex: 2,
        tasks: [
          {
            title: "Owner portal ballot page",
            description: "Build a dedicated ballot page in the owner portal accessible via ballot token link or from the portal home when an election is active. Display election title, description, options, and deadline. Mobile-optimized.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Vote submission and confirmation receipt",
            description: "After the owner submits their ballot, display a confirmation screen and send an email receipt confirming their vote was recorded (choice is not included in the receipt for secret ballots). Receipt includes election name, timestamp, and a reference number.",
            effort: "small",
            priority: "high",
            status: "todo",
          },
          {
            title: "Owner view of their voting history",
            description: "In the owner portal, show a list of past and active elections the owner is eligible for, their participation status (voted / not voted / proxy designated), and the election outcome once results are certified.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
        ],
      },
      {
        title: "Results, Certification & Audit Trail",
        description: "Real-time tallying, quorum tracking, PDF result certification, and immutable audit export for legal review.",
        orderIndex: 3,
        tasks: [
          {
            title: "Real-time vote tally for administrators",
            description: "Administrators see a live running tally of votes as they come in during an open election. Tally shows votes by option, participation rate, and quorum status. In secret ballot mode, choice breakdown is shown but not individual voter selections.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Quorum tracking and election validity gate",
            description: "Compute quorum threshold based on eligible voter count and association rules. Display quorum status in real time. Flag if the election will be invalid due to insufficient participation before the close date.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Formal result certification by administrator",
            description: "Once an election closes and quorum is met, an administrator can certify the result. Certification locks the result permanently and timestamps it. Certified result is linked to the relevant meeting or governance record.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "PDF result report export",
            description: "Generate a PDF result report including: election title, voting rule, eligible voter count, participation count, quorum confirmation, vote totals by option, certification timestamp, and administrator name. Suitable for inclusion in board minutes.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Full audit trail export for legal review",
            description: "Provide an exportable audit log for each election: every ballot cast (voter, timestamp, token, proxy chain if applicable), every status change, and proxy records. In secret ballot mode, choices are anonymized but participation is traceable.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
        ],
      },
    ],
  },

  // ── 4. Document Version Control ──────────────────────────────────────────────
  {
    title: "Document Version Control",
    description:
      "Add version history to the document management module so governing documents, rules, and policies can track amendments over time. Each version stores who uploaded it, when, the effective date, and amendment notes — with rollback capability and a full audit trail for compliance and legal review.",
    workstreams: [
      {
        title: "Version Upload Flow",
        description: "UI and data model changes to link a new document upload to an existing document as a new version, with effective date and amendment notes.",
        orderIndex: 0,
        tasks: [
          {
            title: "Data model: add version chain to documents",
            description: "Add parentDocumentId and versionNumber fields to the documents table. When a document is uploaded as a new version, link it to its predecessor and auto-increment the version number. The current version flag determines which version is served by default.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Upload UI: 'New version of' option on document upload",
            description: "On the document upload form, add an optional 'This is a new version of an existing document' toggle. When enabled, show a searchable dropdown of existing documents to link to. Auto-fill name and category from the parent.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Amendment notes field on version upload",
            description: "Add a free-text 'Amendment notes' field to the upload form when creating a new version. Notes summarize what changed in this version (e.g. 'Section 4.2 updated to reflect new parking rules'). Stored and displayed in version history.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Effective date field on version upload",
            description: "Add an 'Effective date' field to the upload form for new versions. Effective date may differ from the upload date (e.g. a document adopted at a meeting on the 1st but uploaded on the 3rd). Displayed prominently in the version history.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
        ],
      },
      {
        title: "Version History View",
        description: "Document detail page showing the full version history with download access to any prior version.",
        orderIndex: 1,
        tasks: [
          {
            title: "Version history panel on document detail page",
            description: "Add a Version History tab or section to the document detail view. List all versions in reverse chronological order: version number, upload date, uploader name, effective date, and amendment notes. Current version is highlighted.",
            effort: "medium",
            priority: "high",
            status: "todo",
          },
          {
            title: "Download any prior version directly",
            description: "Each row in the version history has a Download button. Prior versions are accessible to administrators at any time. Downloads are logged in the document audit trail.",
            effort: "small",
            priority: "high",
            status: "todo",
          },
          {
            title: "Document list view: show version count and current version number",
            description: "In the main documents list, add a Version column showing the current version number (e.g. v3) and a tooltip with the version count. Helps managers quickly identify heavily-amended documents.",
            effort: "small",
            priority: "low",
            status: "todo",
          },
        ],
      },
      {
        title: "Current Version Management & Rollback",
        description: "Administrator ability to designate any prior version as the current version, with rollback logged in the audit trail.",
        orderIndex: 2,
        tasks: [
          {
            title: "Mark any version as current (rollback)",
            description: "In the version history panel, administrators can click 'Set as Current' on any prior version. This re-points the currentVersion flag to that version. Rollback is immediately reflected in the document list and owner portal.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Rollback confirmation and audit log entry",
            description: "Require confirmation before rollback (modal with the version details and a reason field). Log the rollback event: who triggered it, from which version, to which version, when, and the stated reason.",
            effort: "small",
            priority: "medium",
            status: "todo",
          },
        ],
      },
      {
        title: "Portal Visibility & Compliance Export",
        description: "Owner portal access to document versions and an exportable amendment history report for audits and legal review.",
        orderIndex: 3,
        tasks: [
          {
            title: "Owner portal: show current version by default",
            description: "Ensure the owner portal always serves the document marked as current. If a document is rolled back, the portal immediately reflects the change. Owners do not see the version picker by default.",
            effort: "small",
            priority: "high",
            status: "todo",
          },
          {
            title: "Configurable prior version access for owners",
            description: "Add a per-document setting: 'Allow owners to view version history'. When enabled, the owner portal document detail page shows the version history and allows download of any version. Disabled by default.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
          {
            title: "Amendment history report export (PDF / CSV)",
            description: "Provide an 'Export Amendment History' action on the document detail page. Generates a PDF or CSV listing all versions: version number, effective date, uploader, upload date, and amendment notes. Suitable for legal review, audits, or board presentations.",
            effort: "medium",
            priority: "medium",
            status: "todo",
          },
        ],
      },
    ],
  },
];

async function upsertProject(def: ProjectDef) {
  let [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, def.title));

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({ title: def.title, description: def.description, status: "active", isCollapsed: 0 })
      .returning();
    console.log(`\n[+] Created project: ${project.title}`);
  } else {
    [project] = await db
      .update(roadmapProjects)
      .set({ description: def.description, updatedAt: new Date() })
      .where(eq(roadmapProjects.id, project.id))
      .returning();
    console.log(`\n[~] Updated project: ${project.title}`);
  }

  for (const wsDef of def.workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, wsDef.title)));

    if (!workstream) {
      [workstream] = await db
        .insert(roadmapWorkstreams)
        .values({ projectId: project.id, title: wsDef.title, description: wsDef.description, orderIndex: wsDef.orderIndex, isCollapsed: 0 })
        .returning();
      console.log(`  [+] Workstream: ${workstream.title}`);
    } else {
      [workstream] = await db
        .update(roadmapWorkstreams)
        .set({ description: wsDef.description, orderIndex: wsDef.orderIndex, updatedAt: new Date() })
        .where(eq(roadmapWorkstreams.id, workstream.id))
        .returning();
      console.log(`  [~] Workstream: ${workstream.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existing] = await db
        .select()
        .from(roadmapTasks)
        .where(and(eq(roadmapTasks.projectId, project.id), eq(roadmapTasks.workstreamId, workstream.id), eq(roadmapTasks.title, taskDef.title)));

      if (!existing) {
        await db.insert(roadmapTasks).values({
          projectId: project.id,
          workstreamId: workstream.id,
          title: taskDef.title,
          description: taskDef.description,
          status: taskDef.status,
          effort: taskDef.effort,
          priority: taskDef.priority,
          dependencyTaskIds: [],
        });
        console.log(`    [+] Task: ${taskDef.title}`);
      } else {
        await db
          .update(roadmapTasks)
          .set({ description: taskDef.description, effort: taskDef.effort, priority: taskDef.priority, updatedAt: new Date() })
          .where(eq(roadmapTasks.id, existing.id));
        console.log(`    [~] Task (updated): ${taskDef.title}`);
      }
    }
  }
}

async function run() {
  console.log("Adding new feature roadmap projects...\n");
  for (const project of projects) {
    await upsertProject(project);
  }
  console.log("\nDone.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
