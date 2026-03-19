# Mobile Release Gate

Use this gate whenever a change touches owner, board, manager, admin, public auth, or shared workspace mobile surfaces.

## Required Inputs
- Viewport matrix: `320px`, `375px`, `390px`, `430px`, `768px`
- Manual runner: `npm run verify:mobile`
- Detailed checklist: `docs/projects/mobile-test-checklist.md`
- Shared standards: `docs/projects/mobile-ui-rules.md`
- Board/mobile workflow boundary: `docs/projects/mobile-desktop-workflow-boundary.md`
- Screenshot checklist: `docs/projects/mobile-screenshot-capture.md`
- Regression candidates: `docs/projects/mobile-regression-candidates.md`

## Pass Criteria
- Touched role surfaces have been reviewed at the required mobile widths.
- Primary actions remain reachable without horizontal scrolling.
- Sticky headers, bottom navigation, drawers, and dialogs do not hide active content.
- Dense tables touched by the release have a narrow-screen card or list fallback.
- If a workflow is still desktop-preferred, that limitation is called out explicitly in rollout notes or roadmap follow-up.

## Minimum Release Record
- Date of verification
- Roles checked
- Viewports checked
- Touched routes/pages
- Known mobile limitations or desktop-only handoffs

## Current Desktop-Preferred Tracking Rule
- Do not mark a workflow as mobile-ready if it still depends on a desktop-only authoring surface, unreadable long-form preview, or inaccessible action cluster.
- Record the limitation as a backlog item or release note instead of burying it in implementation details.
