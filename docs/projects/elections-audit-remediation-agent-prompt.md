# Elections Module — Audit & Remediation: Full Implementation Prompt

Use this prompt verbatim with a new Claude Code agent to implement the entire project.

---

## Prompt

You are implementing the **"Elections Module — Audit & Remediation"** project for an HOA/condo management platform called Properly. This is a full-stack TypeScript application with:

- **Frontend:** React 18 + Vite + Wouter router + TanStack React Query + Tailwind CSS + shadcn/ui (Radix primitives) + Recharts
- **Backend:** Express.js + Drizzle ORM + PostgreSQL (Neon)
- **Schema:** shared/schema.ts (Drizzle table definitions + Zod insert schemas + TypeScript types)
- **Storage:** server/storage.ts (data access layer — all DB queries go here, never in routes)
- **Routes:** server/routes.ts (Express API routes — calls storage methods, never queries DB directly)
- **Email:** server/email-provider.ts exports `sendPlatformEmail({ to, subject, html, associationId?, templateKey?, enableTracking? })`
- **UI components:** client/src/components/ui/ has 47 shadcn components including chart.tsx (Recharts wrapper)

### Architecture rules

1. **All database queries go in `server/storage.ts`** as methods on the `MemStorage` class. Routes call storage methods.
2. **All API routes go in `server/routes.ts`**. Admin routes use `requireAdmin` + `requireAdminRole([...])` middleware. Portal routes use `requirePortal` middleware.
3. **Pages go in `client/src/pages/`**. Register new routes in `client/src/App.tsx` using `<Route path="..." component={...} />` with `lazy()` imports.
4. **Data fetching uses TanStack React Query** with `useQuery` / `useMutation` and the `apiRequest(method, url, body?)` helper from `@/lib/queryClient`.
5. **Schema changes in `shared/schema.ts`** — add tables, then run `npx drizzle-kit push` to sync to the database. Export insert schemas and types.
6. **Seed data goes in `server/seed.ts`** inside the existing `seedDatabase()` function.
7. **Never create documentation files** unless explicitly asked.
8. **Follow existing code patterns exactly** — match the style of adjacent code in every file you touch.

### Current elections state

**Schema** (shared/schema.ts lines 2325–2443): 6 tables fully defined:
- `elections` — id, associationId, meetingId (FK to governanceMeetings, currently unused in UI), title, description, voteType (board-election | resolution | community-referendum | amendment-ratification), votingRule (unit-weighted | person-weighted | board-only), isSecretBallot, resultVisibility (public | admin-only), status (draft | open | closed | certified | cancelled), opensAt, closesAt, quorumPercent, eligibleVoterCount, certifiedBy, certifiedAt, createdBy
- `electionOptions` — id, electionId, label, description, orderIndex
- `electionBallotTokens` — id, electionId, token, personId, unitId, status (pending | cast | consumed-by-proxy | revoked), sentAt, castAt
- `electionBallotCasts` — id, electionId, ballotTokenId, personId, unitId, choicesJson (null if secret), voteWeight, isProxy, proxyForPersonId, proxyForUnitId, confirmationRef, castAt
- `electionProxyDesignations` — id, electionId, ownerPersonId, ownerUnitId, proxyPersonId, designatedAt, revokedAt, notes
- `electionProxyDocuments` — id, electionId, ownerPersonId, ownerUnitId, fileUrl, title, uploadedBy

**Pages:**
- `client/src/pages/elections.tsx` (794 lines) — admin list page with CreateElectionDialog, ElectionOptionsPanel, ElectionTallyPanel, ProxyManagementPanel (all dialogs, no detail page)
- `client/src/pages/election-ballot.tsx` (223 lines) — public ballot page at `/vote/:token`

**Routes** (server/routes.ts lines 4830–5198): Full REST API exists — CRUD, options, tokens, tally, certify, proxies, proxy-documents, ballot GET/POST, result-report, audit-export, portal elections, portal proxy

