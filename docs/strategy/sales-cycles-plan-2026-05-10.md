# YCM Sales Cycles Plan
**Date:** 2026-05-10  
**Author:** Claude (for comparison with Myron's version — Tuesday meeting)  
**Status:** Draft for discussion

---

## Market Context

Professional condo management in CT/DE runs $10–$20/unit/month on average. A 50-unit building pays ~$900/month ($10,800/year). YCM replaces that cost at $149/month for the same building — **saving $9,000+ per year**. That's the financial anchor for every conversation.

CT also operates under the Common Interest Ownership Act (CIOA), which creates regulatory compliance overhead that frustrates self-managed boards. YCM's compliance tooling is a direct unlock.

---

## Priority Order

1. **Property Managers** — highest revenue per relationship, shorter sales cycle, tech-forward mindset
2. **Self-Managed Boards** — lower revenue per account, longer cycle, more onboarding support required
3. **Transitioning Boards** (managed but want to self-manage) — longest cycle, highest support cost, but strong referral potential

---

## Track A: Property Managers

### Why they're first

A PM managing 30 complexes is a $900/month account from one contact. They already understand the problem. They're not learning why condo management is hard — they live it. The pitch is a tool upgrade, not a mindset shift.

### Ideal profile

- CT or DE-based firm
- Managing 5–60 residential condo complexes
- Currently using spreadsheets, aging software (Buildium, AppFolio), or nothing systematic
- Principal or operations manager makes tech decisions

### Sales cycle stages

```
Stage 1: Identification (AI-assisted, 1–2 days per batch)
Stage 2: First Contact (email + call, 3–5 day cadence)
Stage 3: Discovery Call (30 min, structured checklist)
Stage 4: Platform Demo (45 min, live walkthrough)
Stage 5: Pilot Agreement (1 complex, 30 days free)
Stage 6: Expansion (full portfolio onboarding)
```

### Stage 1 — Identification

**Goal:** Build and qualify the leads list.

Signals that indicate a good target:
- CT or DE Secretary of State shows active registration as a property management company
- Website lists condo/HOA as a service area
- LinkedIn shows 5–50 employees (not a solo operator, not a corporate giant)
- Google reviews mention condo/HOA clients

**AI-executable:** Scrape SoS data + LinkedIn + Google Maps for CT/DE PM firms. Flag ones with condo references. Output: company name, primary contact name, email, phone, estimated portfolio size, website.

### Stage 2 — First Contact

**Sequence (per contact):**

| Day | Action | Channel | Notes |
|-----|--------|---------|-------|
| 1 | Email #1 — intro | Email | See template below |
| 3 | LinkedIn connection (if available) | LinkedIn | No pitch, just connect |
| 5 | Follow-up email #2 | Email | Add one specific detail about their firm |
| 8 | Phone call attempt | Phone | Leave voicemail if no answer |
| 12 | Final email | Email | Clear opt-out language |

If no response after all 5 touches → move to inactive list. Re-engage in 90 days.

**Email #1 template:**

> Subject: Easier condo portfolio management — worth 15 minutes?
>
> Hi [Name],
>
> I'm William, founder of YourCondoManager — a platform built to help property managers run condo associations from a single dashboard without the back-and-forth.
>
> Most PMs in CT I've spoken with are managing 10–30 complexes across a patchwork of spreadsheets, email threads, and aging software. YCM replaces that with one place for dues, docs, maintenance, elections, and owner communications.
>
> Worth a 15-minute call to see if it fits what you're managing? Happy to show you the platform on your schedule.
>
> — William Ruiz  
> YourCondoManager | yourcondomanager.org

### Stage 3 — Discovery Call Checklist

Goal: qualify fit, understand pain, set demo scope.

- How many complexes do you manage? (tier placement)
- What tools do you use today? (competitive landscape)
- What's your biggest operational friction? (pain anchoring)
- Do you handle dues collection? Maintenance tickets? Owner comms? (feature fit)
- Who else would be part of an evaluation? (multi-stakeholder)
- What would make switching worth it for you? (close criteria)
- Timeline: any contracts expiring with current vendors? (urgency)

### Stage 4 — Platform Demo

30-day pilot always follows a demo. Structure:

1. Show the portfolio dashboard (their multi-complex view)
2. Walk a dues cycle: invoice → owner pays → reconciliation
3. Show a maintenance ticket end-to-end
4. Show the owner-facing portal (what their residents would see)
5. Q&A on gaps

Leave 10 minutes for pricing walkthrough using their actual portfolio size.

### Stage 5 — Pilot

- 1 complex, 30 days, no cost
- Assign William as onboarding contact for questions
- Weekly check-in during pilot
- At day 21: expansion conversation

### Stage 6 — Expansion

- Remaining portfolio migrates complex by complex
- Billing activates on complex 2 onward
- Annual prepay offered with 10% discount as expansion incentive

---

## Track B: Self-Managed Boards

### Ideal profile

- Small complex, 10–75 units
- Board president or treasurer is the point of contact
- Either already self-managing (easy) or frustrated with their PM and open to change (friction)

### Sales cycle stages

```
Stage 1: Identification (SoS data + local property tax records)
Stage 2: First Contact (email, community-tone)
Stage 3: Discovery Call (needs assessment)
Stage 4: Platform Walkthrough (lighter than PM demo)
Stage 5: Onboarded + Coached
```

### Key difference from PM track

Self-managed boards are buying a skill upgrade, not a tool swap. The pitch is: "You're already running this yourselves — we make it 10x easier and protect you legally." The onboarding includes coaching sessions until they're confident operating independently.

**Email #1 template (self-managed):**

> Subject: Running your HOA without a property manager?
>
> Hi [Name],
>
> I came across [Complex Name] and noticed your association handles its own management — which takes real commitment from the board.
>
> YourCondoManager was built for exactly this: a simple platform for dues, maintenance, owner communications, elections, and documents — without needing a property manager in the middle.
>
> I'd love to show you how a few boards in Connecticut are using it. 15 minutes?
>
> — William Ruiz

### Discovery Call Checklist (Board version)

- How long have you been self-managing?
- How many units / active board members?
- How do you handle dues collection today? (Zelle, checks, Venmo?)
- What's the hardest part of running the association?
- Are you dealing with any compliance or documentation gaps?
- Do you have a reserve fund? Is it tracked somewhere?
- What would make your board's life significantly easier?

### Onboarding + Coaching

Post-signup, each self-managed board gets:
- 1 setup session (1 hour, William or trained rep)
- 3 weekly check-ins during first month
- Access to platform documentation
- "Graduation" when they can run a full meeting cycle without support

---

## Channel Priority by Track

| Channel | PM Track | Board Track |
|---------|----------|-------------|
| Email | Primary | Primary |
| Phone | Secondary | Low (board members are busy) |
| LinkedIn | Secondary (decision-makers are here) | Low |
| Community forums/NextDoor | Not applicable | Secondary |
| Referrals from existing clients | Eventually primary | Eventually primary |

---

## AI-Executable Steps

The following steps can be fully delegated to an AI agent:

1. **Lead scraping:** CT + DE SoS → PM firm names + registered agents → LinkedIn/website cross-reference → contact enrichment
2. **Email sequencing:** Personalized emails from template using firm-specific details, send via Google Workspace (williamruiz11 account)
3. **Follow-up scheduling:** Track open/reply status, queue follow-ups at correct intervals
4. **Portfolio size estimation:** Cross-reference PM websites + review sites for approximate client counts
5. **Discovery call prep:** Generate a pre-call brief for each prospect based on scraped public data
6. **CRM maintenance:** Keep the 100 (→ 500) contact list up to date with status, last touch, next action

---

## Cost Savings Anchor (for all conversations)

| Scenario | Professional PM Cost | YCM Cost | Annual Savings |
|----------|---------------------|----------|----------------|
| 30-unit self-managed | ~$450–$600/mo ($5,400–$7,200/yr) | $89/mo ($1,068/yr) | **$4,332–$6,132/yr** |
| 50-unit self-managed | ~$600–$1,000/mo ($7,200–$12,000/yr) | $149/mo ($1,788/yr) | **$5,412–$10,212/yr** |
| PM managing 10 complexes | Staff + software overhead | $300/mo ($3,600/yr) | Reframed as efficiency/scale, not savings |

---

## Metrics to Track

- Contacts in pipeline (by stage)
- Email open rate / reply rate
- Discovery calls booked per week
- Demo-to-pilot conversion
- Pilot-to-paid conversion
- Time-to-expansion (pilot → full portfolio)
