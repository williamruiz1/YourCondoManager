# FTPH Detailed Spec Comparison Addendum - 2026-03-15

## Purpose

Compare the proposed resident-data, communications, onboarding, maintenance, feedback, payment-instruction, and board-reminder specifications against the current FTPH documentation, feature tree, and published implementation shape at a field and workflow level.

This addendum exists because broad capability matches are not sufficient. Where the product or FTPH docs already contain a related feature, this document records whether the detailed data model, routing rule, token behavior, or lifecycle semantics are actually equivalent.

## Evidence Base

- FTPH source: `docs/roadmap/ftph-v2.1.md`
- Later-phase roadmap: `docs/roadmap/phases-6-10.md`
- Feature tree definition: `shared/ftph-feature-tree.ts`
- Feature tree parser: `server/ftph-feature-tree.ts`
- Current schema evidence: `shared/schema.ts`
- Current implementation evidence: `server/storage.ts`, `server/routes.ts`

## Comparison Summary

### Covered at a broad level but not equivalent in detailed behavior

- Owner and tenant intake exists, but current documentation does not define paired per-unit owner and tenant submission links, occupancy-conditional owner intake, or explicit token regeneration rules.
- Association onboarding exists, but the current documented completion model does not break out owner completion, tenant completion, board setup, and communications-template readiness exactly as required.
- Communications exist, but the current FTPH branch does not define a first-class recipient targeting model, structured header/footer/signature composition, or canonical variable coverage for owner/tenant submission links.
- Maintenance requests exist, but the current documentation does not define a public resident-facing intake form with the exact requester fields and does not align lifecycle naming to `Submitted -> Under Review -> Assigned -> In Progress -> Completed -> Closed`.
- Payment method configuration exists, but the current FTPH documentation and schema only support generic instructions and support contacts, not structured bank-transfer and mailed-check fields.
- Governance tasks and reminders exist broadly, but the current FTPH model does not define fixed 30-day, 14-day, and 7-day reminder cadence rules for board and administrator recipients.

### Net-new feature families not currently represented as first-class FTPH units

- Resident feedback capture and analytics
- Structured payment instruction registry
- Communication targeting and merge engine
- Secure dual-link unit intake model

## Detailed Findings by Requirement Group

## 1. Unit Ownership and Tenant Data Collection

### 1.1 Unit occupancy state model

Current FTPH coverage:
- `1.1 Unit Registry`
- `1.3 Tenant Contact Registry`
- Current schema models `occupancies.occupancyType` with `OWNER_OCCUPIED` and `TENANT`.

Detailed gap:
- The implementation now derives canonical per-unit occupancy state as `owner occupied`, `rental occupied`, `vacant`, or `unassigned` from active ownership and occupancy records.
- The resident dataset and association overview now expose derived `ownerCount`, `tenantCount`, `occupantCount`, `occupancyStatus`, `lastOccupancyUpdate`, and occupancy-rate rollups.
- The remaining documentation gap is to carry that delivered derivation model forward as the explicit FTPH contract for `1.5.1`.

Documentation action:
- Add `1.5.1 Derive Unit Occupancy State [Logic]`.
- Carry forward the required derivation contract:
  - owner occupied = at least one active owner and zero active tenants with owner occupancy present
  - rental occupied = at least one active owner and at least one active tenant
  - vacant = at least one active owner and zero active tenants with no active occupancy

### 1.2 Owner structure

Current FTPH coverage:
- `1.2 Owner Registry`
- Multi-owner support is already documented.

Detailed gap:
- The existing FTPH docs do not define a maximum of two owners per unit.
- `is_primary_owner` is not documented as a required owner relationship field.
- Required communication routing for all owners across association, financial, and governance notices is not explicitly encoded.

Documentation action:
- Extend owner registry notes to document:
  - minimum one active owner per unit
  - maximum two active owners per unit when this stricter operating rule is enabled
  - primary-owner designation for delivery fallback and presentation order

### 1.3 Tenant structure

Current FTPH coverage:
- `1.3 Tenant Contact Registry`
- Current roadmap project already references multi-tenant support.

Detailed gap:
- Tenant routing restrictions are not explicitly documented.
- The FTPH branch does not distinguish operational notices that tenants should receive from governance and financial communications they must not receive.

Documentation action:
- Extend tenant-contact coverage with routing policy:
  - tenants receive maintenance notifications, service alerts, and building announcements
  - tenants do not receive governance notices, financial reports, or owner-balance communications

### 1.4 Submission forms and secure links

Current FTPH coverage:
- `1.3.1 Submit Tenant Information Form`
- Current schema and routes include `onboardingInvites` and `onboardingSubmissions`.