**Storage** (server/storage.ts lines 15748–16157): All methods implemented — getElections, createElection, updateElection, generateBallotTokens, castBallot, getElectionTally, certifyElection, proxy CRUD, getOwnerElectionHistory

**App.tsx routes:**
- `/app/governance/elections` → ElectionsPage
- `/vote/:token` → ElectionBallotPage

**Sidebar:** Elections & Votes under Board menu group at `/app/governance/elections`

### What to implement

This project has **12 workstreams** and **44 tasks**. Implement them in the order listed. After each workstream, verify the app compiles (`npx tsc --noEmit` or equivalent) before moving on.

---

#### Workstream 1: Admin Election Detail & CRUD Completeness

**1.1** Create `/app/governance/elections/:id` detail page (`client/src/pages/election-detail.tsx`). Unified view with: header (title, status badge, dates), description, ballot options list, voter token summary (generated/cast/pending counts), participation metrics, proxy designations, and contextual action buttons. Register the route in App.tsx. Link to it from the elections list page (clicking a row navigates to detail).

**1.2** Add edit election form on the detail page. Editable fields when draft: title, description, opensAt, closesAt, quorumPercent, resultVisibility, isSecretBallot. When open: only closesAt and description. Use PATCH `/api/elections/:id` which already exists.

**1.3** Add "Cancel Election" action for draft/open elections. Confirmation dialog. Sets status to "cancelled". When cancelling an open election, revoke all outstanding ballot tokens (add storage method `revokeAllPendingTokens(electionId)` that updates status to "revoked" for all tokens with status "pending").

**1.4** Add "Delete Election" for draft elections with zero cast votes. New `DELETE /api/elections/:id` route and `deleteElection(id)` storage method. Deletes the election, its options, tokens, and proxy records. Guard: reject if any ballot casts exist.

**1.5** Voter token list on the detail page. Searchable table with columns: voter name (JOIN persons table on personId — resolve to `firstName + ' ' + lastName`), unit number (JOIN units on unitId), token status, castAt, confirmationRef. New storage method `getBallotTokensWithNames(electionId)` that joins persons and units. New route `GET /api/elections/:id/tokens-detail`.

---

#### Workstream 2: Data Integrity & Validation

**2.1** Server-side validation in POST/PATCH `/api/elections` routes: reject if closesAt <= opensAt. Client-side validation in election creation form and edit form.

**2.2** Guard on status transition draft→open: check `getElectionOptions(id)` returns at least 1 option. Return 400 with message if empty. Client-side: disable "Open Voting" button and show tooltip when option count is 0.

**2.3** Add `maxChoices` column to `elections` table (integer, nullable). Add to creation form for board-election type. Enforce on ballot page (disable selections past limit, show "X of Y selected" counter). Enforce server-side in `castBallot()` — reject if choices.length > maxChoices when maxChoices is set.

**2.4** In the `generateBallotTokens` route handler, check the result `created` count. If 0, return a 200 with a warning message: `{ created: 0, warning: "No eligible voters found for the selected voting rule." }`. Surface the warning in a toast on the admin UI.

**2.5** Add auto-close logic. In `server/index.ts` (or a new `server/election-scheduler.ts`), set up a `setInterval` that runs every 60 seconds. Query for elections where status='open' AND closesAt < now(). Update their status to 'closed'. Log each auto-close.

---

#### Workstream 3: Proxy Panel & Display Fixes

**3.1** Update `getProxyDesignations(electionId)` in storage to JOIN persons table and return ownerName + proxyName. Update the GET route response. Update ProxyManagementPanel to display names instead of raw IDs.

**3.2** Add a "Create Proxy" form to ProxyManagementPanel. Two searchable person pickers (owner and proxy). Use existing `POST /api/elections/:id/proxies` route. Person picker should query `/api/persons?associationId=...` filtered to the election's association.

**3.3** On the voter token list (from 1.5), add a "Proxy" badge/column. If the token status is "consumed-by-proxy", show the proxy holder's name (join through electionProxyDesignations).

