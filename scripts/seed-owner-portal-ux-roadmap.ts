/**
 * Owner Portal UX Roadmap Seed Script
 *
 * Creates an admin-roadmap project for the owner portal multi-unit UX review.
 * Safe to rerun: if the project already exists by title, the script exits without
 * creating duplicates.
 *
 * Run with: npx tsx scripts/seed-owner-portal-ux-roadmap.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { roadmapProjects, roadmapWorkstreams, roadmapTasks } = schema;

const projectTitle = "Owner Portal Multi-Unit UX Review and Implementation";

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
  const [existingProject] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectTitle)).limit(1);
  if (existingProject) {
    console.log(`Roadmap project already exists: ${existingProject.id}`);
    return;
  }

  console.log("Creating owner portal UX roadmap project...");

  const project = await createProject({
    title: projectTitle,
    description:
      "End-to-end owner-portal review focused on making the owner experience calm, action-first, and explicitly supportive of multi-unit ownership. Captures service intent, current journey findings, UI/UX improvements, and verification work needed to raise owner value without overwhelming the user.",
    status: "active",
  });

  const workstreams = [
    {
      title: "Service Intent and Journey Alignment",
      description:
        "Confirm the owner portal as an owner-first self-service workspace, define multi-unit behavior, and align the journey to owner tasks rather than module sprawl.",
      orderIndex: 0,
      tasks: [
        {
          title: "Confirm owner portal service model and multi-unit interaction rules",
          description:
            "Document the intended owner experience for single-unit owners, multi-unit owners, and owner-board members. Decide what should be portfolio-level, what should be unit-level, and which actions remain safely self-service.",
          priority: "critical",
          effort: "small",
        },
        {
          title: "Map current owner journey from sign-in through recurring use",
          description:
            "Capture the current flow across login, overview, financials, units, maintenance, documents, notices, and board crossover. Record confusion points, especially where unit context is implicit or hidden.",
          priority: "high",
          effort: "small",
        },
      ],
    },
    {
      title: "Action-First Overview",
      description:
        "Turn the overview into a calm, high-signal landing experience that tells owners what needs attention next.",
      orderIndex: 1,
      tasks: [
        {
          title: "Replace passive overview content with ranked owner action cards",
          description:
            "Prioritize current balance, new notices, open maintenance items, pending contact updates, and urgent next steps. Reduce generic onboarding language once the owner becomes active.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Add plain-language owner agenda states",
          description:
            "Use states such as action needed, due soon, waiting on management, resolved, and for your records so owners understand what each item means without decoding internal workflow terms.",
          priority: "high",
          effort: "small",
        },
      ],
    },
    {
      title: "Multi-Unit Portfolio Experience",
      description:
        "Make multiple owned units feel intentionally supported through cross-unit summaries and fast drill-down.",
      orderIndex: 2,
      tasks: [
        {
          title: "Build a portfolio summary for owners with multiple units",
          description:
            "Show all-unit totals, open issues, due balances, and unit-level exceptions before dropping the user into one selected unit. Preserve fast switching, but stop making switching the primary multi-unit pattern.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Add per-unit exception chips and quick jump actions",
          description:
            "Each unit card should indicate if it has balance due, open maintenance, unread notices, or occupancy questions, with direct jumps into the relevant detailed view.",
          priority: "high",
          effort: "medium",
        },
      ],
    },
    {
      title: "Unit Detail and Contact Experience",
      description:
        "Turn the current units tab into a clearer owner workspace for unit-specific details and trusted profile data.",
      orderIndex: 3,
      tasks: [
        {
          title: "Redesign My Units into summary-plus-detail layout",
          description:
            "Replace the long repeated-card pattern with a compare-and-drill approach so owners can scan units quickly, then inspect occupants, balances, and unit-specific details without losing orientation.",
          priority: "high",
          effort: "medium",
        },
        {
          title: "Simplify contact information and update requests",
          description:
            "Separate current profile data from pending changes more clearly, reduce form friction, and explain review timing so owners trust the update workflow.",
          priority: "medium",
          effort: "small",
        },
      ],
    },
    {
      title: "Communication, Documents, and Maintenance Simplification",
      description:
        "Reframe owner-visible information around urgency and task completion instead of siloed modules.",
      orderIndex: 4,
      tasks: [
        {
          title: "Unify owner communications into a message center with unit-aware context",
          description:
            "Combine notices and maintenance-related updates under clear categories such as new, action needed, and history, while always showing which unit each message applies to.",
          priority: "high",
          effort: "medium",
        },
        {
          title: "Simplify maintenance request experience and status readability",
          description:
            "Clarify request submission, expected response times, current status, and next steps. Reduce internal workflow language and make resolution progress easier to scan.",
          priority: "high",
          effort: "small",
        },
        {
          title: "Improve document browsing with relevance and recency cues",
          description:
            "Add better grouping, clearer labels, and new/recent indicators so important association documents do not feel like a generic file list.",
          priority: "medium",
          effort: "small",
        },
      ],
    },
    {
      title: "Payment Experience and Trust Signals",
      description:
        "Make balances, charges, payments, and autopay state legible and confidence-building for owners across one or many units.",
      orderIndex: 5,
      tasks: [
        {
          title: "Reframe financials around what is due now, next, and by unit",
          description:
            "Lead with current amount due, upcoming charges, payment confirmation, and per-unit breakdowns instead of dashboard-style totals alone. Keep unit scope explicit on every financial item.",
          priority: "critical",
          effort: "medium",
        },
        {
          title: "Strengthen payment trust cues and autopay clarity",
          description:
            "Make payment method state, autopay enrollment, recent payment confirmation, and plan status easier to understand at a glance so owners feel safe completing payment tasks in the portal.",
          priority: "high",
          effort: "small",
        },
      ],
    },
    {
      title: "Role Separation, Verification, and Rollout",
      description:
        "Keep the owner portal calm even for owner-board members and verify the redesigned journey across key ownership modes.",
      orderIndex: 6,
      tasks: [
        {
          title: "Separate board workspace entry from owner tab navigation",
          description:
            "Replace the peer-level board tab with a deliberate mode switch or dedicated entry point so owner self-service and board operations do not compete in one navigation model.",
          priority: "high",
          effort: "medium",
        },
        {
          title: "Verify redesigned owner journey with single-unit, multi-unit, and owner-board-member scenarios",
          description:
            "Create a repeatable verification checklist covering sign-in, overview clarity, unit context, communications, maintenance, payments, and board-mode separation before rollout closure.",
          priority: "critical",
          effort: "small",
        },
      ],
    },
  ] as const;

  for (const workstreamInput of workstreams) {
    const workstream = await createWorkstream({
      projectId: project.id,
      title: workstreamInput.title,
      description: workstreamInput.description,
      orderIndex: workstreamInput.orderIndex,
    });

    for (const taskInput of workstreamInput.tasks) {
      await createTask({
        projectId: project.id,
        workstreamId: workstream.id,
        title: taskInput.title,
        description: taskInput.description,
        priority: taskInput.priority,
        effort: taskInput.effort,
        status: "todo",
      });
    }
  }

  console.log(`Created roadmap project: ${project.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