Detailed gap:
- The implementation now generates and reuses paired unit-scoped owner and tenant links through onboarding invites, and admins can explicitly regenerate those links.
- The remaining gap is form depth: the owner form must carry optional second-owner capture plus conditional tenant entry when the unit is not owner occupied.
- Current documentation does not require separate `Add Tenant` and `Remove Tenant` form behavior.
- Token expiry exists in schema and link regeneration is now implemented, but the FTPH branch still needs to reflect the delivered status split between links/tokens and the remaining form-capture depth.

Documentation action:
- Add `1.4 Resident Intake and Secure Submission Links` with:
  - `1.4.1 Generate Owner Update Link`
  - `1.4.2 Generate Tenant Submission Link`
  - `1.4.3 Capture Occupancy-Conditional Owner Submission`
  - `1.4.4 Capture Multi-Tenant Submission`
  - `1.4.5 Expire and Regenerate Submission Tokens`

## 2. Association Onboarding and Completeness Dashboard

Current FTPH coverage:
- Existing communications/onboarding roadmap workstream
- Current implementation exposes association overview and onboarding completeness endpoints

Detailed gap:
- The implementation now computes explicit setup domains for units configured, owner data collected, tenant data collected, board members configured, payment methods configured, and communication templates configured.
- The association overview now exposes occupancy-rate rollups and the onboarding console renders per-domain completion percentages instead of a single opaque weighted score.
- Remediation actions are now structured and direct, including owner-link collection, tenant-data collection, board setup, payments, communications templates, and contact-data cleanup.
- The remaining documentation task is simply to reflect this delivered behavior in the canonical FTPH branch rather than describing it as a gap.

Documentation action:
- Add `1.5 Association Onboarding and Completeness Dashboard` with:
  - `1.5.2 Compute Completion Metrics by Setup Domain`
  - `1.5.3 Display Association Overview Metrics`
  - `1.5.4 Surface Actionable Remediation Tasks`

## 3. Communication System

Current FTPH coverage:
- `7.1 Notice Automation`
- Current implementation supports templates, simple variable replacement, email sends, communication history, default footer append, and readiness gating.

Detailed gap:
- The implementation now supports explicit targeting for all owners, all tenants, all occupants, selected units, individual owner, individual tenant, and board members.
- Templates now support discrete `Header`, `Body`, `Footer`, and `Signature` blocks.
- Canonical merge variables are now resolved for:
  - `{{association_name}}`
  - `{{association_address}}`
  - `{{unit_number}}`
  - `{{owner_name}}`
  - `{{tenant_name}}`
  - `{{maintenance_request_link}}`
  - `{{tenant_submission_link}}`
  - `{{owner_submission_link}}`
- Communication routing now enforces owner-only delivery for governance and financial message classes while allowing operational or maintenance sends to include tenants.
- Targeted sends now persist campaign-level recipient-set audit metadata alongside individual sends, so the recipient set, targeting rule, skipped counts, and generated send IDs can be reconstructed after delivery.

Documentation action:
- Add `7.2 Communication Targeting and Merge Engine` with:
  - `7.2.1 Select Recipients by Role and Unit Scope`
  - `7.2.2 Compose Header Footer and Signature Blocks`
  - `7.2.3 Resolve Canonical Communication Variables`
  - `7.2.4 Enforce Owner and Tenant Routing Rules`
  - `7.2.5 Persist Recipient Set and Delivery Audit`

## 4. Maintenance Request System

Current FTPH coverage:
- `7.3 Owner and Tenant Maintenance Request Portal`
- Current schema already supports attachments, category, priority, due dates, escalation stages, and status history.

Detailed gap:
- Current FTPH docs describe portal submission, not a clearly documented public resident intake form that captures:
  - name
  - unit number
  - email
  - phone
  - issue description
  - issue location
  - photo upload
- Current schema status names are:
  - submitted
  - triaged
  - in-progress
  - resolved
  - closed
  - rejected
- The proposed requirement expects:
  - submitted
  - under review
  - assigned
  - in progress
  - completed
  - closed
- This is not an equivalent lifecycle even though both represent issue progression.

Documentation action:
- Extend `7.3` with:
  - `7.3.5 Accept Public Resident Maintenance Intake`
  - `7.3.6 Map Resident Request Lifecycle to Admin Workflow States`

## 5. Resident Feedback System

Current FTPH coverage:
- None as a first-class product branch.

Detailed gap:
- No feature set currently captures resident feedback intake, optional anonymity, satisfaction scoring, or aggregate theme analysis.

Documentation action:
- Add `9.6 Resident Feedback and Satisfaction Signals` under the owner-experience branch with:
  - `9.6.1 Submit Resident Feedback`
  - `9.6.2 Aggregate Satisfaction Metrics`
  - `9.6.3 Cluster Improvement Themes`

## 6. HOA Payment Instruction Automation