---

#### Workstream 4: Seed Data & Demo Readiness

Add all seed data inside `server/seed.ts` within the existing `seedDatabase()` function, after existing association/unit/person seeds. Use the first seeded association's ID.

**4.1** Seed certified board election: "2025 Annual Board Election", voteType "board-election", votingRule "unit-weighted", status "certified", quorumPercent 50, 4 candidates as options, ballot tokens for all seeded unit owners, ~70% cast with realistic vote distribution, certifiedBy/certifiedAt set.

**4.2** Seed open community referendum: "Pool Renovation Budget Approval", voteType "community-referendum", votingRule "unit-weighted", isSecretBallot 1, status "open", opensAt in the past, closesAt 7 days from now, 3 options, tokens generated, ~40% cast.

**4.3** Seed draft amendment: "Amendment to Pet Policy — Section 4.2", voteType "amendment-ratification", votingRule "person-weighted", status "draft", 2 options, no tokens generated.

**4.4** On the board election, seed 2 proxy designations (one active where proxy voted, one revoked) and 1 proxy document record.

---

#### Workstream 5: Election List UX & Empty States

**5.1** Add status filter tabs above the election table (All, Draft, Open, Closed, Certified, Cancelled) with count badges. Use the shadcn Tabs component. Filter client-side from the already-fetched elections array. Persist active tab in URL search params.

**5.2** Add a search input (shadcn Input with search icon) that filters elections by title substring. Combine with status filter.

**5.3** Replace the empty state card with a richer onboarding card: icon, explanation of what elections do, list of supported vote types, prominent "Create your first election" CTA.

**5.4** Add a summary statistics bar above the table: total elections count, currently open count, average participation % across certified elections, elections pending certification. Use the StatCard pattern from dashboard.tsx (Card with CardHeader + CardContent + icon + value + description).

---

#### Workstream 6: Ballot Page Hardening

**6.1** Add confirmation dialog before vote submission. After clicking "Submit Vote", show a Dialog summarizing selected choice(s) with "Go Back" and "Confirm & Submit" buttons. Only call `castMutation.mutate()` on confirm.

**6.2** Display selection instructions at top of ballot options: "Select one option" or "Select up to N options" (from maxChoices). Add live counter. Disable unselected options when max reached.

**6.3** Add ARIA attributes to ballot option buttons: `role="radio"` (single) or `role="checkbox"` (multi), `aria-checked`, `aria-label`. Wrap group in `role="radiogroup"` or `role="group"`. Add keyboard arrow-key navigation.

**6.4** Add deadline countdown banner. When closesAt is within 24 hours: yellow banner with time remaining. Within 1 hour: red. Update every 60 seconds via `setInterval`. When past closesAt, replace ballot with "Voting has closed" message.

---

#### Workstream 7: Dashboard & Admin Awareness

Modify `client/src/pages/dashboard.tsx`.

**7.1** Add "Active Elections" card widget. New API: `GET /api/elections/active-summary` returns open elections with title, closesAt, participation %, quorum status. Display as a card with participation gauge (use Recharts RadialBarChart or Progress component). Link each to the detail page. When no open elections, show subtle "No active elections" state.

**7.2** Add alert row for elections closing within 48 hours. Use the existing AlertRow pattern. Show election title, time remaining, participation %. Link to detail page.

**7.3** Add alert for elections in "closed" status awaiting certification. Use AlertRow pattern. "Election awaiting certification: [title]" with link to detail page.

---

#### Workstream 8: Meetings ↔ Elections Integration

**8.1** On the meetings detail view (`client/src/pages/meetings.tsx`), add a "Linked Elections" section. Query `GET /api/elections?meetingId=<meetingId>`. Show each election's title, status, participation. Add "Associate Election" button (picker dialog of unlinked elections for the association) and "Create Election for this Meeting" button (navigates to elections page with meetingId pre-filled via URL param). New route: `GET /api/elections?meetingId=...` — update the existing GET /api/elections handler to accept an optional meetingId query param filter.

