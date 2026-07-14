# YCM Community Page — Utilities Consolidated Vision

**Date:** 2026-06-30
**Status:** Consolidation doc — pulls every prior scoping of the YourCondoManager (YCM) public **community page** and its third-party utilities into one place, cross-referenced against what's already built.
**Why this exists:** William scoped a rich vision for the community page across many sessions and surfaces, and the scoping got scattered. This is the single doc where "everything I've scoped out for this page" lives.

> **Scope note:** this consolidates the public **community page** (`/community/<slug>`) and the third-party / closing-time utilities that hang off it (lender, insurance, resale/6(d) certificate, document repository, owner-portal entry). It does NOT re-scope the full owner portal or the financial core — those are tracked separately (Project Statecraft, the platform-overhaul project, FTPH).

---

## Plain summary (read this first)

1. **The biggest scoped utilities found** are: (a) the **CT resale / 6(d) certificate generator** (CGS §47-270 — the statutory, $185-fee, 10-business-day buyer/lender document; the single highest-value closing utility), (b) a **third-party document + payment portal** for **lenders/mortgage companies** (refinance/purchase closings) and **insurance companies** — request a document, **pay an HOA-set fee via Stripe**, receive the doc — and (c) a **governing-document repository** (bylaws/CC&Rs/budgets/minutes/insurance certs) plus the **owner-portal entry** that the public page funnels into.

