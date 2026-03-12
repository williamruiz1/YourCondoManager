import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { executiveEvidence, executiveUpdates } from "../shared/schema";

type SeedEvidence = {
  evidenceType: "release-note" | "metric" | "screenshot" | "link" | "note";
  label: string;
  value: string;
};

type SeedSlide = {
  sourceKey: string;
  title: string;
  headline: string;
  problemStatement: string;
  solutionSummary: string;
  featuresDelivered: string[];
  deliveredAt: string;
  evidence: SeedEvidence[];
};

const slides: SeedSlide[] = [
  {
    sourceKey: "slide:phase1",
    title: "Phase 1 - Foundation, Registry, and Core Admin",
    headline: "Phase 1 complete: system of record is operational",
    problemStatement:
      "- Operational Core Needs: Records were scattered across tools\n- Ownership Visibility Gap: Hard to track who owns what\n- Document Access Issue: Key files were hard to find quickly",
    solutionSummary:
      "- Unified Admin Hub: One place for core records\n- Governance Clarity: Clear board and contact tracking\n- Document Control: Central storage with version history",
    featuresDelivered: [
      "Registry Foundation: Association profile and full unit list",
      "People Records: Owner and occupant tracking",
      "Board Operations: Board role assignments and history",
      "Document Management: Upload and version history",
      "Security Controls: Admin roles with audit trail",
    ],
    deliveredAt: "2026-03-07T10:00:00.000Z",
    evidence: [
      { evidenceType: "metric", label: "Operational baseline", value: "Core registry, governance roster, and document controls are all active." },
      { evidenceType: "release-note", label: "Phase 1 outcome", value: "Admin can manage complete owner/unit/board/document records in one system." },
    ],
  },
  {
    sourceKey: "slide:phase2",
    title: "Phase 2 - Financial Operations and Budget Control",
    headline: "Phase 2 complete: receivables and expense operations shipped",
    problemStatement:
      "- Financial Visibility Gap: No single view of money in and out\n- Delinquency Risk: Late balances were hard to spot early\n- Expense Consistency Issue: Records were tracked unevenly",
    solutionSummary:
      "- Revenue Tracking: Clear dues and assessment workflows\n- Balance Control: Owner ledger and late-fee processing\n- Expense Standardization: Consistent invoice and utility records",
    featuresDelivered: [
      "Charge Management: Fee schedules and special assessments",
      "Delinquency Rules: Late-fee engine",
      "Owner Balances: Ledger with status visibility",
      "Expense Capture: Vendor invoice and utility tracking",
      "Record Quality: Categories and attachments",
    ],
    deliveredAt: "2026-03-07T10:05:00.000Z",
    evidence: [
      { evidenceType: "metric", label: "Financial coverage", value: "Dues, assessments, late fees, invoices, utilities, and owner ledger modules live." },
      { evidenceType: "note", label: "MVP scope control", value: "Flat-fee-first model delivered with extensibility for future allocation methods." },
    ],
  },
  {
    sourceKey: "slide:phase3",
    title: "Phase 3 - Governance, Meetings, and Compliance Operations",
    headline: "Phase 3 complete: governance execution and deadlines centralized",
    problemStatement:
      "- Board Follow-Through Risk: Important tasks could be missed\n- Meeting Record Fragmentation: Notes lived in different places\n- Deadline Awareness Gap: Timelines were hard to track",
    solutionSummary:
      "- Governance Workflow: Central meeting and notes management\n- Annual Discipline: Checklist with task status\n- Deadline Visibility: Upcoming items surfaced clearly",
    featuresDelivered: [
      "Meeting Management: Records and minutes capture",
      "Checklist Templates: Annual compliance setup",
      "Task Operations: Generation and completion tracking",
      "Deadline Dashboard: Upcoming and overdue visibility",
      "Decision Traceability: Searchable governance history",
    ],
    deliveredAt: "2026-03-07T10:10:00.000Z",
    evidence: [
      { evidenceType: "release-note", label: "Governance stack", value: "Meetings and compliance modules are now integrated in admin operations." },
      { evidenceType: "note", label: "Risk reduction", value: "Recurring obligations can be generated, assigned, and tracked in one place." },
    ],
  },
  {
    sourceKey: "slide:phase4",
    title: "Phase 4 - Document Intelligence, Intake, and Operational Scale",
    headline: "Phase 4 complete: review-first AI intake is in production",
    problemStatement:
      "- Intake Speed Issue: Manual document entry took too long\n- Structuring Bottleneck: Raw files were hard to convert into usable records\n- Trust Requirement: AI outputs needed safer review controls",
    solutionSummary:
      "- Assisted Intake: AI-powered processing with queue visibility\n- Human Review First: Suggestions stay editable before approval\n- Full Traceability: Outputs linked back to source documents",
    featuresDelivered: [
      "Multi-Input Capture: File and pasted-text intake",
      "Processing Pipeline: AI extraction jobs and statuses",
      "Draft Suggestions: Editable metadata outputs",
      "Review Controls: Approve/reject decisions",
      "Traceability Links: Source-connected extraction records",
    ],
    deliveredAt: "2026-03-07T10:15:00.000Z",
    evidence: [
      { evidenceType: "release-note", label: "AI intake architecture", value: "Job queue + extraction + review workflow delivered in admin UI/API." },
      { evidenceType: "note", label: "Control model", value: "No autonomous production write-through without admin review." },
    ],
  },
  {
    sourceKey: "slide:phase5",
    title: "Phase 5 - Portals, Communications, and SaaS Expansion",
    headline: "Phase 5 complete: communications and platform controls delivered",
    problemStatement:
      "- Communication Consistency Gap: Outreach to owners needed structure\n- Access Clarity Need: Permissions had to be clearer\n- Scale Readiness Requirement: Growth required stronger controls",
    solutionSummary:
      "- Notice Framework: Templates and send logging\n- Permission Governance: Envelopes and admin scope controls\n- Expansion Readiness: Platform controls for broader rollout",
    featuresDelivered: [
      "Owner Communications: Notice templates and message sends",
      "Audit Trail: Communication history logs",
      "Access Model: Permission envelopes",
      "Admin Governance: User and scope controls",
      "Scale Foundation: Expansion-ready platform controls",
    ],
    deliveredAt: "2026-03-07T10:20:00.000Z",
    evidence: [
      { evidenceType: "metric", label: "Expansion capabilities", value: "Communications + platform controls are active in admin stack." },
      { evidenceType: "note", label: "Governance continuity", value: "Admin restrictions and traceability maintained as expansion features were added." },
    ],
  },
];