Current FTPH coverage:
- Current implementation has `paymentMethodConfigs` and outbound payment-instruction messaging.
- Existing docs broadly mention payment instructions and payment-method configuration.
- Structured payment setup data is now implemented in the platform and owner payment notices now resolve structured payment variables from those stored fields.

Detailed gap:
- The remaining documentation task is to reflect the delivered structure explicitly:
  - `account_name`
  - `bank_name`
  - `routing_number`
  - `account_number`
  - `mailing_address`
  - `payment_notes`
  - `zelle_handle`
- The owner payment instruction flow is now aligned to owner-targeted financial messaging, but that delivered owner-only routing behavior still needs to be treated as canonical FTPH wording rather than an implementation detail.

Documentation action:
- Add `3.3 Association Payment Instruction Registry` with:
  - `3.3.1 Store Structured Payment Method Details`
  - `3.3.2 Generate Owner Payment Setup Instructions`
  - `3.3.3 Route Payment Setup Notices to Owners`

## 7. Board Reminder System

Current FTPH coverage:
- `6.1 Annual Compliance Checklist`
- Current roadmap work already references reminder rules generically.

Detailed gap:
- The proposed requirement fixes a reminder cadence at 30, 14, and 7 days before due items.
- Board-member and administrator recipient rules are not explicitly documented as part of the annual governance workflow branch.

Documentation action:
- Add `6.2 Governance Reminder Automation` with:
  - `6.2.1 Configure Governance Reminder Rules`
  - `6.2.2 Trigger 30-14-7 Day Reminder Cadence`
  - `6.2.3 Route Reminders to Board Members and Administrators`

## 8. Managed Regulatory Record System

Current FTPH coverage:
- `8.4 Managed Regulatory Record System` is now the intended source-of-truth branch.
- The legacy implementation underneath it was still just `governanceComplianceTemplates` plus a static seeded CT/FL/CA checklist library.

Delivered now:
- Regulatory records now persist authoritative source metadata directly on the core compliance-template records:
  - `source_authority`
  - `source_url`
  - `source_document_title`
  - `source_document_date`
  - `effective_date`
  - `last_source_updated_at`
  - `last_verified_at`
  - `last_synced_at`
  - `next_review_due_at`
  - `publication_status`
  - `published_at`
  - `review_notes`
- Seeded jurisdiction records for CT, FL, and CA are now documented with official source URLs and legal-reference citations per checklist item.
- The platform sync path now refreshes those records as managed regulatory records rather than anonymous library rows.
- The governance compliance UI now surfaces published vs review vs stale record counts, shows authoritative source links and last-updated dates, and supports review-to-published lifecycle actions.
- Association overlays continue to extend the state record base using `associationId` plus `baseTemplateId`, so applicability overlays remain part of the same operational model instead of forking the source-backed jurisdiction record set.

Remaining gap:
- There is still no automatic crawler or scheduled background fetch against internet sources; current updates are reviewed sync actions initiated from the platform admin workflow.
- Automatic internet refresh remains the major follow-on enhancement; the platform now has bylaw-rule extraction, regulatory-vs-bylaw gap detection, alert surfacing, and suppression override workflow in the governance compliance workspace.

Documentation action:
- Treat `8.4.1`, `8.4.2`, `8.4.3`, `8.4.4`, and `8.4.5` as delivered at the managed-record level, with the remaining roadmap work focused on automated internet refresh cadence rather than base record structure.
- Treat `8.3.1`, `8.3.2`, `8.3.3`, and `8.3.4` as delivered in implementation through clause-based rule extraction, managed-record comparison, dashboard alerts, and suppression overrides.

## Proposed Feature-Tree Promotions

- Module 1:
  - `1.4 Resident Intake and Secure Submission Links`
  - `1.5 Association Onboarding and Completeness Dashboard`
- Module 3:
  - `3.3 Association Payment Instruction Registry`
- Module 6:
  - `6.2 Governance Reminder Automation`
- Module 7:
  - `7.2 Communication Targeting and Merge Engine`
- Module 9:
  - Extend `7.3 Owner and Tenant Maintenance Request Portal`
- Module 11:
  - `9.6 Resident Feedback and Satisfaction Signals`

## Delivery Guidance

- Treat the existing onboarding, communications, and maintenance capabilities as a structural base, not as proof that the detailed requirement is already satisfied.
- Extend existing entities where possible:
  - `units`
  - `ownerships`
  - `occupancies`
  - `onboardingInvites`
  - `onboardingSubmissions`
  - `noticeTemplates`
  - `communicationHistory`
  - `maintenanceRequests`
  - `paymentMethodConfigs`
- Do not duplicate broad feature families already present in FTPH when the real gap is detailed behavior, schema fidelity, or routing semantics.
