# YCM Pricing Model v2 — Spec
**Date:** 2026-05-10  
**Source:** Myron strategy meeting + William direction  
**Status:** Ready for implementation

---

## Overview

The pricing page splits into two distinct tracks: **Property Managers** (position 1) and **Self-Managed Boards** (position 2). Each track has its own tier logic. An annual prepay option applies across both tracks at ~10% discount.

---

## Track 1 — Property Managers

Pricing scales by number of complexes managed. Per-complex monthly fee.

| Tier | Complexes Managed | Price | Monthly Max |
|------|-------------------|-------|-------------|
| **Starter** | 1–30 complexes | $30 / complex / mo | $900/mo |
| **Growth** | 31–60 complexes | $50 / complex / mo | $3,000/mo |
| **Enterprise** | 61+ complexes | Contact sales | — |

**Annual prepay:** 10% discount (billed yearly upfront).

**Positioning copy:** "Run your entire portfolio from one command center. No per-seat licensing. Pay for what you manage."

---

## Track 2 — Self-Managed Boards

Pricing scales by unit count. The unit count determines how many **owner profiles** the association can activate. One profile per unit is the expected usage; this is the validation mechanism (not called "licenses").

| Tier | Units | Owner Profiles | Monthly | Annual (10% off) |
|------|-------|---------------|---------|-----------------|
| **Starter** | 1–30 units | Up to 30 profiles | $89/mo | $961/yr (~$80/mo) |
| **Standard** | 31–75 units | Up to 75 profiles | $149/mo | $1,608/yr (~$134/mo) |
| **Professional** | 76–150 units | Up to 150 profiles | $249/mo | $2,688/yr (~$224/mo) |
| **Enterprise** | 151–300 units | Up to 300 profiles | $399/mo | $4,308/yr (~$359/mo) |
| **Custom** | 300+ units | Unlimited | Contact sales | — |

**Positioning copy:** "Self-management made simple. Every owner gets a profile. No property manager required."

> ⚠️ **William to confirm:** Starter price ($89/mo) and tier breakpoints. Myron mentioned $89–$100; $89 used here as anchor. Adjust before launch.

---

## Owner Profile Validation Logic

- On signup, association declares unit count → determines tier
- Admin can activate owner profiles up to the tier limit
- If unit count changes (new units added), admin can upgrade tier
- Unused profiles don't roll over (not a slot system — it's a ceiling)
- Downgrade requires William review (prevent gaming)

---

## Pricing Page Layout Changes

### Current problems
- Self-managed and PM pricing mixed together
- "$30–$50" range appears under self-managed (wrong — belongs in PM tier)
- No clear differentiation between customer types

### New layout order
1. Toggle or tab: **Property Managers** | **Self-Managed Boards**
2. PM section renders first (default selected)
3. Each section shows its tier table + annual prepay CTA
4. FAQ section below addressing: "Which track am I?" and "Can I switch?"

---

## Acceptance Criteria

- [ ] Pricing page has two tracks: Property Managers (default) and Self-Managed Boards
- [ ] PM track shows 3 tiers: Starter ($30/complex), Growth ($50/complex), Enterprise (contact)
- [ ] Self-managed track shows 5 tiers: $89, $149, $249, $399, Contact
- [ ] Each tier shows unit/complex limit and owner profile limit (self-managed only)
- [ ] Annual toggle visible on both tracks — shows 10% discounted price
- [ ] Old incorrect pricing removed
- [ ] Mobile-responsive
- [ ] "Contact sales" cards link to a contact form or email (yourcondomanagement@gmail.com)
- [ ] No Stripe wiring in this PR — pricing display only (billing setup is a separate task)

---

## Out of Scope

- Stripe price ID wiring (separate task #390)
- In-app plan enforcement / upgrade flows
- Trial periods
- Coupon codes