async function upsertSlides() {
  let created = 0;
  let updated = 0;
  let evidenceAdded = 0;

  for (let i = 0; i < slides.length; i += 1) {
    const row = slides[i];
    const [existing] = await db.select().from(executiveUpdates).where(eq(executiveUpdates.sourceKey, row.sourceKey));

    const payload = {
      title: row.title,
      headline: row.headline,
      summary: row.solutionSummary,
      problemStatement: row.problemStatement,
      solutionSummary: row.solutionSummary,
      featuresDelivered: row.featuresDelivered,
      businessValue: "Presentation-ready project summary for customer and stakeholder reviews.",
      status: "published" as const,
      sourceType: "manual" as const,
      sourceKey: row.sourceKey,
      projectId: null,
      workstreamId: null,
      taskId: null,
      deliveredAt: new Date(row.deliveredAt),
      displayOrder: i + 1,
      createdBy: "system-curated-seed",
      updatedAt: new Date(),
    };

    let updateId = "";
    if (!existing) {
      const [createdRow] = await db.insert(executiveUpdates).values(payload).returning();
      updateId = createdRow.id;
      created += 1;
    } else {
      const [updatedRow] = await db
        .update(executiveUpdates)
        .set(payload)
        .where(eq(executiveUpdates.id, existing.id))
        .returning();
      updateId = updatedRow.id;
      updated += 1;
    }

    for (const ev of row.evidence) {
      const [evExisting] = await db
        .select()
        .from(executiveEvidence)
        .where(
          and(
            eq(executiveEvidence.executiveUpdateId, updateId),
            eq(executiveEvidence.evidenceType, ev.evidenceType),
            eq(executiveEvidence.label, ev.label),
            eq(executiveEvidence.value, ev.value),
          ),
        );
      if (evExisting) continue;
      await db.insert(executiveEvidence).values({
        executiveUpdateId: updateId,
        evidenceType: ev.evidenceType,
        label: ev.label,
        value: ev.value,
        metadataJson: { seeded: true, source: row.sourceKey },
      });
      evidenceAdded += 1;
    }
  }

  console.log(`Executive slides seeded. created=${created}, updated=${updated}, evidenceAdded=${evidenceAdded}`);
}

upsertSlides()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed executive project slides:", error);
    process.exit(1);
  });
