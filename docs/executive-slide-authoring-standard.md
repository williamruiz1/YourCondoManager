# Executive Slide Authoring Standard

## Purpose
Keep all executive deck slides consistent, concise, and understandable for a general audience.

## Required Slide Structure
Each slide represents one project and must be rendered as a 3-column table:

- Column 1: `Problem`
- Column 2: `Solution`
- Column 3: `Features Delivered`

Each table row should map one problem to one solution and its related features.

## Field Mapping
- `sourceKey`: must start with `slide:` for deck slides
- `headline`: short project headline
- `title`: project title
- `problemStatement`: newline-separated bullets (prefix with `- `)
- `solutionSummary`: newline-separated bullets (prefix with `- `)
- `featuresDelivered`: array of bullet strings
- `status`: `published` for presentation-ready slides

## Copy Rules
- Write for non-technical audiences.
- Keep each bullet to one sentence.
- Avoid implementation jargon.
- Prefer concrete outcomes over technical detail.
- Use straightforward language for non-technical audiences.

## Example Row
- Problem: `Operational Core Needs: Records were scattered across tools`
- Solution: `Unified Admin Hub: One place for core records`
- Features Delivered:
  - `Registry Foundation: Association profile and full unit list`
  - `People Records: Owner and occupant tracking`

## Template Workflow
- Use `Create Slide Template` in the Executive page to generate a draft `slide:*` entry with valid required fields.
- Replace placeholder problem/solution/feature text before publishing.

## Enforcement
API validation for `slide:*` updates requires:
- non-empty `problemStatement`
- non-empty `solutionSummary`
- at least one item in `featuresDelivered`
