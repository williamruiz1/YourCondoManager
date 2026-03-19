# Mobile UI Rules

This document captures the first shared rules executed under the Mobile Optimization roadmap project.

## Layout
- Default to `px-4` mobile gutters and scale to `sm:px-6` or `md:px-8` rather than starting from desktop spacing.
- Prefer stacked section shells with rounded borders and concise summaries over dense page-long white canvases.
- Keep sticky headers lightweight on mobile and avoid placing more than one dense action row above content.
- Multi-panel dashboards should collapse into urgency-first stacks on mobile rather than preserving desktop side-by-side ordering.
- Empty states and success states should stay short enough that the first recovery action remains visible within the initial viewport.

## Tabs And Navigation
- Use horizontally scrollable pill tabs for primary or secondary mobile navigation.
- Keep mobile tab buttons at least `44px` tall.
- Avoid left-rail subnavigation on phone widths; convert it to horizontal tabs or stacked segmented controls.
- Shared workspace in-page tabs should use the same mobile tab primitive so admin, board, manager, and association pages behave consistently.
- Sticky headers should keep controls reachable without consuming multiple stacked rows of dense actions on phone widths.
- When a workflow is truly desktop-preferred, show explicit handoff messaging instead of pretending a cramped fallback is mobile-ready.

## Tables
- Dense tables must provide a mobile card/list treatment for narrow screens.
- Preserve the desktop table on `md+` when it remains the fastest scan pattern there.
- Promote the most important values to the first row of the mobile card: status, title, amount, and timestamp.
- Operational queues should expose status, scope, SLA/urgency, and the next action directly on the mobile card without requiring horizontal scrolling.
- Approval, review, and file-upload actions must remain reachable directly from the mobile card when the task is expected to be mobile-safe.

## Forms
- Forms should default to single-column stacks on mobile.
- Labels should remain visible above inputs; do not rely on placeholders as the only field context.
- Keep submit actions visible near the form body and use full-width or high-contrast buttons when the task is primary.
- Selects, dialogs, and date inputs should avoid narrow multi-column clusters that become fragile under the mobile keyboard.

## Viewport Matrix
- Validate phone layouts at `320px`, `375px`, `390px`, and `430px`.
- Validate tablet/narrow desktop crossover layouts at `768px`.
- Treat `320px` as the compression floor for auth, navigation, alerts, and queue actions.
- Treat `768px` as the breakpoint where desktop tables may remain acceptable if the mobile fallback is still present below it.

## Release Discipline
- Every touched role surface should be checked against the mobile viewport matrix before release.
- Use `npm run verify:mobile` to print the manual journeys that must be reviewed for each role.
- If a touched workflow is intentionally desktop-first, record that explicitly in release notes or roadmap follow-up rather than silently shipping a degraded mobile path.

## Owner Portal P0 Application
- Owner portal auth, overview subtabs, maintenance history, and transaction history now follow the shared mobile shell and mobile tab rules.
- Future workstreams should reuse the shared primitives in `client/src/components/mobile-section-shell.tsx` and `client/src/components/mobile-tab-bar.tsx`.

## Workspace Shell Application
- The authenticated workspace shell now uses the shared mobile tab bar for in-page section navigation.
- Workspace subpage changes intentionally reset the main content scroll position.
- Mobile headers and bottom navigation should reserve safe-area space rather than letting controls overlap content.
