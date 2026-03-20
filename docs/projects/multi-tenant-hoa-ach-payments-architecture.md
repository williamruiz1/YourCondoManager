# Multi-Tenant HOA ACH Payments Architecture

## Purpose
Define the target payment architecture for CondoManager as a platform-orchestrated ACH system built around Dwolla and Plaid, with strict association isolation, direct owner-to-HOA money movement, reusable owner payer identity, per-HOA authorization, and finance-grade auditability.

This note turns the earlier payments PRD direction into implementation-grade product guidance that matches the current codebase and the new Admin roadmap project:
- `Active Project - Multi-Tenant HOA ACH Payments Architecture`

## Service Intent
- Target users:
  property managers, self-managed HOA operators, owners, and board members with read/review access
- Operating model:
  the platform orchestrates provider setup, token exchange, transfer initiation, and transfer state tracking
- Money-movement model:
  funds move directly from owner funding source to HOA funding source
- Platform role:
  orchestration, compliance workflow support, provider integration, audit, and operator tooling
- HOA role:
  receiving entity with isolated provider identity and isolated ledger context
- Owner role:
  payer with one reusable payer profile in the owner portal and per-HOA payment authorizations
- Authority model:
  HOA payment setup may be completed only by authorized operator paths, not general residents
- Success definition:
  an owner can link a bank account once, authorize one or more HOAs separately, pay or enroll in autopay for each HOA, and have settled transfers update the correct HOA ledger with an auditable state trail

## Current Implementation Review

### What Exists Today
- Association-scoped payment instructions:
  `payment_method_configs` stores bank transfer, bill-pay, check, Zelle, and other payment guidance
- Generic gateway abstraction:
  `payment_gateway_connections` supports `stripe` and `other`
- Payment-entry shell:
  the payments page already supports methods, gateway configuration, payment links, partial-payment rules, and autopay-related UI
- Portal payment primitives:
  saved payment methods and autopay enrollment routes exist for owners
- Payment activity primitives:
  webhook event ingestion, event state transitions, and operator review routes exist
- Ledger hook:
  owner ledger payment entries can already be written from payment-related flows
- Association isolation:
  current finance routes are generally scoped by `associationId`

### What The Current Implementation Actually Means
- The current product is a payment foundation, not a Dwolla/Plaid ACH architecture
- “Gateway” is treated as an association-level configuration rather than a platform-owned orchestration layer
- Saved payment methods are stored per association rather than as a reusable payer identity across associations
- Autopay is currently an internal scheduling mechanism that can write ledger payments directly
- Payment links and payment events assume generic gateway semantics, not provider transfer lifecycle semantics
- Ledger application is too close to payment initiation/execution assumptions and not clearly tied to settled ACH outcomes

## Findings

### Finding 1: The current provider model is generic, not ACH-orchestrated
- Current behavior:
  the system stores per-association gateway credentials and labels them as live connections
- Gap:
  the target architecture requires platform-owned Dwolla and Plaid orchestration, HOA receiving customers, owner payer identity, and provider-managed funding sources
- User consequence:
  the existing model cannot express the real business entities needed for multi-HOA ACH routing

### Finding 2: Owner payment identity is modeled too narrowly
- Current behavior:
  saved payment methods are tied to `associationId` and `personId`
- Gap:
  the target architecture requires one owner payer profile with reusable funding sources and separate HOA authorizations
- User consequence:
  a multi-HOA owner would face redundant setup and weak cross-association continuity

### Finding 3: Autopay is not provider-backed
- Current behavior:
  the autopay run route inserts owner-ledger payment entries directly when an enrollment is due
- Gap:
  ACH autopay must create provider-backed transfer attempts and wait for transfer lifecycle outcomes
- User consequence:
  the system can imply money has moved when it has not actually settled

### Finding 4: Webhook/payment event modeling is useful but too generic
- Current behavior:
  payment webhook events track provider event ids, status, references, and transitions
- Gap:
  the model does not yet represent Dwolla transfer lifecycle, pending visibility, returns, reversals, or association-specific authorization state
- User consequence:
  operators cannot reliably trace ACH state from authorization through settlement and ledger impact

### Finding 5: The product lacks a structured operator onboarding authority model
- Current behavior:
  admin and board access exist, but the first-time actor graph for property managers, self-managed HOA operators, and board invite recognition is not yet payment-architecture ready