2. **Built vs. scoped-only:**
   - **Built / merged:** the public community page itself (clean `/community/<slug>` URLs, branded hub), owner-portal email-code entry, document storage surface (admin side), insurance-policy tracking + expiry alerts, and the **multi-party Stripe Connect money-rails** (the fee-collection plumbing the paid-document utilities would ride on — behind a flag).
   - **In-progress (open PRs):** the **CT resale/6(d) certificate generator** (PR #294, draft, has conflicts — needs rebase + finish) and the **community-page visual redesign** (PRs #310 v1 / #317 condensed v2, awaiting William's go).
   - **Scoped-only (vision, not built):** the **lender utility** and the **insurance-company utility** as *public-facing, third-party, Stripe-paid document-request flows on the community page*. This is the part that lives mostly in William's head + scattered references — the closest written anchors are the multi-party-collection design (rails), the resale-cert work (one such document), and the CIOA compliance research (the statutory basis).

3. **What I could NOT find:** there is **no single written spec** for the third-party lender/insurance "request-a-document-and-pay-a-fee" utility as a discrete community-page feature. The *ingredients* are all documented (resale cert, Stripe Connect fee rails, document repo, insurance tracking, the §47-260 "reasonable copy fee" basis), but no doc ties them into one "third-party utilities on the community page, with a per-request HOA fee" surface. The HOA-charges-a-fee-for-document-requests piece exists statutorily for the resale cert ($185) and §47-260 copy fees, but **a configurable HOA document-request fee for arbitrary lender/insurance requests is undocumented.** This doc proposes that structure below.

---

## The consolidated utility list

Each row: plain description · STATUS · where it lives · (for paid third-party utilities) how it works.

### 1. Public community page (the container itself)

- **What:** A clean, branded public page per HOA at `yourcondomanager.org/community/<slug>` (e.g. `/community/cherryhill`). Welcoming, trustworthy, public-facing; its real job is to funnel owners into the portal and surface public community info.
- **STATUS:** **BUILT (merged)** + redesign **in-progress**.
- **Where:**
  - Live route: `client/src/pages/community-hub-public.tsx`; API `GET /api/hub/:identifier/public`.
  - Clean URLs + slug system: **PR #301 (MERGED)** — `shared/community-slug.ts` (`slugifyCommunityName`, `ensureUniqueSlug`, reserved-word safety); apex + `app.` both serve it (same Fly app).
  - Redesign previews: **PR #310 (OPEN, v1)** full redesign; **PR #317 (OPEN, v2)** condensed — portal-only, dues/admin stripped, ~1–2 screens (responds to William's "too much scroll / paying dues is an Owner Portal thing").
  - Static artifacts: `artifacts/community-page-redesign-cherryhill-v1.html` / `-v2.html` (on the PR branches).
- **Current live sections (config-driven `enabledSections`/`sectionOrder`):** notices/announcements, quick-actions, info-blocks, map, contacts, key documents, events. Owner-portal email-code sign-in CTA.

### 2. Owner-portal entry (email one-time-code)

- **What:** The public page's primary CTA — an email→one-time-code sign-in that drops the owner into `/portal` (pay dues, view ledger, documents, requests).
- **STATUS:** **BUILT.** (v2 redesign reframes it as the single prominent "Owner Portal" button.)
- **Where:** `community-hub-public.tsx` (email→code inline flow → `/portal`); owner portal at `client/src/pages/` portal surfaces; wireframe `artifacts/ycm/ycm-owner-portal-wireframe.html`.

### 3. Governing-document repository (bylaws, CC&Rs, budgets, minutes, insurance certs)

- **What:** Board uploads + versions the core governing-doc set; owners (and the public page) can view the publicly-flagged subset. Statutory basis: CT §47-260(a) record-keeping (declaration/bylaws, 3-yr financials, minutes, contracts) with §47-260(e) "reasonable copy fee" on owner inspection.
- **STATUS:** **BUILT (admin side)** + **owner/public exposure partial.**
  - Admin document management: `client/src/pages/documents.tsx` — upload/classify/version/tag/publish, `isPortalVisible`/`portalAudience` publication toggle. **BUILT.**
  - Public "Key Documents" section renders on the community page when docs are flagged public. **BUILT.**
  - Readiness/coverage of the day-one governing-doc set: **Issue #218 (OPEN)** "[readiness] P2-3 Document storage surface for HOA governing docs" — confirm owner-accessible + covers the core set.
- **Where:** `documents.tsx`; community-page "Key Documents" section; Issue #218.

### 4. Insurance records / master-policy info

- **What:** Track association insurance policies (master policy, certificates), expiry, and — in the third-party vision — let an **insurance company access relevant community/property info** (certificate of insurance, master-policy details). Statutory tie-in: §47-270(a)(8) requires owner-insurance info on the resale cert.
- **STATUS:** **BUILT (internal tracking)** + **third-party access scoped-only.**
  - Internal insurance surface + expiry alerting: `client/src/pages/insurance.tsx` (Operations zone); insurance-expiry alert source **PR #33 (MERGED, Tier-2 alerts)**.
  - **Insurance-company *external* access / certificate self-serve on the community page: SCOPED-ONLY** (no spec; see Proposed structure §B).
- **Where:** `insurance.tsx`; PR #33; resale-cert pulls insurance via the §47-270(a)(8) path.

### 5. CT resale / 6(d) / estoppel certificate generator (CGS §47-270) — the flagship closing utility

- **What:** The statutory resale certificate a CT condo MUST furnish within **10 business days** of a unit owner's request, for a **$185 statutory fee** (PA 23-18, CPI-adjusted per §47-213; +$10 expedite for ≤3-business-day turnaround). A CT unit **legally cannot close** without it; §47-270(c) caps the purchaser's liability at the certificate's stated amounts, so accuracy is financially binding. This is exactly the "buyer/lender requests a document, HOA produces it for a statutory fee" flow.
- **STATUS:** **IN-PROGRESS (PR #294, draft — has merge conflicts, needs rebase + finish).** Predecessor **PR #291 CLOSED.** Not in main working tree (lives on branch `feat/ct-resale-certificate-8013`).
- **How it works (as built on the PR):**
  - **Who requests:** admin/treasurer initiates on behalf of the unit owner/buyer/lender request (intake table `resaleCertificateRequests` with the 10-biz-day SLA clock + fee).
  - **What doc:** an immutable §47-270(a)(1)–(15) snapshot (`resaleCertificates.payload`) — periodic + unpaid assessments, other fees, capital expenditures >$1,000, reserves (board-input), operating budget, judgments/pending suits, owner insurance, 60+-day delinquencies, foreclosures in last 12 months, plus board attestation + validity period.
  - **The fee:** **$185** server-computed on the request + copy/expedite costs (§47-270(b)(1)). (Note: the *collection* of that fee via Stripe is the natural join with the multi-party rails — see §A below.)
  - **Statutory basis:** CGS §47-270 (CT); state-parameterized (DE = §81-409, downstream stub).
  - **Code (on branch):** `shared/schema.ts` (`resaleCertificateRequests`/`resaleCertificates`), `server/services/resale-certificate-service.ts` (pure generator), `server/services/resale-certificate.ts` (DB glue), `server/routes/resale-certificate.ts` (admin, tenant-fenced), `client/src/pages/resale-certificate.tsx` (route `/app/financials/resale-certificate`), `tests/resale-certificate-47-270.test.ts` (26 tests).
- **Where:** PR #294; founder-os Issue #8013 (origin); CIOA research Area 5 (statutory map); blocked-by founder-os#1035 (CT CIOA audit).

### 6. Lender / mortgage-company utility (refinance / purchase closings) — request docs + pay HOA

- **What (William's recollection):** Mortgage/lender companies (for owners refinancing or buyers purchasing into the complex) request **document information** AND can **process payments to the HOA** — likely via Stripe — with the **HOA charging a fee** for those document requests. This is the resale-cert flow generalized to a self-serve, third-party-initiated request with a configurable fee.
- **STATUS:** **SCOPED-ONLY (vision).** The *resale cert* (the most-requested closing doc) is in-progress (PR #294); the *Stripe-paid fee rails* exist (multi-party design, flagged); but the **public, third-party-initiated lender request portal with a configurable HOA document-request fee is not specced or built.**
- **How it would work (proposed — see §A):** a lender hits a request surface off the community page → picks the document(s) (resale cert / status letter / payoff / governing docs) → pays the HOA's per-request fee via **Stripe direct charge on the HOA's connected account** (YCM takes its platform application fee) → the doc is generated/fulfilled and delivered. Statutory anchor for CT: §47-270 (resale cert fee) + §47-260(e) (reasonable copy fee for records).
- **Where (ingredients):** PR #294 (resale cert), `artifacts/multi-party-collection-design.html` (Stripe fee rails), CIOA research §47-260/§47-270, `docs/projects/ftph-external-integrations.md` (Stripe/Plaid rails). **No single spec — proposed below.**

### 7. Stripe Connect multi-party money rails (the fee-collection plumbing)

- **What:** The "YCM is software, never a bank" money architecture — every charge is a Stripe **direct charge on the rightful party's connected account**; YCM only ever pulls its own platform **application fee**; principal never sits in a YCM balance (keeps YCM out of money-transmitter territory). This is the mechanism any **paid document-request fee** would ride on.
- **STATUS:** **PARTIALLY BUILT** — Flow 1 (self-managed HOA owner dues, 1% app fee) is **LIVE**; Flows 2 & 3 (PM fee, PM-collects-owner-dues) are **built behind a feature flag, OFF by default** (proposal/design).
- **How it works:** direct charge (platform secret key + `Stripe-Account: acct_…`) → `application_fee_amount` = YCM's cut → optional `Transfer` to a second party. Account id at `payment_gateway_connections.providerAccountId`; resolved by `resolveConnectChargeRouting(associationId)`.
- **Where:** `artifacts/multi-party-collection-design.html` (DESIGN/PROPOSAL, 2026-06-24); `server/services/stripe-connect-resolver.ts`; callers `payment-portal.ts`, `autopay.ts`, `retry-service.ts`.

### 8. Public notices / announcements + community info + map + contacts

- **What:** Public-facing notices/announcements (pinned-first), about/description, building/residence info, embedded map, board/management contact card.
- **STATUS:** **BUILT** (config-gated sections on the live community page); the v2 redesign (PR #317) trims these down to keep the page simple (notices ≤2, brief About, contact card) and pushes the heavier grids/quick-actions/buildings/events/map out of the public page.
- **Where:** `community-hub-public.tsx`; announcements end-to-end verification **Issue #219 (OPEN)**; PR #317 (redesign trim).

---

## How the third-party paid-document utilities would work (the part to fold into v3)

### §A. The general "third-party requests a document and pays an HOA fee" flow

This is the unifying pattern behind the lender utility, the insurance utility, and the resale cert. One surface, one fee mechanism, document-type-parameterized:

```
Third party (lender / insurer / title / buyer)
   │
   ▼ on the community page → "Request a document" utility
Pick request type:
   • Resale / 6(d) certificate (CT §47-270 — statutory $185 + expedite)   [generator: PR #294]
   • Status / demand letter (current balance, dues, assessments)           [from live ledger]
   • Payoff letter (lien/super-priority — §47-258)                          [scoped]
   • Governing docs packet (bylaws/CC&Rs/budget/minutes/insurance cert)     [from doc repo + insurance]
   │
   ▼ HOA-configurable fee per request type (statutory floor where it applies)
Pay via Stripe — DIRECT CHARGE on the HOA's connected account
   • principal → HOA's Stripe account (never a YCM balance)
   • YCM platform application_fee_amount = YCM's cut
   │
   ▼ on payment success
Generate / assemble the document (resale-cert generator, ledger snapshot, or doc-repo packet)
   │
   ▼ deliver to the requester (download link / email) + log the request + fee on the HOA ledger
```

- **Who requests:** an unauthenticated or lightly-verified third party (lender, insurer, title co., buyer's attorney) initiates from the community page — NOT an owner/admin. (Distinct from today's resale-cert flow, which is admin-initiated.)
- **What doc:** parameterized by request type (resale cert / status letter / payoff / governing-docs packet / insurance certificate).
- **The Stripe-paid fee:** rides the existing multi-party direct-charge rails (§7) — the HOA sets the fee per request type; for the resale cert the **$185 CT statutory fee** is the floor; YCM takes its platform application fee.
- **Statutory basis (CT):** §47-270 (resale cert, $185, 10 biz days, +$10 expedite); §47-260(e) (reasonable copy fee for records inspection); §47-258 (lien/super-priority — payoff context).

### §B. Insurance-company utility specifics

- **Who:** an insurance company underwriting/renewing a unit or the master policy.
- **What:** read relevant community/property info — **certificate of insurance**, **master-policy details**, and (where the HOA permits) governing-doc / loss-history context. Possibly a self-serve **certificate-of-insurance request** that the board fulfills.
- **Fee:** optional HOA-set fee per the §A flow (or free, board's choice).
- **Build state:** internal insurance tracking is BUILT (`insurance.tsx`); the **external insurer-facing access** is SCOPED-ONLY.

---

## Proposed structure — how these utilities surface ON the community page (for the v3 build)

The v2 redesign (PR #317) deliberately keeps the **public hero** simple (portal + about + notices + contact). The third-party utilities should NOT clutter that hero — they belong in a distinct, clearly-labeled **"For lenders, insurers & closings"** utility band, separate from the owner-facing flow:

```
COMMUNITY PAGE  /community/<slug>
┌──────────────────────────────────────────────────────────────┐
│  HERO (owner-facing — keep simple, per v2/PR #317)             │
│   • Community name / branding                                  │
│   • [ Owner Portal ] ← single prominent CTA (email→code→portal)│
│   • Brief About · ≤2 Notices · Board/Management contact        │
├──────────────────────────────────────────────────────────────┤
│  PUBLIC DOCUMENTS (board-flagged subset of the doc repo)       │
│   • Governing docs the HOA chooses to make public              │
├──────────────────────────────────────────────────────────────┤
│  ▸ FOR LENDERS, INSURERS & CLOSINGS  (the third-party band)    │
│   "Requesting documents for a refinance, purchase, or          │
│    insurance review? Start a request here."                    │
│   • Request a resale / 6(d) certificate (CT §47-270)  →  $fee  │
│   • Request a status / payoff letter                  →  $fee  │
│   • Request a governing-docs / insurance packet       →  $fee  │
│   → each: pick doc → pay HOA fee via Stripe → receive doc      │
│   (HOA configures which request types are enabled + the fee)   │
└──────────────────────────────────────────────────────────────┘
```

Design principles for the v3 fold-in:
- **Keep the owner hero clean** (honor the v2 "portal is the hero, dues/admin out" decision) — the third-party band is a *separate*, below-the-fold, clearly-labeled section, not mixed into the owner CTA.
- **Config-gated like every other section** (`enabledSections`) — an HOA opts into the third-party utility band and sets per-type fees in admin.
- **Reuse, don't reinvent:** the resale-cert generator (PR #294) is the first request type; the Stripe direct-charge rails (§7) are the fee mechanism; the document repo (`documents.tsx`) feeds the governing-docs packet; `insurance.tsx` feeds the insurance certificate.
- **Requester verification:** a lightweight third-party request path (email-verified, request-scoped) distinct from owner OTP and admin auth — the one genuinely new auth surface this needs.

---

## Source index (everything cross-referenced above)

| Source | What it supplies |
|---|---|
| `client/src/pages/community-hub-public.tsx` + `GET /api/hub/:id/public` | the live community page (sections, owner-portal entry) |
| PR #301 (MERGED) `shared/community-slug.ts` | clean `/community/<slug>` URLs |
| PR #310 (OPEN) / PR #317 (OPEN) | community-page redesign v1 / condensed v2 |
| PR #294 (OPEN, draft) / PR #291 (CLOSED) | CT resale/6(d) §47-270 certificate generator |
| founder-os Issue #8013 | resale-cert dispatch origin |
| `artifacts/multi-party-collection-design.html` (2026-06-24) | Stripe Connect direct-charge fee rails (Flow 1 live; 2 & 3 flagged) |
| `server/services/stripe-connect-resolver.ts` | the live Connect charge-routing resolver |
| Issue #218 (OPEN) | governing-doc storage readiness |
| `client/src/pages/documents.tsx` | admin doc repo (upload/version/publish) |
| `client/src/pages/insurance.tsx` + PR #33 (MERGED) | insurance tracking + expiry alerts |
| `wiki/research/ycm-ct-cioa-compliance-2026-05-15.md` (founder-os) | statutory map: §47-270 resale cert, §47-260 records + copy fee, §47-258 lien/super-priority, §47-261e reserves |
| `docs/strategy/pm-fees-ct-de-2026-05-10.md` | CIOA compliance as the self-managed-board wedge; resale cert named |
| `docs/projects/ftph-external-integrations.md` | external rails (Stripe/Plaid/QBO/DocuSign/SSO) |
| `artifacts/project-statecraft/project-statecraft-project.html` | 50-state vision; "insurance / structural transparency / estoppel-resale generators" as white-space; DE §81-409 |
| Issue #219 (OPEN) | all-owner announcements verified end-to-end |

---

## What's NOT here (gaps to confirm with William)

- **No written spec for the third-party lender/insurance request portal** as a discrete community-page utility — only its ingredients. §A/§B above are this doc's *proposed* structure, not a found one. Confirm before building.
- **Configurable per-request HOA document fee** (beyond the $185 statutory resale fee) is undocumented — propose adding a fee-per-request-type config to the admin community-page settings.
- **Third-party requester auth/verification** path is unspecified (the one new auth surface needed).
- If William scoped any of the lender/insurance utility in **voice** or in a **cos-store/founder-os handoff** not under `wiki/portfolio/ycm` or the YCM repo, it wasn't surfaced by this repo+wiki+GitHub sweep — flag if you remember a specific doc/session and I'll pull it.
