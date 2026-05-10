# Property Manager Outreach — 5-Touch Email Sequence

**Date:** 2026-05-10
**Author:** [019] (per Issue #392 dispatch)
**Status:** Working templates — refine based on reply patterns; A/B test subject lines after 50+ sends.
**Source spec:** `docs/strategy/sales-cycles-plan-2026-05-10.md` §"Track A: Property Managers" → §"Stage 2 — First Contact"

---

## Sequence overview

5 touches over 12 days. Drop the prospect to inactive after the final touch if no reply; re-engage in 90 days.

| Day | Action | Channel | Notes |
|-----|--------|---------|-------|
| 1 | Email #1 — intro | Email | Personalized opener referencing 1 specific firm detail |
| 3 | LinkedIn connect (if available) | LinkedIn | No pitch in note; keep it short |
| 5 | Email #2 — value-add follow-up | Email | One specific operational pain anchor + soft re-ask |
| 8 | Phone attempt | Phone | Voicemail script provided; logged to CRM regardless |
| 12 | Email #3 — final + opt-out | Email | Clear permission to ignore; leaves door open at 90d |

**Tone:** professional, peer-to-peer, no marketing fluff. The PM is busy and has heard 50 SaaS pitches this year. Lead with concrete operational language, not "transform your business."

**Sender:** William Ruiz, founder. Personal-account voice (not corporate). All emails sign with name + product + URL only — no team disclaimer footer.

**Personalization tokens:**
- `[Name]` — first name only (not "Mr./Mrs.")
- `[Firm]` — short firm name (not full LLC suffix)
- `[Specific detail]` — 1 line referencing public info (number of complexes managed, region focus, recent news, LinkedIn role change, etc.). Skip if no usable detail; do NOT fabricate.
- `[State]` — CT or DE (drives compliance hook)

---

## Email #1 — Day 1 — Intro

**Subject options (A/B test after 50 sends):**
- A: "Easier condo portfolio management — worth 15 minutes?"
- B: "[Firm] + a tool built for condo PMs"
- C: "Cutting your software stack at [Firm]"

**Body:**

> Hi [Name],
>
> I'm William, founder of YourCondoManager — a platform built specifically to help property managers run condo associations from a single dashboard without the back-and-forth between spreadsheets, email threads, and aging software.
>
> [Specific detail — e.g., "I noticed [Firm] is managing close to 30 complexes across [region]" OR "Saw you took on [recent property] last quarter."]
>
> Most PMs in [State] I've spoken with are stitching together Buildium or spreadsheets with Gmail and Excel. YCM consolidates that into one place: dues collection, maintenance dispatch, owner communications, document retention, and CIOA-compliant record keeping.
>
> Pricing is $30/complex/month for portfolios up to 30 complexes ($50/complex above that), with no per-seat licensing. Annual prepay knocks 10% off.
>
> Worth a 15-minute call to see if it fits what you're managing? Happy to show you the platform on your schedule.
>
> — William Ruiz
> YourCondoManager | yourcondomanager.org

---

## LinkedIn connect — Day 3

**Connection note (max 200 chars):**

> Hi [Name] — saw your work at [Firm] in the [State] condo space. Connecting in case useful down the road. — William @ YourCondoManager

**Do NOT pitch in the connect note.** The connect itself is the gesture; the email sequence carries the ask.

**If they accept and reply** in LinkedIn DMs, switch to that thread; pause the email sequence; let the conversation guide the next step.

---

## Email #2 — Day 5 — Value-add follow-up

**Subject:** Re: [Subject of Email #1]

(Quoting the prior thread keeps it in the same Gmail conversation.)

**Body:**

> Hi [Name],
>
> Quick follow-up to last week's note. I realized I should have led with the specific operational anchor:
>
> Most PMs in [State] running 10–30 complexes tell me their hardest workflow is **[choose one: dues reconciliation across multiple bank accounts / coordinating maintenance vendors across complexes / keeping owner communications compliant with CIOA disclosures / preparing board packets for monthly meetings]**.
>
> YCM was built around that specific friction. Happy to walk through how it works in a 15-minute screen-share — your portfolio specifics, not a canned demo.
>
> Also worth noting: we offer a 30-day free pilot on a single complex. No card, no contract. If it doesn't fit, you walk; if it does, expansion is per-complex from there.
>
> Let me know what works.
>
> — William
> YourCondoManager | yourcondomanager.org

---

## Phone attempt — Day 8

**Goal:** brief voicemail establishing voice + a clear next step. Most prospects won't pick up; the voicemail itself is the touch.

**Voicemail script (target ~25 seconds):**

> Hi [Name], this is William Ruiz from YourCondoManager. I sent over a couple of notes about a platform built for condo PMs in [State] — wanted to put a voice to the name. I'll send one more email this week with a clear opt-out, but if you'd rather skip the email and grab 15 minutes on a call, I'm at [phone number] or yourcondomanager.org. Either way, no pressure. Thanks.

**Log to CRM regardless** of whether they pick up: time of call, voicemail-left vs. no-voicemail, any callback received.

**If they pick up:** the call IS the discovery call (or a partial one). Have the discovery checklist (`sales-cycles-plan-2026-05-10.md` §"Stage 3 — Discovery Call Checklist") ready to walk through informally.

---

## Email #3 — Day 12 — Final + clear opt-out

**Subject:** Last note from me — [Firm]

**Body:**

> Hi [Name],
>
> Last note — promise.
>
> If condo platform tooling isn't on your radar right now, no problem at all. Just hit reply with "not now" or ignore this and I'll close the loop. I'd rather respect your inbox than chase.
>
> If the timing IS right and I'm just hitting you on a busy week, here are the three concrete things I can offer:
>
> 1. **15-minute discovery call** — your portfolio specifics, not a sales pitch
> 2. **30-day free pilot** on one of your complexes — no card, no contract
> 3. **Pricing snapshot** for your portfolio size with annual prepay built in
>
> Easiest reply is just a single sentence — "let's talk" or "not now."
>
> Either way, thanks for reading.
>
> — William Ruiz
> YourCondoManager | yourcondomanager.org

---

## Re-engagement (after 90 days inactive)

If the prospect didn't reply to Email #3, mark them inactive. After 90 days, send a single one-shot re-engagement:

**Subject:** Still managing condos in [State]?

> Hi [Name],
>
> Reaching back out after a few months. Two things have changed since I last wrote:
>
> 1. **[Recent product update — e.g., "Plaid bank-feed integration is live" / "CIOA-disclosure templates ship out of the box now" / "Mobile owner portal is in beta"]**
> 2. **[Recent customer outcome — e.g., "A 24-complex CT firm replaced their legacy stack last month and saved 9 hours/week on dues reconciliation"]**
>
> If either rings a bell, happy to grab 15 minutes. If not, no follow-up from me — promise.
>
> — William
> YourCondoManager | yourcondomanager.org

If still no reply: drop fully. Do not re-engage a third time without a clear new reason (e.g., a referral mentions them).

---

## A/B test ideas (after 50+ sends in baseline form)

- **Subject line variants** (A/B/C above) — track open rate
- **Email #1 length** — current is ~150 words; try a 60-word ultra-short variant
- **Pricing inclusion** — current includes the per-complex number; try omitting and seeing if reply rate improves (some prospects pre-qualify out on price; others prefer transparency)
- **CTA phrasing** — "15 minutes" vs. "a quick call" vs. "30-day free pilot" as the primary ask
- **Personalization depth** — current requires 1 specific detail; track whether emails with 2+ details outperform 1

Log each test with sample size, reply rate, demo-booked rate. Promote winners after 100-send confidence.

---

## Anti-patterns (do NOT do)

- **No "circle back," "touch base," "synergy," "leverage," "best-in-class"** — these signal sales-template fatigue
- **No bulk-personalization tokens that read robotic** — "Hi {{firstName}}, I noticed {{companyName}} has {{employeeCount}} employees..." is worse than no personalization
- **No multi-paragraph hard pitch** — every additional paragraph cuts reply rate
- **No "calendly link before the conversation has started"** — propose a window first, send the link only after they engage
- **No "I'll keep following up until you reply"** — explicit opt-out language in Email #3 wins more long-term goodwill than chasing

---

## Cross-references

- `docs/strategy/sales-cycles-plan-2026-05-10.md` §"Track A: Property Managers" — full sales cycle (Stages 1–6)
- `docs/strategy/pm-fees-ct-de-2026-05-10.md` — fee anchors for sales conversations
- `docs/strategy/email-templates/board-outreach.md` — sibling sequence for self-managed boards (community tone variant)
- `docs/specs/pricing-model-v2-2026-05-10.md` — canonical pricing tiers referenced in emails