- Gap:
  only authorized operator paths should be able to complete HOA payment onboarding, KYC, bank-linking, and payment controls
- User consequence:
  payment setup authority is under-specified and therefore risky to implement ad hoc

## Product Decisions

### Provider Stack
- Primary ACH stack:
  Dwolla + Plaid
- Direction:
  treat the existing Stripe/generic gateway model as legacy or transitional, not destination architecture

### Owner Identity
- One reusable owner payer profile per owner
- Funding sources are owner-level and reusable across associations
- Owners access payer setup through the owner portal

### HOA Authorization Boundary
- Each HOA requires separate owner authorization
- Reusable owner funding sources do not imply blanket authority across all HOAs
- Authorization copy and stored authorization records must clearly identify the HOA/payee

### HOA Receiving Entity Model
- Each HOA is an independent receiving entity
- Each HOA needs its own provider customer identity, funding source, verification status, and activation lifecycle

### Autopay Modes
- User-selectable autopay modes:
  fixed amount or live-balance mode
- Both modes require HOA-specific authorization

### Payment Visibility
- Pending transfer state must be visible
- Settled state is required before payment is posted as final in the HOA ledger

### Payment Method Strategy
- Offline methods remain first-class:
  check, Zelle, bill pay, and other instructions remain supported
- ACH becomes the primary online payment architecture

### Cross-HOA Experience
- No cross-HOA payment aggregation in this phase
- Payment balances, workflows, and operations remain per HOA

### Setup Authority
- Payment setup authority should be restricted to operator paths:
  property managers and self-managed HOA operators
- This requires a structured onboarding and identity-resolution model as a prerequisite workstream

## Compliance And Risk Direction
- The platform should optimize for:
  clear payee identification, explicit HOA-specific authorization, KYC support, provider-backed state tracking, and durable authorization evidence
- The target compliance boundary is not “duplicate owner profile per HOA”
- The stronger control is:
  one owner identity plus separate HOA-specific authorizations, with retained evidence and clear payee display
- Ledger state should distinguish:
  initiated, pending, settled, failed, returned, reversed, and manually reviewed outcomes

## Keep / Refactor / Retire

### Keep
- Association scoping patterns
- Owner ledger structure and payment reference capabilities
- Payment event transition/audit concept
- Partial-payment rules
- Payment reminder hooks and payment-link workflow shell
- Payment methods registry for non-ACH/offline channels

### Refactor
- `payment_gateway_connections`
- `saved_payment_methods`
- `owner_payment_links`
- `payment_webhook_events`
- `autopay_enrollments`
- `autopay_runs`
- payment page messaging and operator workflows

### Retire Or Demote
- Stripe-centric wording as the primary online ACH story
- direct ledger-write autopay execution as the operational model
- generic “gateway validation” as the architecture anchor

## Target Architecture

### Core Principle
- Direct money movement:
  Owner funding source -> HOA funding source
- The platform coordinates the workflow and records state
- The platform does not operate a shared holding balance or pooled HOA balance

### Core Domain Objects

#### HOA Payment Entity
- association id
- legal business metadata
- Dwolla customer id
- Dwolla verification status
- active receiving funding source id
- onboarding / restricted / active / needs-review status
- operational metadata and audit timestamps

#### Owner Payer Profile
- person id
- auth user / portal identity linkage
- Dwolla customer id
- payer profile status
- display metadata and verification support metadata

#### Owner Funding Source
- owner payer profile id
- Plaid item / account reference or equivalent token linkage
- Dwolla funding source id
- display-safe bank metadata
- default flag
- active / revoked / errored state

#### Owner-HOA Authorization
- owner payer profile id
- association id
- authorization type:
  one-time, recurring, autopay fixed, autopay live-balance
- authorization text version
- accepted at timestamp
- evidence metadata
- active / revoked / superseded status

#### HOA Transfer Record
- association id
- person id
- unit id
- source owner funding source id
- destination HOA funding source id
- Dwolla transfer id
- amount
- mode:
  one-time, autopay fixed, autopay live-balance
- transfer state timeline
- settlement timestamps
- return / reversal metadata

### Workflow Summary

