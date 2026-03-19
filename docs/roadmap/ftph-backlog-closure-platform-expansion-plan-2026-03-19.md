# FTPH Backlog Closure Platform Expansion Plan

Date: 2026-03-19

## Purpose
Close the remaining FTPH backlog items that were still phrased as future planning work rather than implementation tasks. This document resolves four open roadmap items:

- prioritize external integrations across banking, accounting, and identity
- define the public API and webhook delivery plan
- plan reseller architecture and subscription billing closure
- stage amenity booking, digital signature, and voting backlog for portal expansion

It converts those branches into explicit sequence, boundaries, and readiness gates so they no longer sit as undefined backlog placeholders.

## Planning Decisions

### 1. Integration Priority Order

Priority order:

1. Banking
2. Accounting
3. Identity

Why this order:

- Banking directly strengthens the existing financial roadmap by replacing manual reconciliation imports with bank-feed ingestion.
- Accounting only becomes durable after bank reconciliation and internal finance workflows are trusted enough to sync outward.
- Enterprise identity is important for market expansion, but it does not unblock current association operations as directly as banking and accounting do.

Recommended wave breakdown:

- Wave 1: Plaid-style banking feed and credential vault
- Wave 2: QuickBooks Online sync for chart of accounts, expenses, vendor invoices, and reconciliation references
- Wave 3: Microsoft Entra ID, Okta, and generic SAML/OIDC admin identity integrations

Readiness gate before each wave:

- stable internal ownership of the source-of-truth record
- explicit conflict-resolution policy
- operator-visible health and retry surface
- audit coverage for credential changes and sync actions

### 2. Public API and Webhook Delivery Plan

Public API v1 boundary:

- association-scoped, versioned REST API
- no public write access to governance workflows in v1
- read/write coverage for associations, units, persons, owners, ledger references, work orders, and documents where internal lifecycle rules are already explicit

Authentication model:

- per-association API keys
- explicit scopes by resource family and read/write authority
- key rotation, revocation, last-used timestamp, and usage metering

Webhook model:

- HTTPS delivery only
- per-endpoint signing secret
- at-least-once delivery with idempotent event ids
- retry schedule with dead-letter state and operator replay controls

Initial webhook events:

- `payment.received`
- `payment.failed`
- `work_order.created`
- `work_order.closed`
- `document.uploaded`
- `notice.sent`

Delivery and versioning rules:

- event envelopes must include `id`, `type`, `occurredAt`, `associationId`, `resourceId`, and `apiVersion`
- breaking changes require a new API version
- webhook payload shape tracks the public API resource model, not internal table shape

Rollout sequence:

1. internal event catalog and payload contracts
2. API key lifecycle and scoped auth
3. read-only resource endpoints
4. webhook subscriptions and signed delivery
5. selected write endpoints after lifecycle guardrails are proven
6. public docs and sample apps

### 3. Reseller Architecture and Subscription Billing Closure

Tenancy model:

- platform
- reseller
- association
- user

Authority model:

- platform admins can see all resellers and all associations
- reseller admins can provision and manage only their reseller-owned associations
- associations never cross reseller boundaries
- reseller branding and outbound-email identity are inherited by child associations unless explicitly overridden by platform policy

Billing owner decision:

- direct customers are billed by the platform
- reseller customers are billed at the reseller account level
- reseller pass-through or markup is handled above the association, not association-by-association

Subscription closure sequence:

1. finalize plan catalog and feature-entitlement model
2. add reseller entity and association ownership mapping
3. enforce plan entitlements through feature flags and server-side checks
4. attach billing account and invoice lifecycle to reseller or direct customer
5. add reseller admin billing views, usage summaries, and dunning states

Critical boundaries:

- no shared users across resellers without explicit platform-level identity linking
- no platform branding leakage into reseller-branded portal/email surfaces
- no subscription entitlement logic living only in UI checks

### 4. Portal Expansion Staging

Portal expansion order:

1. Voting
2. Amenity booking
3. Digital signature

Why this order:

- Voting extends existing governance and portal identity patterns with the least new external dependency surface.
- Amenity booking is a self-contained operational loop that depends mostly on scheduling and conflict control.
- Digital signature has the highest legal and vendor-dependency ambiguity, so it should follow only after the portal’s identity-confirmation and audit patterns are proven.

Recommended rollout slices:

#### Voting

- admin ballot creation and owner eligibility resolution
- owner ballot access and one-vote enforcement
- result tabulation and audit trail

Open boundary:

- no proxy voting in the first release

#### Amenity Booking

- amenity configuration
- availability calendar
- reservation request and conflict prevention
- cancellation and waitlist

Open boundary:

- no deposit collection in the first release

#### Digital Signature

- signature request creation
- owner signature review flow
- executed-document storage
- signature audit trail

Open boundary:

- use vendor integration if jurisdiction-specific legal validity becomes a launch requirement

## Resulting Execution Order

Recommended order across the four backlog branches:

1. banking integration foundation
2. accounting integration
3. public API keying and webhook framework
4. reseller tenancy and subscription entitlement closure
5. identity-provider integrations for enterprise/admin customers
6. portal voting
7. portal amenity booking
8. portal digital signature

## Definition of Done For These Backlog Tasks

These roadmap tasks should be considered complete once:

- a single source-of-truth document defines sequence and boundaries
- dependency order is explicit
- rollout gates are explicit
- unresolved product questions are narrowed to real launch choices instead of vague backlog placeholders

This document satisfies that requirement for the remaining planning-only FTPH backlog items.
