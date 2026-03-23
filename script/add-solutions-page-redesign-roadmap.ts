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

const projectTitle = "Solutions Page Redesign";
const projectDescription =
  "Redesign the CondoManager solutions page to present three distinct product tracks (Self-Managed Associations, Enterprise PMC, and Resident Engagement) with architectural clarity and visual hierarchy. Covers hero section, three persona-driven solution sections, bento-grid layout for enterprise features, resident journey showcase with glass-morphism card, CTA canvas, and footer — leveraging Newsreader + Manrope typography and Material Design color system.";

const workstreams: WorkstreamDef[] = [
  {
    title: "Discovery & Strategy",
    description:
      "Align on solutions messaging, persona positioning, and content hierarchy before design production.",
    orderIndex: 1,
    tasks: [
      {
        title: "Define solutions page strategy and messaging hierarchy",
        description:
          "Clarify the three personas (self-managed boards, property management companies, residents) and their value prop ordering. Document key positioning: why each solution matters, what problems it solves, and how they connect to platform capabilities.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Content audit and opportunity map",
        description:
          "Review existing solutions messaging. Identify content gaps, redundancies, and missing CTAs. Map the feature-to-outcome flow for each persona group.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Define KPIs and conversion goals",
        description:
          "Establish success metrics: primary CTA engagement, scroll depth per section, platform signup rate from this page, demo request volume, and pricing interest.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Visual Identity & Design System Alignment",
    description:
      "Ensure all redesigned sections use consistent tokens, typography, and component patterns.",
    orderIndex: 2,
    tasks: [
      {
        title: "Refine color palette for solutions context",
        description:
          "Validate Material Design token usage across three solution sections. Ensure sufficient contrast for feature cards, dark mode parity, and accent color consistency (primary blue, secondary, tertiary for feature icons).",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Define typography and layout standards for section headers",
        description:
          "Establish H1/H2 sizing for Newsreader headlines, body copy sizing for Manrope, italic emphasis for key phrases. Lock section spacing, card padding, and feature list formatting.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design reusable card and feature-list components",
        description:
          "Create templates for: solution intro cards (icon + title + description), feature list items with hover states, icon-badge pairs, and glass-morphism floating cards for resident engagement section.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
      {
        title: "Establish bento-grid and responsive breakpoint patterns",
        description:
          "Design the enterprise solutions bento grid (8-card asymmetric layout) for desktop, tablet, and mobile. Lock column counts, card sizes, and reflow behavior per breakpoint.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Hero Section & Navigation",
    description:
      "Design the page-opening hero with clear positioning and visual hierarchy.",
    orderIndex: 3,
    tasks: [
      {
        title: "Redesign hero section headline and messaging",
        description:
          "Rethink the hero: 'The Infrastructure of Modern Excellence.' Headline should establish the three-track messaging and invite exploration. Subhead clarifies: solutions for independent boards, global firms, and residents.",
        effort: "medium",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Design hero layout and two-column split",
        description:
          "Left side: headline, subhead, visual cue to scroll. Right side: optional hero image or iconography hinting at solutions. Ensure mobile stacking is clean.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design call-to-action hierarchy in hero",
        description:
          "Primary CTA (Request Demo), optional secondary link (View Pricing). Position below subhead or in footer. Test CTA copy for messaging clarity.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Self-Managed Associations Section",
    description:
      "Design the board-focused solution track with icon features and image showcase.",
    orderIndex: 4,
    tasks: [
      {
        title: "Design section header and intro messaging",
        description:
          "Header: 'Self-Managed Associations.' Intro copy: 'Empower your board with professional-grade tools.' Establish visual hierarchy and transition from hero.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design feature card grid (3 features: Dues, Maintenance, Voting)",
        description:
          "Create cards for Dues Collection, Maintenance Hubs, and Digital Voting. Each card: icon (primary color), title, description, hover state. Layout: responsive stacking on mobile.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design background image and color overlay treatment",
        description:
          "Right-side image: modern architectural or building facade (reuse from design). Gradient overlay: primary blue to transparent. Ensure image does not overshadow feature cards.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Design section CTA and progression to next section",
        description:
          "Optional section-level CTA ('Learn More') or smooth visual transition. Establish scroll progression rhythm across page.",
        effort: "small",
        priority: "low",
        status: "todo",
      },
    ],
  },
  {
    title: "Enterprise PMC Section (Bento Grid & Feature Cards)",
    description:
      "Design the asymmetric bento grid showcasing multi-entity management features.",
    orderIndex: 5,
    tasks: [
      {
        title: "Design section header and enterprise messaging",
        description:
          "Header: 'Property Management Companies.' Subheader: 'Enterprise Scale' badge. Intro copy positions multi-entity management and sophisticated reporting.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design bento-grid layout (8 cards: 4+4 asymmetric placement)",
        description:
          "Grid structure: Centralized Reporting (large, 8-col), Multi-Entity Accounting (4-col primary blue), Vendor Management (4-col), Automated Communications (large, 8-col). Ensure visual balance and hierarchy.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Design individual feature cards with icons and descriptions",
        description:
          "Each card: title, icon, description, optional background imagery or accent color. Establish hover state (scale, shadow, light background shift).",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design interactive elements (Learn more button, icon accents)",
        description:
          "Add 'Learn about Security' button to Multi-Entity Accounting card. Ensure icon placement and text hierarchy is consistent across all cards.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Design background and visual polish for bento section",
        description:
          "Light background (surface-container), subtle shadows, optional subtle pattern or texture. Ensure cards are visually distinct but cohesive.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Resident Engagement Section",
    description:
      "Design the resident-focused journey with mobile showcase and floating glass card.",
    orderIndex: 6,
    tasks: [
      {
        title: "Design section header and resident-focused messaging",
        description:
          "Header: 'The Modern Resident Journey.' Intro: property management is about hospitality, not just maintenance. Position amenity booking, payments, and community features.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design mobile phone mockup showcase (left side)",
        description:
          "Large phone frame: 4:5 aspect ratio, rounded corners, shadow. Featured screen inside: app interface showing amenity booking or community feature. Optional status bar mockup.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design floating glass-morphism card (overlapping phone)",
        description:
          "Card: rounded, frosted/blur effect, border with transparency. Contents: calendar icon, 'Upcoming Booking' label, event (Rooftop Lounge at 7pm), time details. Position: bottom-right, slightly overlapping phone.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design numbered feature list (3 items: 01, 02, 03)",
        description:
          "Right side: Amenity Booking, One-Touch Payments, Community Bulletin. Each item: large number (italic Newsreader), title, description. Establish visual flow and spacing.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Design section background and responsive mobile layout",
        description:
          "Desktop: two-column flex. Mobile: stacked order (text, then image). Ensure phone mockup is readable on small screens.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "CTA Canvas & Footer",
    description:
      "Design closing call-to-action section and footer with navigation and social links.",
    orderIndex: 7,
    tasks: [
      {
        title: "Design CTA canvas (dark background with dotted pattern)",
        description:
          "Background: primary dark blue (primary color). Pattern: subtle white dotted grid or geometric pattern. Center: headline 'Ready to elevate your estate?' (italic), subheadline, primary CTA (Request Demo), secondary CTA (View Pricing).",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design footer layout and content structure",
        description:
          "Four-column grid: CondoManager brand + description, Solutions links, Company links, Social icons. Subheader: copyright and policy links. Ensure mobile stacking.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Design footer typography and link hierarchy",
        description:
          "Brand section: larger, stronger. Link sections: smaller, uppercase labels. Social icons: minimal, hover states. Establish color hierarchy (text, links, secondary text).",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "Responsive QA, Accessibility & Implementation Handoff",
    description:
      "Ensure all sections work across breakpoints, pass accessibility checks, and are documented for development.",
    orderIndex: 8,
    tasks: [
      {
        title: "Design mobile breakpoints for all sections (320px, 375px, 768px)",
        description:
          "Audit each section on mobile: hero stacking, feature card reflow, bento grid collapse, phone mockup responsiveness, footer layout. Ensure touch-friendly spacing and readable text.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
      {
        title: "Accessibility audit — contrast ratios, focus states, ARIA landmarks",
        description:
          "Validate all text (headlines, body, labels) against WCAG AA contrast. Design focus ring states for buttons and links. Ensure icon-only elements have labels.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Dark mode design review",
        description:
          "Ensure all sections work in dark mode: surface colors, text contrast, icon colors. Test on multiple dark backgrounds.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Prepare developer handoff — specs, tokens, and annotated frames",
        description:
          "Export design with spacing annotations, export color tokens (Material Design palette), document hover states, transition effects, and responsive breakpoint rules.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Final design review and stakeholder sign-off",
        description:
          "Present complete desktop and mobile designs. Collect feedback, apply revisions, lock designs for implementation.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
    ],
  },
  {
    title: "Development & Implementation",
    description:
      "Build and validate the solutions page HTML/React components based on final designs.",
    orderIndex: 9,
    tasks: [
      {
        title: "Build hero section component with responsive layout",
        description:
          "Implement headline, subhead, visual elements, and CTAs. Wire up links. Ensure Newsreader + Manrope fonts are applied. Test on 3–5 breakpoints.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Build self-managed associations section (cards + image)",
        description:
          "Create feature card components with icons, titles, descriptions, hover effects. Integrate background image with gradient overlay. Responsive stacking.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Build enterprise bento-grid section with 8-card layout",
        description:
          "Implement asymmetric grid layout using CSS Grid or Tailwind. Build individual card components with borders, backgrounds, shadows. Ensure responsive collapse to 4-col and 2-col on smaller screens.",
        effort: "large",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Build resident engagement section (phone mockup + floating card)",
        description:
          "Create phone frame component with image. Build glass-morphism floating card (backdrop-blur, semi-transparent background, border). Stack on mobile. Implement numbered list.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Build CTA canvas and footer sections",
        description:
          "Implement dark CTA section with pattern background. Build footer grid with all links and social icons. Responsive footer collapse.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Wire up all CTAs and navigation links",
        description:
          "Connect all 'Request Demo', 'View Pricing', and footer links to appropriate destinations. Add analytics tracking if needed.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Cross-browser and device testing",
        description:
          "Test on Chrome, Firefox, Safari, Edge. Test on iPhone, Android, iPad, common desktop sizes. Verify layout, typography, images, and interactive elements.",
        effort: "medium",
        priority: "high",
        status: "todo",
      },
      {
        title: "Accessibility compliance check (WCAG AA)",
        description:
          "Run automated accessibility tools (axe, Lighthouse). Manually test keyboard navigation and screen reader experience. Fix contrast, focus, and ARIA issues.",
        effort: "small",
        priority: "high",
        status: "todo",
      },
      {
        title: "Performance optimization and image loading",
        description:
          "Optimize images (format, size, lazy loading). Verify page load time. Minify CSS/JS. Test on 3G network simulation.",
        effort: "medium",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Dark mode testing and verification",
        description:
          "Verify dark mode support across all sections. Test color switches, text contrast, and icon visibility.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
  {
    title: "QA, Analytics, and Launch Verification",
    description:
      "Final testing, analytics setup, and production launch.",
    orderIndex: 10,
    tasks: [
      {
        title: "Create testing checklist and execute full QA",
        description:
          "Document all test cases per section, persona, breakpoint, and browser. Execute manual testing. Log and resolve issues.",
        effort: "large",
        priority: "high",
        status: "todo",
      },
      {
        title: "Set up analytics tracking for CTA engagement",
        description:
          "Track clicks on primary CTAs, scroll depth per section, time-on-page, and conversion actions (demo request, pricing interest).",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
      {
        title: "Create before/after visual documentation",
        description:
          "Capture screenshots of current vs. new solutions page. Document key improvements and design rationale.",
        effort: "small",
        priority: "low",
        status: "todo",
      },
      {
        title: "Launch solutions page to production",
        description:
          "Deploy to main branch. Monitor for errors. Verify all sections load and function correctly in production.",
        effort: "small",
        priority: "critical",
        status: "todo",
      },
      {
        title: "Post-launch monitoring and iteration feedback",
        description:
          "Monitor analytics for the first week. Collect user feedback. Document any bugs or improvements for v2.",
        effort: "small",
        priority: "medium",
        status: "todo",
      },
    ],
  },
];

async function upsertProject() {
  let [project] = await db
    .select()
    .from(roadmapProjects)
    .where(eq(roadmapProjects.title, projectTitle));

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
