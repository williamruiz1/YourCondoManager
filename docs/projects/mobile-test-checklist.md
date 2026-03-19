# Mobile Test Checklist

## Viewports
- 320px
- 375px
- 390px
- 430px
- 768px

## Owner Portal
- Login email step fits within the viewport without hidden primary actions.
- OTP entry keeps the code field, verify action, and resend path visible without keyboard overlap.
- Association selection cards remain readable and tappable on narrow widths.
- Header controls wrap cleanly when board toggle, association switcher, and sign out appear together.
- Primary owner tabs remain reachable through horizontal scrolling and do not overlap the bottom tab bar.
- Overview subtabs switch cleanly and reset the overview content position intentionally.
- Maintenance request form stays single-column and keeps labels visible.
- Maintenance history cards show title, status, priority, and timestamps without truncating the primary meaning.
- Financial statement summary shows current amount due before payment setup controls.
- Transaction history uses card rows on mobile and preserves date, type, and amount clarity.
- Documents cards keep long titles readable and expose both open and download actions.
- Notices cards keep unread state, urgency, scope, and date visible before expansion.

## Workspace Shell
- Workspace header keeps sidebar toggle, command/search, association switcher, and account menu usable on 320px and 375px widths.
- In-page workspace tabs render as horizontally scrollable pill tabs rather than compressed button rows.
- Subpage and section-tab changes reset main content scroll to the top intentionally.
- Sticky workspace header does not cover first content rows during normal scroll.

## Public Intake
- Onboarding invite forms keep submit actions visible and full-width on small screens.
- Tenant and co-owner add/remove actions remain tappable without forcing horizontal overflow.

## Board
- Board roster cards keep member, association, role, and term state readable at 320px.
- Board package templates and distribution history remain reviewable without horizontal scrolling.
- Meeting register actions for notice send, quorum review, notes, and summary publish remain reachable on phone widths.
- Resolution selection keeps the active item visually obvious and vote controls usable below it.
- Governance compliance task cards preserve due-state urgency, status updates, and evidence upload actions.

## Manager And Admin
- Dashboard alert cards keep review actions visible without compressing alert copy into unreadable rows.
- Association context switch cards keep the active context action obvious on small screens.
- Work-order queues and communications queues expose next actions directly from mobile cards.
- Payments tab navigation stays usable on phones and does not collapse into unreadable icon-only tabs.
- Admin user role changes and board role review can be completed from stacked mobile cards.

## Shared Rules
- Touch targets are at least 44px high for primary tabs and main action buttons.
- Sticky headers and bottom navigation do not obscure active content.
- Dense tables touched by mobile work have a narrow-screen card or list presentation.