**8.2** On the election creation form, replace the raw meetingId field with a searchable meeting picker. Query `GET /api/meetings?associationId=...` to populate. Show meeting title + date. When selected, auto-suggest opensAt/closesAt aligned to meeting date. Display linked meeting on election detail page header.

**8.3** When an election is certified (in the certifyElection storage method or route handler), if the election has a meetingId, auto-generate a structured text summary of the results and store it. Add a `certificationSummary` text field to elections table, or append to the meeting's notes/minutes via the meetings storage. The summary should include: election title, voting rule, eligible voters, ballots cast, participation %, quorum status, votes per option, winner(s).

---

#### Workstream 9: Communications & Notifications ↔ Elections

**9.1** When election status transitions from draft to open (in the PATCH `/api/elections/:id` route), auto-send ballot emails. For each ballot token, call `sendPlatformEmail()` with the voter's email (join persons table), subject "[Association] — Your Vote: [Election Title]", HTML body with election title, description, dates, and a "Cast Your Vote" button linking to `/vote/:token`. Update sentAt on each token. Do this asynchronously (don't block the response). Add a storage method `getVoterEmailsForElection(electionId)` that returns `{ tokenId, email, token }[]`.

**9.2** Add a "Send Reminders" button on the election detail page (only for open elections). Sends reminder emails to voters with token status "pending". New route: `POST /api/elections/:id/send-reminders`. Reuses the email template with "Reminder: " prefix and includes participation % for social proof.

**9.3** When election opens (same status transition as 9.1), auto-create a community announcement. Insert into `communityAnnouncements` table: title "[Election Title] — Voting Now Open", body with description + close date + instruction to check email. Set channel "portal", audienceType "all-owners", associationId from election.

**9.4** When election is certified and resultVisibility is "public", send results email to all eligible voters. New route handler in the certify flow. Email includes: title, results per option with vote counts and percentages, winner(s), participation rate. For secret ballots, show only aggregate totals.

**9.5** Add election email templates to the communications template list. In the communications page seed data or template definitions, add templates: "Election Ballot Invitation", "Voting Reminder", "Election Results Announcement", "Proxy Designation Confirmation". Each with appropriate substitution variables.

---

#### Workstream 10: Owner Portal ↔ Elections Deep Integration

Modify `client/src/pages/owner-portal.tsx`.

**10.1** Add an active election banner to the portal home tab. Query a new `GET /api/portal/elections/active` route that returns open elections where the owner has a pending (uncast) ballot token. Show a prominent card: election title, close date, "Vote Now" button linking to `/vote/:token`. Persist across portal navigation.

**10.2** Add election detail view in the portal elections tab. Clicking an election shows: description, options/candidates, dates, voting rule, owner's participation status. If open + not voted, show "Cast Your Vote" button linking to ballot page. If certified + public, show results with a visual bar chart (Recharts BarChart).

**10.3** Add "Designate a Proxy" action on portal election detail for open elections. Form with person picker (other owners in the association). Uses existing `POST /api/portal/elections/:id/proxy` route. Show current proxy status if designated, with revoke option.

**10.4** For certified elections with public visibility, show a visual results card: Recharts bar or donut chart of vote distribution, participation rate vs quorum, winner highlighted. Replace the current text-only history row.

---

#### Workstream 11: Documents & Governance ↔ Elections

**11.1** When election is certified, auto-create a document record in the documents table. Generate a text-based result certificate (reuse the result-report logic) and store it with category "Governance > Elections", title "Election Results: [title] — [date]", associationId. Link the document ID back to the election record (add optional `resultDocumentId` column to elections table). This happens in the certify route handler.

**11.2** When a proxy document is uploaded via the election proxy panel, also insert a record in the documents table with category "Governance > Proxy Forms". Mirror the fileUrl, title, and associationId.

