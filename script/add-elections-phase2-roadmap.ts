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

const project: ProjectDef = {
  title: "Elections & Voting — Phase 2",
  description:
    "The Phase 1 elections module established the foundational data model, ballot token system, proxy management, and tally engine. Phase 2 addresses the critical experience gaps that make the module feel incomplete in practice: ballot tokens are never delivered to voters, the owner portal voting experience is absent, election results can't be exported as a proper PDF, candidates have no profile pages, and elections are disconnected from the meetings and governance modules. This project makes elections a fully self-contained, end-to-end workflow that property managers can rely on without workarounds.",
  workstreams: [
    // ── 1. Voter Outreach & Ballot Delivery ─────────────────────────────────────
    {
      title: "Voter Outreach & Ballot Delivery",
      description:
        "Automated email delivery of ballot tokens when voting opens, plus deadline reminders for non-voters. Currently ballot tokens exist in the database but there is no mechanism to send them to voters — managers have no way to distribute ballots without manual intervention.",
      orderIndex: 0,
      tasks: [
        {
          title: "Send ballot token emails when voting opens",
          description:
            "When an administrator opens an election (status → open), automatically send each eligible voter an email containing their unique ballot link (/vote/:token). Email should include the election title, description, open/close dates, and a clear CTA button. Use the association's configured email sender. Log the sentAt timestamp on each token record.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Voting reminder emails for outstanding tokens",
          description:
            "Send an automated reminder email 24–48 hours before an election closes to all voters whose token status is still 'pending' (not yet voted). Reminder should show the deadline in plain language and repeat the ballot link. Administrators should be able to trigger reminders manually at any time from the election detail panel.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Manual resend ballot link to individual voter",
          description:
            "On the election detail page, add a 'Resend ballot' action per token row in the voter list. Allows managers to re-send the ballot email to a voter who lost or didn't receive the original. Resend reuses the same token — it does not generate a new one.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Ballot delivery status in voter list",
          description:
            "In the election detail voter list, add a Delivered column showing the sentAt timestamp and delivery status (sent / failed / not sent). Failed deliveries should surface as an actionable warning so managers can investigate bounce issues before the election closes.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 2. Owner Portal Voting Experience ───────────────────────────────────────
    {
      title: "Owner Portal Voting Experience",
      description:
        "The owner portal currently has no visible elections section. Owners cannot see active elections, check whether they've voted, review results after certification, or view their voting history. This workstream builds the complete resident-facing voting experience inside the portal.",
      orderIndex: 1,
      tasks: [
        {
          title: "Owner portal: active elections dashboard card",
          description:
            "On the owner portal home page, show a prominent card or alert for any election that is currently open and the owner has not yet voted. Card should display the election title, close date, and a 'Cast your ballot' CTA. Disappears once the owner has voted or the election closes.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Owner portal: elections list page",
          description:
            "Add an Elections section to the owner portal navigation. The list page shows all elections for the association: active, upcoming, and past. Each row displays title, type, status, open/close dates, and the owner's participation status (voted, not voted, proxy designated, ineligible). Filter tabs for active and past elections.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Owner portal: election detail and results view",
          description:
            "Clicking an election in the portal shows the full detail: description, ballot options, close date, and the owner's participation status. Once results are certified and result visibility is set to 'public', show the final vote tallies and the winning option(s). For open elections, link to the ballot page if the owner hasn't voted.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Owner portal: voting history record",
          description:
            "Show a personal voting history for the logged-in owner: every election they were eligible for, whether they voted or designated a proxy, and the election outcome. Participation status is always shown; for non-secret elections, show the owner's own choice. This gives owners a permanent record they can reference.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 3. Candidate Profiles & Nomination Management ───────────────────────────
    {
      title: "Candidate Profiles & Nomination Management",
      description:
        "Board elections currently present bare candidate names as ballot options with no supporting context. Owners have no way to evaluate candidates. This workstream adds a nomination workflow, candidate bio pages, and rich ballot option display for board elections.",
      orderIndex: 2,
      tasks: [
        {
          title: "Candidate bio fields on election ballot options",
          description:
            "Extend the electionOptions table with candidate-specific fields: bio (rich text), photo URL, current role (if incumbent), and nomination statement. These fields are optional and only surfaced for vote type 'board-election'. On the ballot page, render a candidate card for each option with photo, name, and expandable bio.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Nomination period and self-nomination via owner portal",
          description:
            "Add a 'nominations open' phase to the election lifecycle (before 'open'). During this phase, eligible owners can submit their own nomination via the portal — providing bio, statement, and photo. Submitted nominations are held in a pending state until an administrator approves them and they appear as ballot options.",
          effort: "large",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Administrator nomination approval and rejection",
          description:
            "In the election admin panel, add a Nominations tab listing pending nominations with applicant details. Administrators can approve (converts to a ballot option) or reject (sends the applicant a notification with the reason). Approved and rejected nominations are logged in the election audit trail.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Ballot page: candidate cards with expandable bio",
          description:
            "Redesign the ballot page for board elections to display candidate cards instead of plain radio buttons. Each card shows a photo thumbnail, candidate name, and a short excerpt from their statement with an 'Read more' toggle to expand the full bio. Selection state is clearly indicated on the card (checked state, highlight border).",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 4. Meeting Integration ───────────────────────────────────────────────────
    {
      title: "Meeting Integration",
      description:
        "A meetingId field exists on elections but is unused in the UI. Elections frequently occur alongside or as an outcome of board meetings. This workstream wires elections to the meetings module so that results can be linked to minutes, and in-meeting votes can be conducted and recorded live.",
      orderIndex: 3,
      tasks: [
        {
          title: "Link election to meeting on creation and display",
          description:
            "On the election creation form, add an optional 'Associated meeting' picker that lists upcoming and recent meetings. When an election is linked to a meeting, display the meeting title and date on the election detail panel. From the meeting detail, show a linked elections section listing any elections associated with that meeting.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Include certified election results in meeting minutes",
          description:
            "When an election linked to a meeting is certified, automatically add a structured block to the meeting minutes: election title, voting rule, participation count, quorum status, vote totals by option, and winner(s). The block is editable by the board secretary before finalizing the minutes.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "In-meeting live vote recording for board resolutions",
          description:
            "For elections with voting rule 'board-only', add an in-meeting vote mode: during a meeting session, the meeting facilitator can open a resolution vote directly from the meeting detail page. Board members present are listed; the facilitator records each member's vote (Aye / Nay / Abstain) in real time. Result is automatically calculated and appended to minutes.",
          effort: "large",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 5. Reporting & PDF Export ────────────────────────────────────────────────
    {
      title: "Reporting & PDF Export",
      description:
        "The current result report is a plain-text download and the audit export is a raw CSV. Neither is suitable for inclusion in board packages, legal filings, or owner communications. This workstream adds properly formatted PDF exports and a visual results dashboard.",
      orderIndex: 4,
      tasks: [
        {
          title: "PDF result certificate export",
          description:
            "Generate a formatted PDF result certificate for certified elections. The PDF should include: association name and logo, election title and type, voting rule, eligible voter count, ballots cast, participation percentage, quorum confirmation, vote totals and percentages per option, winner(s) highlighted, certification timestamp, and certifying administrator name. Suitable for inclusion in board minutes and official records.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Visual election results panel with charts",
          description:
            "Replace the current text-only tally panel with a visual results view featuring a bar or donut chart of vote distribution per option. Show participation rate as a progress ring vs quorum threshold. For secret ballots, show aggregate percentages without individual voter details. The panel updates in real time while the election is open.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Voter eligibility audit report",
          description:
            "Generate an eligibility report for each election showing: every person or unit considered eligible, the rule that made them eligible (active ownership, board role, etc.), and whether they voted or were proxied. This answers the common post-election question 'why was this person eligible?' and supports legal challenges to results.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Cross-election participation analytics",
          description:
            "On the main elections list page, add a summary analytics row showing participation trends across elections: average turnout percentage, highest and lowest participation, quorum failure rate. Helps managers identify patterns and decide whether to invest in better voter outreach.",
          effort: "small",
          priority: "low",
          status: "todo",
        },
      ],
    },

    // ── 6. UX Polish & Ballot Clarity ───────────────────────────────────────────
    {
      title: "UX Polish & Ballot Clarity",
      description:
        "Several rough edges in the current ballot and admin UI create confusion for voters and managers. This workstream addresses the most impactful UX gaps: multi-choice ballot instructions, ballot page accessibility, election list filtering, and the lack of a progress indicator for the voting workflow.",
      orderIndex: 5,
      tasks: [
        {
          title: "Multi-choice ballot: show how many selections are allowed",
          description:
            "When a ballot allows multiple selections (e.g. elect 3 of 5 board members), display a clear instruction at the top of the ballot: 'Select up to 3 candidates'. Show a counter that updates as the voter makes selections (e.g. '2 of 3 selected'). Disable further selections once the limit is reached, with a brief tooltip explaining why.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Ballot page: step progress indicator and mobile polish",
          description:
            "Add a simple step progress header to the ballot page (Review → Select → Confirm). Improve mobile layout: larger touch targets for candidate cards, sticky 'Submit ballot' button at the bottom, and accessible contrast on selection states. Test on iOS and Android viewport sizes.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Election admin list: filter by status and date range",
          description:
            "The current elections list has no filtering. Add filter chips for status (draft, open, closed, certified, cancelled) and a date range picker for open/close dates. Add a search box that filters by election title. Persist filter state in URL params so managers can bookmark filtered views.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Extend election close date while voting is open",
          description:
            "Allow administrators to extend the close date of an open election without cycling its status. Deadline extension should be logged in the election audit trail. Voters with outstanding tokens receive an updated deadline notification email when the extension is saved.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Ballot confirmation page: link to owner portal voting history",
          description:
            "After a vote is cast, the confirmation page currently shows only the reference number. Add a link to the owner portal voting history so voters can return to review their participation record. For voters who accessed the ballot via a direct token link (not logged in), prompt them to log in to the portal to see their history.",
          effort: "small",
          priority: "low",
          status: "todo",
        },
      ],
    },
  ],
};

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
      .where(
        and(
          eq(roadmapWorkstreams.projectId, project.id),
          eq(roadmapWorkstreams.title, wsDef.title)
        )
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
        .where(
          and(
            eq(roadmapTasks.projectId, project.id),
            eq(roadmapTasks.workstreamId, workstream.id),
            eq(roadmapTasks.title, taskDef.title)
          )
        );

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
          .set({
            description: taskDef.description,
            effort: taskDef.effort,
            priority: taskDef.priority,
            updatedAt: new Date(),
          })
          .where(eq(roadmapTasks.id, existing.id));
        console.log(`    [~] Task (updated): ${taskDef.title}`);
      }
    }
  }
}

async function run() {
  console.log("Adding Elections & Voting — Phase 2 roadmap project...\n");
  await upsertProject(project);
  console.log("\nDone.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
