# Marketing Copy Standard

## Purpose
Every public marketing surface (landing, pricing, solutions) reads at a glance. Subtext under a headline, card title, or section heading is the most-skipped copy on the page — nobody reads a paragraph under a hero. This standard keeps it punchy across every current and future section.

## Trigger
William's live review of `yourcondomanager-staging.fly.dev`, 2026-07-12: *"every section that has subtext is just too much words... the MESSAGE is good — just entirely too much wording for things that are supposed to be punchy."*

## The rule
- **Subtext ≤ 12 words.** Any copy that sits under a headline, card title, or section heading (hero subhead, value-prop card body, persona subhead, etc.) is capped at 12 words. If the message needs more than that, it belongs in body copy on an interior page, not marketing subtext.
- **Fragments over full sentences.** Punchy noun/verb fragments ("Bank sync, dues tracking, reconciliation — no spreadsheets.") read faster than grammatically complete sentences. Don't force a subject + verb + object when a fragment carries the same meaning.
- **Bold the load-bearing verbs/nouns.** When a subhead lists 2-3 core capabilities (e.g. "Streamline operations. Empower boards. Engage residents."), bold each phrase and consider breaking it into its own visual line/row rather than burying it inside a paragraph — different placement makes each point scannable on its own.
- **Cut before you rewrite.** When tightening existing copy, keep the underlying message — don't change what's being promised, just remove the words that aren't earning their place.
- **Body text is never "tiny."** Card/section subtext renders at `text-base` (16px) minimum on marketing pages — `text-sm` (14px) reads as fine print and undersells the message. Titles render at `text-xl` or larger.

## Applies to
- Hero subhead / eyebrow copy
- Value-prop / feature card bodies
- Persona-toggle headline subheads (board / manager / resident)
- Any new marketing section subtext added going forward

## Example (before/after — hero subhead, 2026-07-12 pass)
- Before (23 words, one paragraph): *"The definitive platform for modern property governance. Streamline operations, empower boards, and engage residents with structural clarity."*
- After (message unchanged, cut to a lead line + 3 bolded fragments on their own row): *"The definitive platform for modern property governance."* — **Streamline operations.** · **Empower boards.** · **Engage residents.**

## Example (before/after — value-prop card body)
- Before (23 words): *"Connect your association's accounts with Plaid, track dues and reserves, and reconcile every transaction — no spreadsheets, no surprises at audit time."*
- After (9 words): *"Bank sync, dues tracking, and reconciliation — no spreadsheets, no surprises."*

## Visuals
Marketing sections that only pair an icon with text read as underbuilt. Where a section describes a concrete product capability (financials, workflow, AI assistant, etc.), pair the copy with an **illustrative mini-visual** — synthetic labels and numbers only ("Sample Association", generic dollar amounts), never real tenant/financial data. This mirrors the existing decorative-mock pattern already used in the compliance/security section of `landing.tsx`.

## Concrete nouns over abstract benefits

Added after William's second live-review pass (2026-07-12, property-manager section): *"it doesn't say enough about what it MEANS... one app for architectural requests, governance, accounting — MEAN something to them."*

- **Name the actual feature, not the benefit category.** "Run your entire portfolio from one command center" tells the reader nothing they can picture. "Architectural requests, governance, accounting, maintenance — every association, one platform" tells them exactly what they'd be doing in the app.
- **A catchy short title + a concrete-noun subhead beats a long abstract headline.** Keep the emotional hook in the headline (short, a handful of words); do the "what this actually means" work in the subhead with named capabilities.
- **Only name features that exist.** Don't invent a capability for punch — verify it's real in the product before naming it (this is also the standing completeness-honesty rule; it isn't special to marketing copy, but marketing copy is where the temptation to reach for an impressive-sounding-but-fictional feature is highest).

## Audience-aware CTAs and lead forms

Added after William's third live-review pass (2026-07-12): *"the CTA... must change with the selected audience, and speak to each audience's EMOTIONAL payoff"* and *"the lead form must adapt to the audience."*

- **Every CTA below a persona/audience toggle must vary with the selected audience** — title, body, and (where practical) button label. Reuse the persona's own button copy rather than inventing new generic button text, so the wording that follows the visitor down the page stays consistent instead of resetting to something generic at the bottom.
- **Speak to the emotional payoff of that audience**, not a generic "get started": board = governance pride ("Ready to elevate your association?"), resident = personal convenience ("Start living better"), property manager = time/leverage ("Put more time back in your hands").
- **Lead/contact forms must adapt their fields to the audience too** — a property manager runs many associations, so "association name + number of units" is the wrong shape; they need company name + portfolio size. A resident doesn't need a unit count at all. A board member benefits from an optional role field. Don't ship one generic form behind every CTA on an audience-segmented page.
- **Cohesion check:** after picking an audience, everything below that point on the page (copy, CTA, and form) should read as if it were written for that one visitor — not just the top persona-toggle section.

## Correct terminology
- Use **"association"** (or "community") for what YCM manages — never "estate" or "property" as the primary noun. "Estate" reads as UK/luxury-real-estate terminology and is not YCM's domain language.
