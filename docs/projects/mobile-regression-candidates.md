# Mobile Regression Candidates

This document lists candidate automated coverage if UI regression checks are added later.

## Highest-Value Flows
- Owner auth flow:
  - email entry
  - OTP entry
  - association selection
- Owner portal:
  - overview tab switching
  - maintenance submit
  - financial transaction card rendering
  - documents open/download actions
  - notices expand/collapse
- Workspace shell:
  - in-page tab bar rendering on narrow widths
  - header and safe-area spacing on long scroll
- Work orders:
  - queue cards render visible status and next actions
  - filter drawer/collapsible behavior on mobile
- Communications:
  - invite queue, submission queue, dispatch approval cards
- Payments:
  - mobile tab bar navigation
  - event review card selection
  - exception card readability
- Board:
  - meeting register cards
  - resolution selection state
  - compliance task due-state cards

## Candidate Assertions
- No horizontal page overflow at the required mobile widths
- Primary actions remain visible in the initial viewport or reachable without hidden nested scroll
- Dense tables touched by mobile work switch to card/list layouts below desktop breakpoints
- Sticky headers and bottom navigation do not cover active controls
- Long titles, statuses, timestamps, and badges wrap without clipping primary meaning

## Suggested First Automation Scope
- Snapshot-style route rendering at `320px`, `390px`, and `768px`
- Targeted interaction checks for:
  - tab switching
  - accordion/notice expansion
  - queue-card action visibility
  - dialog open behavior on mobile

## Explicit Non-Goal For First Pass
- Full end-to-end authoring coverage for desktop-preferred board workflows
