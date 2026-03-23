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

const projectTitle = "Landing Page Redesign - CondoManager Public Site";
const projectDescription =
  "Redesign the CondoManager public-facing landing page to elevate visual quality, clarify persona-driven messaging, and improve conversion. Covers the full page — nav, hero, persona toggle, feature bento grid, compliance/security section, CTA canvas, and footer — using the existing Newsreader + Manrope type system and Material Design token palette.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Discovery & Strategy",
    description:
      "Establish goals, audit the current page, and align on persona messaging before any design work begins.",
    orderIndex: 1,
    tasks: [
      {
        title: "Audit current landing page — content, structure, and UX gaps",
        description:
          "Review each section of the existing page (nav, hero, persona toggle, bento grid, compliance, CTA, footer) and document what is working, what is broken, and what needs to be rethought.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Define redesign goals and success metrics",
        description:
          "Align on KPIs: conversion rate on primary CTAs, persona toggle engagement, time-on-page. Document what a successful redesign looks like.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Competitive analysis — 5 SaaS property management landing pages",
        description:
          "Review Buildium, AppFolio, Rentec Direct, Yardi, and one emerging competitor. Document layout patterns, hero messaging, feature presentation, and CTA strategies.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Define persona messaging hierarchy for Property Managers, Board Members, Residents",
        description:
          "Map which value props, features, and CTAs resonate most per persona. Informs the persona toggle section and overall copy hierarchy.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Visual Identity & Design System",
    description:
      "Refine tokens, typography, and reusable components that will be used consistently across all redesigned sections.",
    orderIndex: 2,
    tasks: [
      {
        title: "Establish color palette and token system",
        description:
          "Refine or extend the existing Material Design token system (primary, surface, container, outline variants). Ensure sufficient contrast ratios and coherent dark mode support.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Define typography scale — Newsreader (headline) + Manrope (body)",
        description:
          "Set size, weight, and line-height for H1–H4, body, label, and caption. Ensure the editorial feel of Newsreader italic is used intentionally in hero and section headings.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design reusable component library — buttons, cards, badges, icons",
        description:
          "Create components for: primary/secondary/ghost buttons, feature cards (bento tiles), pill badges, nav links, and Material Symbol icon usage guidelines.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
      {
        title: "Define spacing, shadow, and border-radius system",
        description:
          "Standardize editorial-shadow, ghost-border, and spacing tokens. Align with Tailwind config overrides (rounded-DEFAULT, lg, xl, full).",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Section-by-Section Design",
    description:
      "Produce final designs for every section of the landing page from top nav to footer.",
    orderIndex: 3,
    tasks: [
      {
        title: "Redesign Top Navigation Bar",
        description:
          "Refine the sticky nav: logo lockup, nav links (Platform, Solutions, Resources, Pricing), Sign In and Open Workspace CTAs. Design mobile hamburger variant and scroll-triggered background shift.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Redesign Hero Section — headline, subhead, CTAs, and visual",
        description:
          "Rethink the two-column hero. Evaluate the 'Architecture of Trust' badge, headline, and hero image/dashboard overlay card. Explore motion or live UI mockup alternatives to the static photo.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Redesign Persona Toggle Section",
        description:
          "Improve the 'Tailored for you' toggle for Property Managers, Board Members, and Residents. Consider animated content switching per persona rather than a static button group.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Redesign Feature Bento Grid (7 cards + featured financial card)",
        description:
          "Redesign the 4-column bento grid. Refine card hierarchy, iconography, and the large 'Real-time Financial Reporting' feature card (gradient, icon, CTA). Consider asymmetric layouts for visual interest.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
      {
        title: "Redesign Compliance & Security + CTA Canvas + Footer",
        description:
          "Redesign the two-column compliance section (audit-ready + secure access + security log mockup), the dark CTA canvas (slate-900 with background image and two CTAs), and the minimal footer.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Content & Copywriting",
    description:
      "Sharpen all copy — headlines, feature descriptions, CTAs, and social proof — to be benefit-led and persona-aware.",
    orderIndex: 4,
    tasks: [
      {
        title: "Refine hero headline and subheadline copy",
        description:
          "Test alternatives to 'Everything your association needs. Nothing it doesn't.' The headline should be punchy, benefit-led, and work with Newsreader italic emphasis. Subhead should be max 2 lines.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Write feature card microcopy for all 7 bento tiles",
        description:
          "Sharpen the title and 1–2 sentence descriptions for: Automated Dues, Maintenance Hub, Smart Archives, Mass Comms, Real-time Financial Reporting, Digital Voting, and Amenity Booking.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Finalize CTA copy and social proof stats",
        description:
          "Validate the '1,500+ communities' and '$4B in property assets' stats. Finalize CTA button labels: Get Started Free, Schedule Demo, Start Your Free Trial, Speak with an Expert.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Responsive QA & Handoff",
    description:
      "Ensure all sections work on mobile, pass accessibility checks, and are documented clearly for implementation.",
    orderIndex: 5,
    tasks: [
      {
        title: "Design mobile breakpoints for all sections",
        description:
          "Ensure every section has a designed mobile layout: stacked hero, collapsed nav, single-column bento grid, stacked compliance section, and touch-friendly CTAs.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
      {
        title: "Accessibility audit — contrast, focus states, ARIA",
        description:
          "Check all text against WCAG AA contrast ratios using the Material token palette. Verify focus rings on buttons and links. Review screen reader flow for the persona toggle.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Prepare developer handoff — specs, tokens, and annotated frames",
        description:
          "Export design specs with spacing annotations, export design tokens as CSS variables (matching the Tailwind config), and document interaction behaviors (hover states, toggle animation).",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Final design review and stakeholder sign-off",
        description:
          "Present full desktop and mobile designs to stakeholders. Collect feedback, apply final revisions, and lock designs for implementation.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
    ],
  },
];

async function upsertProject() {
  let [project] = await db.select().from(roadmapProjects).where(eq(roadmapProjects.title, projectTitle));

  if (!project) {
    [project] = await db
      .insert(roadmapProjects)
      .values({
        title: projectTitle,
        description: projectDescription,
        status: "active",
        isCollapsed: 0,
      })
      .returning();
    console.log(`Created roadmap project: ${project.title}`);
  } else {
    [project] = await db
      .update(roadmapProjects)
      .set({
        description: projectDescription,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(roadmapProjects.id, project.id))
      .returning();
    console.log(`Updated roadmap project: ${project.title}`);
  }

  for (const wsDef of workstreams) {
    let [workstream] = await db
      .select()
      .from(roadmapWorkstreams)
      .where(and(eq(roadmapWorkstreams.projectId, project.id), eq(roadmapWorkstreams.title, wsDef.title)));

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
      console.log(`  Added workstream: ${workstream.title}`);
    } else {
      [workstream] = await db
        .update(roadmapWorkstreams)
        .set({
          description: wsDef.description,
          orderIndex: wsDef.orderIndex,
          updatedAt: new Date(),
        })
        .where(eq(roadmapWorkstreams.id, workstream.id))
        .returning();
      console.log(`  Updated workstream: ${workstream.title}`);
    }

    for (const taskDef of wsDef.tasks) {
      const [existingTask] = await db
        .select()
        .from(roadmapTasks)
        .where(
          and(
            eq(roadmapTasks.projectId, project.id),
            eq(roadmapTasks.workstreamId, workstream.id),
            eq(roadmapTasks.title, taskDef.title),
          ),
        );

      if (!existingTask) {
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
        console.log(`    Added task: ${taskDef.title}`);
      } else {
        await db
          .update(roadmapTasks)
          .set({
            description: taskDef.description,
            effort: taskDef.effort,
            priority: taskDef.priority,
            updatedAt: new Date(),
          })
          .where(eq(roadmapTasks.id, existingTask.id));
        console.log(`    Updated task: ${taskDef.title}`);
      }
    }
  }
}

upsertProject()
  .then(async () => {
    await db.$client.end();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$client.end();
    process.exit(1);
  });
