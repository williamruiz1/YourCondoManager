# Mobile Screenshot Capture

Use this checklist when capturing before-and-after evidence for a mobile workstream.

## Required Viewports
- `320px`
- `375px`
- `390px`
- `430px`
- `768px`

## Required Capture Types
- Before: current production or current branch state before the change
- After: changed state on the same viewport and same route
- Interaction state when relevant:
  - menu or tab expanded
  - queue item selected
  - empty state
  - success or confirmation state

## Priority Surfaces
- Owner portal: auth, overview, maintenance, financials, documents, notices
- Board workspace: roster, meetings, resolutions, packages, compliance review
- Manager/admin: dashboard, work orders, communications queues, payments, association context
- Shared shell: workspace header, tab bars, safe-area spacing

## Naming Convention
- `<surface>-<viewport>-before.png`
- `<surface>-<viewport>-after.png`

Examples:
- `owner-financials-390-before.png`
- `owner-financials-390-after.png`
- `board-meetings-375-after.png`

## Storage Rule
- Store captures with the PR or release artifact, not only in ad hoc chat history.
- If screenshots are skipped, note why in the release record.