#### HOA Setup
1. Authorized operator enters HOA legal and business details
2. Platform creates or updates the HOA Dwolla customer
3. Authorized operator links the HOA bank account
4. Platform records HOA funding source state
5. HOA payment status becomes eligible only after verification criteria are satisfied

#### Owner Setup
1. Owner signs into the owner portal
2. Owner creates or reuses the payer profile
3. Owner links a bank account through Plaid
4. Platform creates a Dwolla funding source tied to the owner
5. Owner can use the funding source across HOAs, but only after authorizing each HOA

#### One-Time Payment
1. Owner opens a specific HOA payment flow
2. Owner selects the linked funding source
3. Owner sees HOA-specific authorization/payee context
4. Platform creates a Dwolla transfer to the HOA funding source
5. Transfer enters pending state
6. Webhooks update transfer state
7. Ledger posts only after settled success

#### Autopay
1. Owner selects autopay mode:
   fixed amount or live balance
2. Owner consents to HOA-specific recurring authorization
3. Platform stores autopay configuration and authorization reference
4. On due date, platform evaluates amount according to mode
5. Platform creates the provider transfer
6. Transfer remains pending until lifecycle events resolve
7. Ledger posts only on the correct success milestone

## Data Model Direction

### New Or Heavily Revised Tables
- `hoa_payment_entities`
- `hoa_payment_funding_sources`
- `owner_payer_profiles`
- `owner_payment_funding_sources`
- `owner_hoa_payment_authorizations`
- `hoa_payment_transfers`
- `hoa_payment_transfer_events`
- `hoa_payment_setup_reviews` or equivalent operator review state if needed

### Existing Tables Likely To Remain
- `owner_ledger_entries`
- `partial_payment_rules`
- `payment_method_configs`
- selected notice/reminder templates and communication history

### Existing Tables Likely To Be Migrated Or Replaced
- `payment_gateway_connections`
- `saved_payment_methods`
- `payment_webhook_events`
- `owner_payment_links`
- `autopay_enrollments`
- `autopay_runs`

## UX Direction

### Admin / Operator UX
- Separate HOA payment setup from generic finance configuration
- Make HOA setup clearly show:
  legal entity data, provider state, KYC state, bank-link state, readiness, and blocking issues
- Give operators a payment trace view:
  owner -> authorization -> transfer -> events -> ledger

### Owner Portal UX
- One payer profile area in the owner portal
- Reusable owner funding sources
- Per-HOA authorization prompts
- Per-HOA pending and settled state visibility
- Explicit autopay mode selection and authorization language

### Board UX
- Board users can review payment readiness and activity if permitted
- Payment setup authority should remain restricted to operator-authorized paths

## Implementation Implications
- The provider service layer should become a first-class backend module, not scattered route logic
- Ledger posting must be decoupled from transfer initiation
- Existing routes should be re-mapped around transfer lifecycle and authorization state
- Current payment page should evolve from “methods + gateway + links” to:
  HOA receiving setup, owner payment routing, transfer operations, offline methods, and policy controls
- Onboarding and identity-resolution work is a prerequisite because payment setup authority depends on actor classification

## Recommended Sequencing
1. Lock onboarding and payment-setup authority model
2. Finalize canonical provider and authorization records
3. Build HOA receiving-entity model
4. Build owner payer profile and funding-source model
5. Build transfer orchestration and event ingestion
6. Rebuild one-time payment flows
7. Rebuild autopay using provider-backed execution
8. Connect settled transfer outcomes to the ledger
9. Preserve and adapt offline methods, partial-payment rules, and reminders
10. Add operator traceability, migration controls, and rollout gates

## Definition Of Done
- HOA receiving setup is provider-backed and auditable
- Owners manage one payer profile and reusable funding sources through the owner portal
- Each HOA requires separate authorization
- One-time payments and autopay use provider-backed ACH transfer flows
- Pending, settled, failed, returned, and reversed states are visible and supportable
- Only settled transfers post final ledger payments
- Offline methods remain supported
- Operator authority paths for setup are explicit and enforced
- Migration from the current payment foundation is documented and controlled

## Source Notes
- Dwolla documentation informed the customer/funding-source/transfer model direction
- Plaid documentation informed bank-linking and token-exchange assumptions
- NACHA guidance informed the conclusion that payee clarity and retained authorization matter more than duplicating owner identity per HOA