**11.3** Add an "Election Compliance" section to `client/src/pages/governance-compliance.tsx`. New API: `GET /api/elections/compliance-summary?associationId=...` returns: elections held per calendar year, quorum met/failed counts, average participation trend. Display as a card with summary stats.

**11.4** In the board packages module (if a board packages page exists), add election results as attachable content. When creating a board package for a meeting with linked elections, suggest certified election results as an attachment. If the board packages page doesn't exist or this is too complex, skip this task and note it as deferred.

---

#### Workstream 12: Board Portal ↔ Elections

Modify `client/src/pages/board-portal.tsx`.

**12.1** Add "Pending Votes" section for board-only elections. New `GET /api/portal/elections/board-pending` route returns open elections with votingRule "board-only" where the board member has a pending token. Show title, description, deadline, "Cast Vote" button.

**12.2** Add "Election Archive" section showing all certified elections for the association. Reuse `GET /api/portal/elections` filtered to certified. Show title, type, date, participation, outcome.

**12.3** When a board election is certified, show a prompt on the board portal: "Board election certified — update board roster?" Link to board role management. If the board management page doesn't have a clear role assignment interface, just show the prompt with a link to the elections detail page and note the roster update as deferred.

---

### Implementation guidelines

- **Work sequentially by workstream**. Complete all tasks in a workstream before starting the next.
- **After each workstream**, run `npx tsc --noEmit` to verify type correctness. Fix any errors before proceeding.
- **Schema changes**: When adding columns or tables, update shared/schema.ts, add insert schemas and types, then run `npx drizzle-kit push` to sync.
- **Match existing patterns exactly**: Look at adjacent code in every file you edit. Match naming conventions, error handling style, response formats, and component structure.
- **Don't over-engineer**: Use the simplest approach that works. No abstractions for one-time operations. No feature flags unless the codebase already uses them for this purpose.
- **Cross-module integrations** (workstreams 7–12) should modify existing files rather than creating new modules. Add sections to existing pages, add routes to existing route handlers, add methods to existing storage class.
- **Seed data** (workstream 4) must be idempotent — check for existence before inserting, use the same approach as existing seeds in `server/seed.ts`.
- **Email sends** should be fire-and-forget (don't await, catch and log errors). Never block an API response waiting for email delivery.
- **Keep the roadmap project updated**: After completing each workstream, run a script to mark the corresponding tasks as done. Use the pattern: `UPDATE admin_roadmap_tasks SET status = 'done', completed_date = NOW() WHERE title = '...'`.

### Files you will touch most

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Add maxChoices column, resultDocumentId column |
| `server/storage.ts` | New methods: getBallotTokensWithNames, revokeAllPendingTokens, deleteElection, getVoterEmailsForElection, etc. |
| `server/routes.ts` | New routes + validation guards + email triggers on status transitions |
| `server/seed.ts` | Election seed data (3 elections, tokens, casts, proxies) |
| `client/src/pages/election-detail.tsx` | **NEW** — full election detail page |
| `client/src/pages/elections.tsx` | List UX improvements, filters, search, summary stats, empty state |
| `client/src/pages/election-ballot.tsx` | Confirmation dialog, selection counter, ARIA, countdown |
| `client/src/pages/dashboard.tsx` | Active elections widget, closing-soon alert, certification alert |
| `client/src/pages/meetings.tsx` | Linked elections section, meeting picker |
| `client/src/pages/owner-portal.tsx` | Active election banner, detail view, proxy UI, visual results |
| `client/src/pages/board-portal.tsx` | Pending votes, election archive, roster prompt |
| `client/src/pages/governance-compliance.tsx` | Election compliance section |
| `client/src/pages/communications.tsx` | Election email templates |
| `client/src/App.tsx` | Register `/app/governance/elections/:id` route |
| `server/index.ts` or `server/election-scheduler.ts` | Auto-close interval |

Begin with Workstream 1. Read each file you plan to modify before editing it. Do not skip tasks.
