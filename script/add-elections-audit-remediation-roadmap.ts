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
  title: "Elections Module — Audit & Remediation",
  description:
    "A comprehensive audit of the Elections & Votes module found that while the backend data model and API layer are well-structured, the module operates as an isolated silo disconnected from the rest of the platform. The admin UI is utilitarian with no detail view, edit/delete capabilities, or status filtering. The proxy panel shows raw UUIDs. Validation gaps allow broken elections. Zero seed data makes the module invisible in demos. Beyond these foundational issues, the audit uncovered critical cross-module connectivity failures: the dashboard has no election awareness, meetings have a meetingId FK that is completely unwired, the owner portal shows only read-only history with no active voting CTA, the board portal has zero election visibility, communications generate zero election notifications (ballot tokens sit undelivered in the database), election artifacts are not filed in the documents module, and governance/compliance has no election tracking. This project remediates both the internal module gaps AND the cross-platform connectivity failures — making elections a holistic, first-class citizen that naturally connects with every module it touches.",
  workstreams: [
    // ── 1. Admin Election Detail & CRUD Completeness ─────────────────────────────
    {
      title: "Admin Election Detail & CRUD Completeness",
      description:
        "The elections admin page currently shows a flat list with action icon buttons that open dialogs. There is no proper detail view for an election — all context (options, tally, proxies, voter tokens) is spread across separate dialogs with no unified view. Elections cannot be edited after creation, cannot be deleted, and cannot be cancelled from the UI despite the status enum supporting 'cancelled'. This workstream adds a full detail view and completes the CRUD operations.",
      orderIndex: 0,
      tasks: [
        {
          title: "Election detail page with unified view of all election data",
          description:
            "Create a dedicated /app/governance/elections/:id detail page that displays all election information in a single view: header with title, status badge, and dates; description; ballot options list; voter token summary (generated count, cast count, pending count); participation metrics; proxy designations; and action buttons contextual to the election's status. Replace the current dialog-per-panel approach with a proper page layout using tabs or sections.",
          effort: "large",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Edit election metadata (title, description, dates, quorum, visibility)",
          description:
            "Allow administrators to edit an election's title, description, opensAt, closesAt, quorumPercent, resultVisibility, and isSecretBallot while the election is in 'draft' status. Once voting is open, only closesAt and description should be editable. Implement via PATCH /api/elections/:id which already exists but the UI provides no edit form.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Cancel election action with confirmation",
          description:
            "Add a 'Cancel Election' action available for elections in 'draft' or 'open' status. Require a confirmation dialog explaining that cancellation is permanent and that any cast votes will be discarded. Set election status to 'cancelled'. If the election was 'open', all outstanding ballot tokens should be revoked. The cancelled status already exists in the enum but is unreachable from the UI.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Delete draft election",
          description:
            "Allow deletion of elections that are still in 'draft' status and have zero cast votes. Deletion removes the election, its options, and its generated tokens. Add a DELETE /api/elections/:id endpoint with appropriate guards. This is important for cleaning up test or mistaken elections before they go live.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Voter token list panel showing names and vote status",
          description:
            "On the election detail page, show a searchable list of all generated ballot tokens with: voter name (resolved from personId, not the raw ID), unit number, token status (pending / cast / consumed-by-proxy / revoked), castAt timestamp, and confirmationRef if voted. Currently the admin has no way to see who has and hasn't voted beyond the aggregate tally numbers.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
      ],
    },

    // ── 2. Data Integrity & Validation ───────────────────────────────────────────
    {
      title: "Data Integrity & Validation",
      description:
        "Several validation gaps exist in both the frontend form and backend API: opensAt/closesAt are not validated for logical ordering, the ballot page allows unlimited multi-select with no maximum, and there is no guard against opening an election with zero ballot options. These gaps can lead to broken elections that confuse voters and managers.",
      orderIndex: 1,
      tasks: [
        {
          title: "Validate opensAt < closesAt on election creation and update",
          description:
            "Add server-side validation in the POST and PATCH /api/elections routes to reject requests where closesAt is before or equal to opensAt. Add matching client-side validation in the election creation form and the edit form. Display a clear error message: 'Close date must be after the open date.'",
          effort: "small",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Prevent opening election with zero ballot options",
          description:
            "When an admin attempts to transition an election from 'draft' to 'open', check that at least one ballot option exists. If none exist, block the transition and show an error: 'Add at least one ballot option before opening voting.' Currently nothing prevents an empty election from being opened, which would present voters with a blank ballot.",
          effort: "small",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Enforce maximum selection limit on multi-choice ballots",
          description:
            "Add a maxChoices field to the elections table (nullable integer, defaults to null meaning unlimited). For board elections, this represents the number of seats being elected (e.g. 'elect 3 of 7 candidates'). On the ballot page, enforce this limit client-side (disable further selections) and server-side (reject casts with more choices than allowed). Show a counter: '2 of 3 selected.'",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Prevent generating tokens when election has no eligible voters",
          description:
            "The generateBallotTokens storage method silently succeeds with zero tokens if no eligible voters are found (e.g. no board members for a board-only vote, no unit owners). Surface this as a warning to the admin: 'No eligible voters found for the selected voting rule. Check that units have assigned owners (or board members for board-only votes).'",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Auto-close elections when closesAt timestamp passes",
          description:
            "Add a scheduled check (cron or polling) that transitions elections from 'open' to 'closed' when the current time passes closesAt. Currently elections remain 'open' indefinitely until an admin manually closes them, even past their stated close date. This creates a confusing disconnect where an election says 'Closes March 15' but is still accepting votes on March 20.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
      ],
    },

    // ── 3. Proxy Panel & Display Fixes ───────────────────────────────────────────
    {
      title: "Proxy Panel & Display Fixes",
      description:
        "The proxy management panel currently displays raw person UUIDs in the Owner and Proxy columns instead of resolving them to human-readable names. This makes the panel unusable for administrators who need to verify proxy assignments. Additional gaps include no ability to create proxies from the admin panel and no indication of proxy status on the voter list.",
      orderIndex: 2,
      tasks: [
        {
          title: "Resolve person IDs to names in proxy designations table",
          description:
            "In the ProxyManagementPanel and the underlying GET /api/elections/:id/proxies route, join electionProxyDesignations with the persons table to return ownerName and proxyName alongside the person IDs. Display the resolved names in the Owner and Proxy columns. Fall back to showing the truncated ID if the person record is missing.",
          effort: "small",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Admin proxy creation form with person picker",
          description:
            "Add a form to the proxy management panel that allows administrators to designate a proxy on behalf of an owner. Include a person picker dropdown (searchable by name) for both the owner and the proxy. This is needed for cases where owners submit paper proxy forms and the admin must record the designation digitally.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Show proxy status indicator on voter token list",
          description:
            "In the voter token list (workstream 1), add a column or badge indicating if a voter's token has been consumed by proxy. Show the proxy holder's name. This gives administrators a single view of who is voting directly and who has designated a proxy, without switching to a separate panel.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 4. Seed Data & Demo Readiness ────────────────────────────────────────────
    {
      title: "Seed Data & Demo Readiness",
      description:
        "The Elections module has zero seed data. Every fresh load of the application shows an empty elections page with the message 'No elections yet.' This makes the module invisible during demos, makes development and QA harder, and gives the impression the feature is incomplete. Other modules (units, persons, work orders, financials) all have rich seed data.",
      orderIndex: 3,
      tasks: [
        {
          title: "Seed a certified past board election with full vote history",
          description:
            "Add a seed election for the demo association: '2025 Annual Board Election' with vote type 'board-election', voting rule 'unit-weighted', status 'certified'. Include 4 candidate options, generated ballot tokens for all unit owners, cast votes showing realistic participation (~70%), and certified results. This gives demos a complete, historically resolved election to showcase.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Seed an open community referendum with partial votes",
          description:
            "Add a currently open election: 'Pool Renovation Budget Approval' with vote type 'community-referendum', voting rule 'unit-weighted', secret ballot enabled. Include 3 options (Approve $50K, Approve $35K reduced scope, Reject). Generate tokens for all owners and cast ~40% of them to show an in-progress election with live tally data.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Seed a draft resolution with options but no tokens",
          description:
            "Add a draft election: 'Amendment to Pet Policy — Section 4.2' with vote type 'amendment-ratification', voting rule 'person-weighted'. Include 2 options (Approve Amendment, Reject Amendment). Leave status as 'draft' with no generated tokens. This demonstrates the election creation workflow and shows the pre-launch state.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Seed proxy designations and proxy documents on the board election",
          description:
            "On the certified board election seed, add 2 proxy designations: one active (proxy voted on behalf of owner) and one that was designated then revoked before voting. Add 1 proxy document record pointing to a placeholder URL. This ensures the proxy panel has visible data in demos.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 5. Election List UX & Empty States ───────────────────────────────────────
    {
      title: "Election List UX & Empty States",
      description:
        "The elections list page is a basic table with no filtering, no sorting beyond column order, and a minimal empty state. As the number of elections grows, finding a specific election becomes difficult. The page also lacks summary statistics that would help managers quickly understand their election workload.",
      orderIndex: 4,
      tasks: [
        {
          title: "Status filter tabs on election list page",
          description:
            "Add filter tabs above the election table: All, Draft, Open, Closed, Certified, Cancelled. Each tab shows a count badge. Default to 'All' but highlight 'Open' if any elections are currently open. Persist the active filter in URL query params so bookmarks and page refreshes maintain state.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Search elections by title",
          description:
            "Add a search input above the election table that filters the displayed list by title substring match (client-side for now). Clear button resets the filter. Combine with the status tabs so managers can search within a specific status.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Improved empty state with guided actions",
          description:
            "Replace the current minimal empty state ('No elections yet. Create one to get started.') with a richer onboarding card that explains what the elections module does, lists the types of votes supported (board elections, resolutions, referenda, amendments), and includes a prominent 'Create your first election' CTA button. Add a link to help documentation if available.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Election list summary statistics bar",
          description:
            "Add a summary bar above the table showing: total elections, currently open elections, average participation rate across certified elections, and number of elections pending certification. These at-a-glance metrics help managers understand the current state without drilling into individual elections.",
          effort: "small",
          priority: "low",
          status: "todo",
        },
      ],
    },

    // ── 6. Ballot Page Hardening ─────────────────────────────────────────────────
    {
      title: "Ballot Page Hardening",
      description:
        "The public-facing ballot page (election-ballot.tsx) is functional but has several gaps: no confirmation step before final submission (a single click submits irrevocably), no indication of how many choices the voter should make, no countdown or deadline urgency when the election is about to close, and the selection UI uses custom-styled buttons that lack standard form accessibility attributes (aria-checked, role). This workstream hardens the ballot for real-world use.",
      orderIndex: 5,
      tasks: [
        {
          title: "Add confirmation step before final vote submission",
          description:
            "After clicking 'Submit Vote', show a confirmation dialog summarizing the voter's selected choice(s) and a warning that the vote is final. The dialog should have 'Go Back' and 'Confirm & Submit' buttons. Currently a single click on 'Submit Vote' immediately casts the ballot with no chance to review. This is especially important for secret ballots where there is no post-submission receipt of the choice.",
          effort: "small",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Display selection instructions and counter on ballot",
          description:
            "At the top of the ballot options section, display clear instructions: 'Select one option' for single-choice elections or 'Select up to N options' for multi-choice. Show a live counter as selections are made. When the maximum is reached, visually disable remaining unselected options and show a tooltip explaining the limit.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Add ARIA roles and keyboard navigation to ballot options",
          description:
            "The ballot option buttons are styled <button> elements but lack radio/checkbox ARIA semantics. Add role='radio' (single-choice) or role='checkbox' (multi-choice), aria-checked, and proper keyboard navigation (arrow keys to move, space to select). Wrap the group in a role='radiogroup' or role='group'. Ensures the ballot is accessible to screen reader users and meets WCAG 2.1 AA.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Deadline countdown and urgency banner when election closes soon",
          description:
            "When the election closesAt is within 24 hours, show a yellow banner at the top of the ballot: 'Voting closes in X hours and Y minutes.' When within 1 hour, make it red with more urgent language. Update the countdown every minute. After the close time passes, replace the ballot with a 'Voting has closed' message without requiring a page refresh.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 7. Dashboard & Admin Awareness ───────────────────────────────────────────
    {
      title: "Dashboard & Admin Awareness",
      description:
        "The main admin dashboard has zero election visibility. Managers must navigate to the elections page to know whether any election is active, closing soon, or awaiting certification. Elections should surface naturally on the dashboard alongside work orders, financials, and occupancy — not hide behind a sidebar link.",
      orderIndex: 6,
      tasks: [
        {
          title: "Dashboard: active elections widget with participation gauge",
          description:
            "Add an 'Active Elections' card to the admin dashboard showing each open election: title, close date, participation percentage as a progress ring vs quorum threshold, and a direct link to the election detail page. When no elections are open, show a subtle 'No active elections' state rather than hiding the widget entirely — managers should always know the module exists.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Dashboard: alert for elections closing within 48 hours",
          description:
            "Add a time-sensitive alert banner or notification dot when an open election's closesAt is within 48 hours. The alert should show the election title, time remaining, and current participation %. Link to the election so the manager can decide whether to send reminders, extend the deadline, or close early. Disappears once the election closes or is certified.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Dashboard: elections awaiting certification callout",
          description:
            "When an election is in 'closed' status but not yet certified, show a pending action item on the dashboard: 'Election awaiting certification: [title]'. Include a one-click link to open the tally panel. Board admins should never forget to certify — the dashboard should remind them until it's done.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
      ],
    },

    // ── 8. Meetings ↔ Elections Integration ──────────────────────────────────────
    {
      title: "Meetings ↔ Elections Integration",
      description:
        "The elections schema has a meetingId foreign key that is completely unused in the UI. Elections frequently accompany board meetings — annual elections happen at annual meetings, resolution votes happen during special meetings. The two modules should be visibly linked so that meeting minutes naturally reference election outcomes and elections can be launched from meeting context.",
      orderIndex: 7,
      tasks: [
        {
          title: "Meeting detail: linked elections section",
          description:
            "On the meeting detail page, add a 'Linked Elections' section that lists any elections where meetingId matches the current meeting. For each election, show title, status, participation %, and outcome (if certified). Include an 'Associate Election' button that opens a picker of unlinked elections for the same association, and a 'Create Election for this Meeting' shortcut that pre-fills the meetingId.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Election creation: meeting picker with upcoming meetings",
          description:
            "On the election creation form, replace the bare meetingId field with a searchable meeting picker dropdown that shows upcoming and recent meetings for the association. Display meeting title, date, and type. When a meeting is selected, auto-populate the election opensAt/closesAt to align with the meeting date. The meeting link should also be visible on the election detail page header.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Auto-append certified election results to meeting minutes",
          description:
            "When an election linked to a meeting is certified, automatically generate a structured summary block and append it to the meeting record: election title, voting rule, eligible voter count, ballots cast, participation %, quorum status, vote totals per option, and winner(s). The block should be editable by the secretary before the minutes are finalized. This eliminates the manual step of transcribing election results into minutes.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
      ],
    },

    // ── 9. Communications & Notifications ↔ Elections ────────────────────────────
    {
      title: "Communications & Notifications ↔ Elections",
      description:
        "Elections currently generate zero notifications. Ballot tokens sit in the database with no delivery mechanism. Election status changes (opened, closing soon, closed, certified) produce no emails, SMS, or announcements. The communications module has template infrastructure but no election templates. Every other lifecycle event in HOA management — late fees, work orders, meeting notices — triggers notifications. Elections should too.",
      orderIndex: 8,
      tasks: [
        {
          title: "Auto-email ballot links when election opens",
          description:
            "When an election transitions from 'draft' to 'open', automatically send each voter an email containing their unique ballot link. Use the association's configured email sender and a new 'election-ballot-invite' template. Include election title, description, open/close dates, voting instructions, and a prominent 'Cast Your Vote' CTA button. Log sentAt on each ballot token record. This is the single most critical integration gap — without it, ballot tokens are useless.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Voting reminder email for non-voters approaching deadline",
          description:
            "Send an automated reminder email 48 hours before closesAt to all voters whose token status is still 'pending'. Include time remaining, re-state the ballot link, and show current participation % to create social proof urgency ('72% of your neighbors have already voted'). Allow managers to trigger manual reminders at any time from the election detail page.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Auto-create announcement when election opens",
          description:
            "When an election opens, automatically create a community announcement visible on the owner portal and announcements page: '[Association] has opened voting for [Election Title]. Voting closes [date]. Check your email for your ballot link.' This ensures owners who check the portal see the election even if they missed the email.",
          effort: "small",
          priority: "high",
          status: "todo",
        },
        {
          title: "Election results notification to all voters after certification",
          description:
            "When an election is certified and resultVisibility is 'public', send a results notification email to all eligible voters. Include the election title, final vote tallies per option, winner(s), participation rate, and quorum confirmation. For secret ballots, show aggregate results only. This closes the loop — voters should know the outcome without having to check the portal.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Election communication templates in communications module",
          description:
            "Add pre-built election email templates to the communications template library: ballot invitation, voting reminder, results announcement, and proxy designation confirmation. Templates should use substitution variables ({{electionTitle}}, {{closesAt}}, {{ballotLink}}, etc.) and be customizable by the manager before sending. This lets the communications module serve as the single source of truth for all outbound messaging.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 10. Owner Portal ↔ Elections Deep Integration ────────────────────────────
    {
      title: "Owner Portal ↔ Elections Deep Integration",
      description:
        "The owner portal has a basic elections tab showing read-only history, but no active voting awareness. An owner logging into the portal during an active election sees no alert, no CTA, and no way to access their ballot. The portal should be the primary surface for election participation — not just a historical record. Owners should feel the urgency of an open vote the moment they log in.",
      orderIndex: 9,
      tasks: [
        {
          title: "Owner portal: active election banner on home tab",
          description:
            "When one or more elections are open and the logged-in owner has a pending (uncast) ballot token, show a prominent banner at the top of the owner portal home tab: 'You have an open vote: [Election Title]. Voting closes [date].' Include a 'Vote Now' button that navigates to the ballot page with the owner's token. The banner should persist across portal navigation until the owner votes or the election closes.",
          effort: "medium",
          priority: "critical",
          status: "todo",
        },
        {
          title: "Owner portal: election detail with inline voting",
          description:
            "When an owner clicks into an election from the portal elections tab, show the full election detail: description, options/candidates, voting rule, dates, and the owner's participation status. If the election is open and the owner hasn't voted, embed the ballot directly on this page (or link to it) so the owner can vote without leaving the portal. If the election is certified and public, show the results with visual charts.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Owner portal: proxy designation from election detail",
          description:
            "On the owner portal election detail page, add a 'Designate a Proxy' action for open elections. The owner selects another person from their association to vote on their behalf. The API endpoint POST /api/portal/elections/:id/proxy already exists but has no UI. Show the current proxy status if one is already designated, with an option to revoke before voting closes.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Owner portal: certified election results with visual breakdown",
          description:
            "For certified elections with public result visibility, show a visual results card on the elections tab: donut or bar chart of vote distribution, participation rate vs quorum, winner highlighted, and certification date. Replace the current text-only row with a proper results display. Owners should be able to see election outcomes at a glance.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 11. Documents & Governance ↔ Elections ───────────────────────────────────
    {
      title: "Documents & Governance ↔ Elections",
      description:
        "Election artifacts (result certificates, audit exports, proxy documents) exist as isolated endpoint downloads or separate table records. They are not filed in the platform's documents module and do not appear in governance/compliance tracking. For a holistic platform, election outcomes should automatically become part of the association's permanent record — searchable in documents, trackable in governance, and includable in board packages.",
      orderIndex: 10,
      tasks: [
        {
          title: "Auto-file election result certificate in documents module",
          description:
            "When an election is certified, automatically generate and store the result certificate as a document in the documents module. File it under a 'Governance > Elections' category with metadata: election title, certification date, certifying admin. The document should be searchable and appear alongside other association records. Managers should never have to manually download and re-upload election results.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "File proxy documents in the documents module",
          description:
            "When a proxy document is uploaded via the election proxy panel, also create a corresponding record in the documents module with appropriate categorization. This ensures proxy forms are discoverable alongside other association documents and are included in document searches and board package assembly.",
          effort: "small",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Governance compliance: election quorum and participation tracking",
          description:
            "Add an 'Election Compliance' section to the governance/compliance page that tracks: elections held per year vs governing document requirements, quorum met/failed history, average participation trends, and upcoming election obligations. Many HOA governing documents require annual elections — the platform should track whether the association is meeting this obligation.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Board packages: include election results as attachable content",
          description:
            "In the board packages module, allow election result certificates to be attached as agenda items or supporting documents. When assembling a board package for a meeting that had a linked election, suggest including the certified results automatically. This closes the loop between elections, meetings, and board governance documentation.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
      ],
    },

    // ── 12. Board Portal ↔ Elections ─────────────────────────────────────────────
    {
      title: "Board Portal ↔ Elections",
      description:
        "The board portal has no election visibility. Board members who are also voters have no awareness of pending board elections or resolution votes from their board-specific interface. For board-only votes (resolutions, officer elections), the board portal should be the primary interface — not a generic ballot link sent via email.",
      orderIndex: 11,
      tasks: [
        {
          title: "Board portal: pending votes section for board-only elections",
          description:
            "On the board portal, add a 'Pending Votes' section that shows any open elections with voting rule 'board-only'. Display the election title, description, deadline, and a 'Cast Vote' button. Board-only votes are internal governance actions — board members should handle them from their governance interface, not from an anonymous token link in their email.",
          effort: "medium",
          priority: "high",
          status: "todo",
        },
        {
          title: "Board portal: election history and outcome archive",
          description:
            "Add an 'Election Archive' section to the board portal showing all certified elections for the association: title, type, date, participation, and outcome. Board members frequently need to reference past votes during meetings ('When did we vote on the pool renovation?'). This archive serves as institutional memory accessible from the board's workspace.",
          effort: "medium",
          priority: "medium",
          status: "todo",
        },
        {
          title: "Board portal: link certified election to board role assignments",
          description:
            "When a board election is certified, prompt the admin to update board role assignments based on the results. If candidates map to persons in the system, pre-fill the role update: 'Jane Smith elected as President — update board roster?' This connects the election outcome to the actual governance state of the association, closing the loop between voting and board composition.",
          effort: "large",
          priority: "medium",
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
  console.log("Adding Elections Module — Audit & Remediation roadmap project...\n");
  await upsertProject(project);
  console.log("\nDone.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
