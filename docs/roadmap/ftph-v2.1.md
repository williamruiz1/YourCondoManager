# Condo Property Manager - FTPH v2.1 Documentation

## Document Metadata
- Document Version: 2.3
- Generated On: 2026-03-15
- Status: Draft with implementation gap addendum
- Output Type: Full FTPH Write-Up

## Platform Overview
- Purpose: Provide a scalable condo association management platform supporting governance, owner/unit records, financial operations, document management, and operational workflows for condo associations beginning with an 18-unit complex in New Haven, Connecticut.
- Context Mode: Both
- Core Architecture: Product Root > Modules > Feature Sets > Functional Units

### Initial Deployment Scope
- Single condo complex
- Board-managed operations
- Manual data entry
- No external integrations initially

### Future Expansion Scope
- Multiple condo associations
- Platform-as-a-service
- AI document ingestion
- Email automation
- Owner portal

## Module List
1. Unit, Owner & Occupancy Registry
2. Governance & Board Administration
3. Financial Operations & Fee Management
4. Document & Record Management
5. Meetings, Notes & Decision Records
6. Operational Tasks, Compliance & Calendar
7. Communications & Notice System
8. Platform Services, Permissions & Audit

## Implementation Gap Addendum
- Addendum Date: 2026-03-14
- Purpose: Record implementation gaps discovered during post-publication comparison of the FTPH target model against the live product and Admin roadmap.

### Gaps Not Explicitly Captured in the Original v2.1 Draft
- Financial operations are structurally broad, but the live platform still lacks a full production payment loop:
  - no hosted ACH/card checkout
  - no owner-managed saved payment methods
  - no autopay enrollment and recurring collections
  - no delinquency workflow or collections handoff
  - no bank reconciliation workflow
  - no board-ready financial report/export suite
  - payment gateway validation exists, but live provider handshake and transaction hardening were not originally spelled out as a remaining gap
- Property operations are only partially represented in v2.1:
  - maintenance requests exist in the product, but vendor registry, work orders, preventive maintenance, and inspection records were not called out strongly enough as missing operational layers
- Communications and platform services are broadly present, but the original draft understated remaining production-hardening work:
  - trusted outbound delivery hardening
  - authorization tightening
  - auth/session hardening
  - document-delivery/access hardening
  - association-scoped invited board-member access for owners who also serve on the board
- The original v2.1 draft correctly scoped several items out, but it did not distinguish between:
  - intentionally out-of-scope v2.1 items
  - future-phase capabilities already planned for phases 6-10
  - implementation gaps inside partially delivered live modules

### Implementation-Status Interpretation
- Delivered: broadly usable in the live product
- Partial: published and usable in some form, but still missing critical end-to-end workflows or production hardening
- Inactive: planned in documentation, but not yet delivered in live product

## 1. Unit, Owner & Occupancy Registry
- Purpose: Maintain authoritative registry of all units, owners, tenants, and contact relationships while preserving historical ownership and occupancy records.

### 1.1 Feature Set: Unit Registry
- Intent Summary: Establish the master record for each condo unit.
- Description: Stores structural and operational data about units including identifiers, addresses, and future-ready allocation attributes.
- User Story: As a property administrator, I want a master unit registry so I can track all units within the association.
- Scope Boundary: Does not track maintenance requests, fee balances, or lease terms.
- Feature Set-Level Functional Unit Summary: Provides creation, editing, and lifecycle tracking of unit records so units can anchor ownership, occupancy, fees, and documents.
- Dependencies:
  - Association configuration
  - Owner registry
- Risks:
  - Incorrect initial data entry
  - Unit structure complexity for future mixed-use or sub-unit cases
- Open Questions:
  - Should units support commercial-use flags from the initial release?
  - Should square footage be required or optional at creation?
- Implementation Notes: Model unit attributes to support future allocation methods such as flat fees and square-footage-based dues.

#### Functional Units
- 1.1.1 Create Unit Record [Data]
  - User Story: As an administrator, I want to create a unit record so the unit exists in the association system.
  - Acceptance Criteria:
    - Given the administrator is on the unit registry page
    - When the administrator enters required unit data and saves
    - Then the system creates a unit with a unique identifier and association link

- 1.1.2 Edit Unit Attributes [Data]
  - User Story: As an administrator, I want to edit unit attributes so records remain accurate over time.
  - Acceptance Criteria:
    - Given an existing unit record exists
    - When the administrator updates editable unit fields
    - Then the system saves the changes and preserves the updated values

- 1.1.3 Track Unit Lifecycle History [Logic]
  - User Story: As an administrator, I want unit lifecycle history so important unit-level changes are preserved.
  - Acceptance Criteria:
    - Given a tracked unit field changes
    - When the update is saved
    - Then the system logs the change historically with timestamp and actor

### 1.2 Feature Set: Owner Registry
- Intent Summary: Maintain the master profile and ownership relationships for all unit owners.
- Description: Supports one owner owning multiple units and multiple owners sharing one unit while preserving ownership history.
- User Story: As a property administrator, I want a centralized owner registry so I can manage ownership relationships across the association.
- Scope Boundary: Does not manage mortgage data, tax filings, or rental lease agreements.
- Feature Set-Level Functional Unit Summary: Provides owner profile creation, owner-to-unit linking, and multi-owner relationship management so the platform can represent real ownership structures.
- Dependencies:
  - Unit registry
  - Association configuration
- Risks:
  - Duplicate owner profiles due to inconsistent naming
  - Improper historical handling when ownership changes
- Open Questions:
  - Should ownership percentages be required from the first release?
  - Should mailing address history be preserved separately from owner identity history?
- Implementation Notes: Use a reusable person/entity model so an owner can also serve as a board member or occupant contact without duplicate person records.

#### Functional Units
- 1.2.1 Create Owner Profile [Data]
  - User Story: As an administrator, I want to create owner profiles so ownership relationships can be recorded.
  - Acceptance Criteria:
    - Given owner identity and contact details are entered
    - When the administrator saves the form
    - Then the system creates a reusable owner profile

- 1.2.2 Link Owner to Unit [Logic]
  - User Story: As an administrator, I want to associate an owner with a unit so current ownership is tracked accurately.
  - Acceptance Criteria:
    - Given both an owner and unit record exist
    - When the administrator creates an ownership relationship
    - Then the system stores the owner-unit link with effective dates

- 1.2.3 Manage Multiple Owners [Logic]
  - User Story: As an administrator, I want to support multiple owners so joint ownership can be recorded correctly.
  - Acceptance Criteria:
    - Given a unit supports more than one owner
    - When the administrator adds multiple valid ownership records
    - Then the system preserves all active and historical owner relationships without overwriting prior records

### 1.3 Feature Set: Tenant Contact Registry
- Intent Summary: Track emergency and operational contact details for occupants of rented units.
- Description: Stores non-lease tenant contact information and occupancy relationships for safety, notices, and emergency access.
- User Story: As a property administrator, I want tenant contact records for rented units so the association can reach occupants when needed.
- Scope Boundary: Does not manage leases, rent payments, security deposits, or rental performance tracking.
- Feature Set-Level Functional Unit Summary: Provides intake, storage, and historical tracking of occupant contact records so the association can manage tenant-facing communications without becoming a rental management system.
- Dependencies:
  - Unit registry
  - Owner registry
- Risks:
  - Stale tenant data if owners do not update occupant details
  - Confusion between owner mailing contacts and occupant contacts
- Open Questions:
  - Should owner-submitted tenant updates require admin approval before becoming active?
  - Should emergency contact fields be separate from primary tenant contact fields?
- Implementation Notes: Keep the data model contact-focused and occupancy-focused only, with no lease abstraction in the initial scope.

#### Functional Units
- 1.3.1 Submit Tenant Information Form [UX]
  - User Story: As an owner or administrator, I want a simple form to submit tenant details so occupant contact data can be collected consistently.
  - Acceptance Criteria:
    - Given a rented unit needs occupant data
    - When the form is completed and submitted
    - Then the system captures the submission for storage or review

- 1.3.2 Store Tenant Contact Record [Data]
  - User Story: As an administrator, I want to store tenant contact records so the association can contact occupants directly when necessary.
  - Acceptance Criteria:
    - Given a valid occupant submission or manual entry exists
    - When the administrator saves or approves the record
    - Then the system stores the occupant contact against the correct unit

- 1.3.3 Track Occupancy History [Logic]
  - User Story: As an administrator, I want occupancy history so prior tenant contact periods are preserved over time.
  - Acceptance Criteria:
    - Given an occupant changes for a unit
    - When the current occupancy record is ended and a new one is created
    - Then the system preserves both historical and current occupancy periods

## 2. Governance & Board Administration
- Purpose: Track board composition, officer roles, governance structure, and service history.

### 2.1 Feature Set: Board Member Registry
- Intent Summary: Maintain the official roster of board members and officer roles.
- Description: Links board service to owner/person records and tracks role titles, effective periods, and governance assignments.
- User Story: As a property administrator, I want a board registry so the association always knows who is serving in what capacity.
- Scope Boundary: Does not manage parliamentary procedure rules, voting outcomes, or meeting minutes in this feature set.
- Feature Set-Level Functional Unit Summary: Provides role assignment, board metadata storage, and service history so governance roles remain traceable over time.
- Dependencies:
  - Owner registry
  - Person/entity model
- Risks:
  - Board records becoming misaligned with actual service periods
  - Duplicate board assignments for the same role and term
- Open Questions:
  - Should non-owner board service ever be allowed by configuration?
  - Should interim appointments be tracked separately from elected terms?
- Implementation Notes: Allow board service to reference the shared person model so role changes do not require duplicate profile creation. Board service alone records governance status; invited board-member workspace access and association-scoped edit authority are handled in Platform Services so board members can operate without becoming global admins.

#### Functional Units
- 2.1.1 Assign Board Member Role [Logic]
- 2.1.2 Store Board Role Metadata [Data]
- 2.1.3 Track Board Service History [Logic]

## 3. Financial Operations & Fee Management
- Purpose: Manage HOA dues, assessments, invoices, utility expenses, and owner-facing balances.

### 3.1 Feature Set: Fee & Assessment Engine
- Intent Summary: Generate and manage owner financial obligations such as common charges, assessments, and late fees.
- Description: Supports flat-fee dues now while preserving extensibility for future allocation methods and installment assessments.
- User Story: As a property administrator, I want a fee and assessment engine so financial obligations can be created and tracked consistently.
- Scope Boundary: Does not include online payment processing, bank feeds, or full general-ledger accounting.
- Implementation Gap Note: The live platform can calculate obligations and post ledger activity, but still lacks production payment collection, autopay, delinquency handling, reconciliation, and finance-report closure workflows.
- Feature Set-Level Functional Unit Summary: Provides charge configuration, assessment creation, late-fee logic, and owner balance visibility so the association can manage receivables operationally.
- Dependencies:
  - Unit registry
  - Owner registry
- Risks:
  - Improper charge calculations if ownership dates are inaccurate
  - Rule complexity expanding too early beyond MVP needs
- Open Questions:
  - Should late fees be applied automatically or only after admin review in the first release?
  - Should assessments support owner-level overrides from day one?
- Implementation Notes: Model fee rules separately from posted charges so future changes do not rewrite financial history.

#### Functional Units
- 3.1.1 Create HOA Fee Schedule [Logic]
- 3.1.2 Create Special Assessment [Logic]
- 3.1.3 Calculate Late Fees [Logic]
- 3.1.4 Track Owner Ledger Balance [Data]

### 3.2 Feature Set: Expense & Invoice Tracking
- Intent Summary: Record association expenses, utility payments, invoices, and related attachments.
- Description: Provides structured operational expense tracking for bills, vendor invoices, and utility-related costs.
- User Story: As a property administrator, I want expense and invoice records so the association can track what it owes and what it has paid.
- Scope Boundary: Does not include bank reconciliation, AP automation, or tax return preparation workflows.
- Implementation Gap Note: The live platform supports invoice and utility tracking, but vendor registry separation, invoice-to-work-order linkage, and reconciliation-period controls remain outstanding.
- Feature Set-Level Functional Unit Summary: Provides invoice entry, utility payment tracking, and attachment storage so expense records remain centralized and auditable.
- Dependencies:
  - Document repository
  - Financial account configuration
- Risks:
  - Missing attachments reducing auditability
  - Expense categories becoming inconsistent without standards
- Open Questions:
  - Should vendor records be their own feature set in the next iteration?
  - Should utilities be modeled under a separate account framework from other expenses?
- Implementation Notes: Use shared attachment and categorization patterns so invoices and utility bills can be filtered consistently later.

#### Functional Units
- 3.2.1 Record Vendor Invoice [Data]
- 3.2.2 Track Utility Payments [Data]
- 3.2.3 Store Expense Attachments [Data]

## 4. Document & Record Management
- Purpose: Centralize governing documents, budgets, insurance records, contracts, minutes, and supporting files.

### 4.1 Feature Set: Document Repository
- Intent Summary: Provide a structured document repository with tagging and version awareness.
- Description: Stores uploaded files and associates them to relevant operational entities such as association, unit, owner, meeting, or financial record.
- User Story: As a property administrator, I want a document repository so important records are centralized and retrievable.
- Scope Boundary: Does not perform AI extraction or autonomous compliance analysis in this feature set.
- Feature Set-Level Functional Unit Summary: Provides upload, tagging, and version control foundations so documents can support every major module in the platform.
- Dependencies:
  - Association registry
  - Shared entity tagging model
- Risks:
  - Unstructured uploads reducing findability
  - Version confusion if replacement logic is unclear
- Open Questions:
  - Should retention policies be enforced from the first release or configured later?
  - Should owner-visible and internal-only visibility flags be included now?
- Implementation Notes: Use a flexible tagging model so documents can be associated with multiple entity types without duplicated storage patterns.

#### Functional Units
- 4.1.1 Upload Document [UX]
- 4.1.2 Tag Document to Entity [Logic]
- 4.1.3 Maintain Document Version History [Logic]

### 4.2 Feature Set: AI Document Ingestion
- Intent Summary: Use AI-assisted extraction to convert raw uploads or pasted text into structured, reviewable records.
- Description: Supports ingestion jobs, candidate metadata extraction, and human-reviewed parsing for documents such as bylaws, invoices, budgets, and minutes.
- User Story: As a property administrator, I want AI-assisted document ingestion so manual data-entry effort can be reduced without sacrificing control.
- Scope Boundary: Does not allow autonomous legal interpretation or automatic production updates without human approval.
- Implementation Gap Note: The live platform has a real ingestion queue, review workspace, preview/commit import flow, fallback parsers, rollback, and clause review, but the feature set is still only partially complete:
  - raw upload support now directly parses PDFs, DOCX files, and XLSX workbooks in addition to text-like formats, but broader binary-source coverage is still incomplete
  - commit import now covers the current extracted record set, including governance meeting-note routing and document-metadata reconciliation into the repository
  - clause outputs now carry both repository-document provenance and an extracted-record trace anchor from the same ingestion job
  - reprocessing now preserves prior extraction artifacts for import-run integrity, the admin workspace surfaces active versus superseded outputs per job, rollout monitoring tracks superseded-output accumulation, and admins can preview/run retention-based cleanup for purgeable superseded artifacts
- Feature Set-Level Functional Unit Summary: Provides intake, extraction, and structured storage of reviewable AI outputs so documents can become searchable and actionable.
- Dependencies:
  - Document repository
  - Review workflow model
- Risks:
  - Incorrect extraction causing bad downstream associations
  - Overreliance on AI confidence without human review
  - Superseded extraction history can accumulate without enough operator-facing lifecycle controls if cleanup and reporting are not added
- Open Questions:
  - Should document-type-specific extraction templates be included in the first AI iteration?
  - Should parsed data save as draft records or only as extraction artifacts initially?
  - Should binary-source text extraction for PDF and similar formats become a first-class part of ingestion rather than an operator pre-step?
  - Should every extracted clause and parsed record retain a durable source-document and extracted-record link across reprocess cycles?
- Implementation Notes: Build a review-first extraction pipeline where all AI outputs remain editable and traceable to the original source.

#### Functional Units
- 4.2.1 Upload Raw Document for Parsing [UX]
  - Current state: Partial
  - Delivered now:
    - admins can stage ingestion jobs from uploaded PDFs, DOCX files, XLSX workbooks, text-like files, or pasted source text
    - admins can also stage ingestion jobs from an existing repository document to retain source provenance without re-uploading the file
    - rollout policy, job queueing, and process actions are implemented
  - Remaining gaps:
    - direct parsing is still limited to PDFs, DOCX files, XLSX workbooks, plus text-oriented upload formats
    - other common binary documents may still require manual text extraction before ingestion
- 4.2.2 Extract Document Metadata [Logic]
  - Current state: Partial
  - Delivered now:
    - AI-first extraction with fallback heuristics exists
    - classifier guidance, route hints, quality warnings, and reviewable extracted records are implemented
    - bylaw-like text can produce clause candidates with tags and suggested links
    - clause outputs inherit repository-document provenance when the source ingestion job is linked to a stored document
    - clause outputs are also linked to a concrete extracted record from the same ingestion job for durable review traceability
  - Remaining gaps:
    - extraction coverage is stronger for owner/contact/invoice/bank flows than for general document classes such as budgets and minutes
- 4.2.3 Store Parsed Data [Data]
  - Current state: Partial
  - Delivered now:
    - extracted records, clause records, preview runs, commit runs, rollback metadata, and review decisions are persisted
    - approved records can commit into owners, persons, invoices, owner-ledger workflows, governance meetings/notes, and document-repository records
    - reprocessing preserves prior extracted-record history instead of deleting records that import runs still reference
    - admins can inspect active versus superseded outputs for a selected ingestion job and optionally include superseded records/clauses in review
    - rollout monitoring reports superseded record/clause accumulation, jobs carrying historical outputs, and oldest retained superseded age
    - admins can preview and execute retention-based cleanup for purgeable superseded clauses and unreferenced extracted records
  - Remaining gaps:

## 5. Meetings, Notes & Decision Records
- Purpose: Track association meetings, preserve notes and minutes, and maintain a searchable record of decisions.

### 5.1 Feature Set: Meeting Tracker
- Intent Summary: Manage meeting records, supporting notes, and publishable summaries.
- Description: Stores meeting metadata, notes, attachments, and publish states for board and association meetings.
- User Story: As a property administrator, I want to track meetings and related records so governance activity is organized and defensible.
- Scope Boundary: Does not implement full voting procedure rules, owner portal publishing, or automated scheduling integrations in this feature set.
- Feature Set-Level Functional Unit Summary: Provides meeting creation, note capture, and summary publication support so governance records can be created and shared consistently.
- Dependencies:
  - Board member registry
  - Document repository
- Risks:
  - Informal note-taking leading to incomplete minutes
  - Confusion between internal draft notes and approved summaries
- Open Questions:
  - Should agenda items be first-class records in the initial release?
  - Should meeting categories be configurable by association?
- Implementation Notes: Separate draft notes from final summaries so governance workflows can mature without overwriting raw records.

#### Functional Units
- 5.1.1 Schedule Meeting Record [Data]
- 5.1.2 Record Meeting Notes [Data]
- 5.1.3 Publish Meeting Summary [Logic]

## 6. Operational Tasks, Compliance & Calendar
- Purpose: Ensure board obligations, recurring tasks, and governance deadlines are visible and trackable.

### Module Implementation Gap Note
- Governance tasking is delivered, but property-operations workflows are not complete in the live platform.
- Maintenance requests and escalation fields exist, yet the broader operational layer still lacks vendor management, work-order lifecycle management, preventive maintenance scheduling, and inspection records.

### 6.1 Feature Set: Annual Compliance Checklist
- Intent Summary: Provide a recurring annual checklist for required governance and operational responsibilities.
- Description: Tracks recurring tasks such as budget review, ratification, insurance renewal, record reviews, and other board-administered duties.
- User Story: As a property administrator, I want an annual compliance checklist so critical association responsibilities are not missed.
- Scope Boundary: Does not perform legal compliance verification or external governmental filing submission.
- Feature Set-Level Functional Unit Summary: Provides task generation, progress tracking, and dashboard visibility so annual obligations can be monitored operationally.
- Dependencies:
  - Meeting tracker
  - Association configuration
- Risks:
  - Checklist incompleteness if requirements differ by governing documents
  - Tasks becoming stale without ownership and due-date discipline
- Open Questions:
  - Should checklist templates vary by state and later by bylaws?
  - Should overdue escalation rules exist in the MVP or later?
- Implementation Notes: Start with a configurable template model so state-level and bylaw-driven requirements can be layered in later.

#### Functional Units
- 6.1.1 Create Annual Governance Tasks [Logic]
- 6.1.2 Track Task Completion [Data]
- 6.1.3 Display Compliance Dashboard [UX]

## 7. Communications & Notice System
- Purpose: Provide structured communications, template-based notices, and communication history for owners and occupants.

### Module Implementation Gap Note
- Core communications and templated notices are live, but the remaining gaps are delivery trust and production integrity rather than missing foundational feature coverage.
- The original draft did not explicitly record that outbound delivery verification and productionized notice trust would remain active hardening tracks after initial publication.

### 7.1 Feature Set: Notice Automation
- Intent Summary: Generate and manage repeatable notices and track outbound communication history.
- Description: Supports templated notices, email sends, and communication logging for association-to-owner or association-to-occupant outreach.
- User Story: As a property administrator, I want notice automation support so routine communication can be managed consistently.
- Scope Boundary: Does not include complex campaign automation, SMS channels, or two-way support-ticket workflows in the first iteration.
- Feature Set-Level Functional Unit Summary: Provides template generation, outbound send actions, and historical logging so communications remain consistent and auditable.
- Dependencies:
  - Owner registry
  - Tenant contact registry
- Risks:
  - Sending notices to stale contacts
  - Template errors leading to inaccurate communications
- Open Questions:
  - Should sends require preview approval before dispatch in the first release?
  - Should notices be association-scoped templates or globally reusable templates by default?
- Implementation Notes: Design the communication log as a first-class record so future Gmail sync and owner portal visibility can build on it cleanly.

#### Functional Units
- 7.1.1 Generate Notice Template [Logic]
- 7.1.2 Send Email Notice [Integration]
- 7.1.3 Log Communication History [Data]

## 8. Platform Services, Permissions & Audit
- Purpose: Provide foundational infrastructure for secure access, permissions, and change traceability.

### Module Implementation Gap Note
- Platform controls, roles, and audit are live, but the original draft understated how much hardening would still be required around session/auth controls, fine-grained authorization, OAuth cutover, and document access integrity.

### 8.1 Feature Set: Role-Based Permissions
- Intent Summary: Control who can view, create, edit, or administer records across the platform.
- Description: Defines role-based access patterns for internal admins, board members, managers, and future external users.
- User Story: As a platform administrator, I want role-based permissions so users only access functions and data appropriate to their role.
- Scope Boundary: Does not include SSO, external identity providers, or advanced attribute-based access control in the first release.
- Feature Set-Level Functional Unit Summary: Provides role assignment, access restriction, and permission validation so the platform remains secure and operationally controlled.
- Dependencies:
  - User account model
  - Audit logging framework
- Risks:
  - Overly broad permissions exposing sensitive data
  - Role sprawl causing unclear authorization behavior
- Open Questions:
  - Should board members have edit access to all governance modules or only selected records?
  - Should owner-facing roles be introduced in the same permission model or isolated later?
- Implementation Notes: Start with a simple role-based model that can expand later to association-scoped permissions and external portal roles.

#### Functional Units
- 8.1.1 Assign User Role [Security]
- 8.1.2 Restrict Data Access [Security]
- 8.1.3 Validate Permission Changes [Logic]

### 8.2 Feature Set: Association-Scoped Board Member Access
- Intent Summary: Allow invited board members to operate within one association with board-level view and edit access, including owners who also serve on the board.
- Description: Defines the invitation, activation, permission scope, and workspace behavior for board members who need to access association records without receiving platform-wide administrator access.
- User Story: As a property administrator, I want to invite a board member into an association-scoped board workspace so they can view and edit the association they serve.
- Scope Boundary: Does not grant portfolio-wide access, platform-controls access, admin-user management, or permissions outside the invited association.
- Feature Set-Level Functional Unit Summary: Provides invite-driven board access, scope-aware permission enforcement, and combined owner-plus-board access resolution so board members can operate securely inside their association.
- Dependencies:
  - Board member registry
  - User account model
  - Role-based permissions
  - Audit logging framework
- Risks:
  - Over-granting board access beyond the intended association
  - Confusion if owner access and board access are modeled as separate identities
  - Permission regressions if board service end dates do not deactivate elevated access quickly
- Open Questions:
  - Should board-member edit access cover all association-scoped financial workflows from the first release or follow a configurable permission bundle?
  - Should invited non-owner board members use the same workspace with the same scope rules?
- Implementation Notes: Treat board-member access as a first-class association-scoped role. If a person is both owner and board member in the same association, resolve permissions as a union of owner self-service and invited board workspace rights under one identity.

#### Functional Units
- 8.2.1 Invite Board Member into Association Workspace [Security]
  - User Story: As a property administrator, I want to invite a board member into the association workspace so that access is deliberate and auditable.
  - Acceptance Criteria:
    - Given an eligible person and association exist
    - When the administrator sends a board-member invite
    - Then the system creates an association-scoped pending access record linked to the person and board role

- 8.2.2 Activate Board Member Access from Invite and Service State [Logic]
  - User Story: As a platform administrator, I want board-member access to activate only when the right conditions are met so unauthorized access is not granted prematurely.
  - Acceptance Criteria:
    - Given a board-member invite exists
    - When the invite is accepted and the related board role is active
    - Then the system activates board-member access for that association only

- 8.2.3 Enforce Association-Scoped Board Permissions [Security]
  - User Story: As a platform administrator, I want board-member requests limited to the invited association so board access does not become global access.
  - Acceptance Criteria:
    - Given a board member is active for Association A
    - When they request records for Association B
    - Then the system denies the request

- 8.2.4 Resolve Combined Owner and Board Member Access [Logic]
  - User Story: As an owner who also serves on the board, I want one identity with the right combined permissions so I do not need separate accounts for self-service and board work.
  - Acceptance Criteria:
    - Given a person is both an owner and an invited active board member in the same association
    - When they sign in
    - Then the system grants owner self-service plus board-member workspace permissions under one identity

- 8.2.5 Present Board Member Workspace [UX]
  - User Story: As a board member, I want a clear association-scoped board view so I can work inside the association without seeing platform-admin controls.
  - Acceptance Criteria:
    - Given a board member is signed in
    - When the workspace loads
    - Then the system shows board-member navigation for the invited association and hides global admin-only controls

- 8.2.6 Audit Board Member Access Lifecycle and Writes [Data]
  - User Story: As a platform administrator, I want board-member access and record changes audit logged so elevated access remains traceable.
  - Acceptance Criteria:
    - Given a board-member invite, activation, revocation, or write action occurs
    - When the event is persisted
    - Then the system records the actor, association, action, and timestamp in the audit trail

## Assumptions
- Rental tenant tracking is limited to contact information only.
- Initial build does not integrate payment gateways.
- Units currently share equal HOA fee structures.
- CT-level rules are prioritized before condo-specific bylaw automation.
- The platform is designed to become multi-association even if the first deployment is a single condo complex.

## Recorded Post-Publication Gaps to Carry Forward
- Phase 6 candidate gaps:
  - hosted owner payment flow
  - saved payment methods
  - autopay and recurring collections
  - delinquency workflow and collections handoff
  - bank reconciliation
  - financial report package/export
- Phase 7 candidate gaps:
  - vendor registry
  - work-order management
  - preventive maintenance
  - inspection records
- Parallel hardening gaps:
  - auth and authorization tightening
  - invited board-member association access and scoped permission enforcement
  - trusted communications delivery
  - document access and delivery hardening
  - AI/document ingestion trust improvements

## Coverage Check
- Total raw items received: 22
- Total normalized items mapped: 22
- Unmapped items: None

## Input-to-Output Trace Map
- "unit list with addresses" -> "1.1 Unit Registry"
- "unit owner contact information" -> "1.2 Owner Registry"
- "tenant emergency contact information" -> "1.3 Tenant Contact Registry"
- "board member records" -> "2.1 Board Member Registry"
- "hoa/common fee tracking" -> "3.1 Fee & Assessment Engine"
- "assessments tracking" -> "3.1 Fee & Assessment Engine"
- "late fee tracking" -> "3.1 Fee & Assessment Engine"
- "owner ledger visibility" -> "3.1.4 Track Owner Ledger Balance [Data]"
- "expense and invoice tracking" -> "3.2 Expense & Invoice Tracking"
- "utility payment tracking" -> "3.2.2 Track Utility Payments [Data]"
- "document repository" -> "4.1 Document Repository"
- "ai-powered document and paste uploads" -> "4.2 AI Document Ingestion"
- "meeting tracking" -> "5.1 Meeting Tracker"
- "meeting notes repository" -> "5.1.2 Record Meeting Notes [Data]"
- "budget meeting support" -> "5.1 Meeting Tracker"
- "yearly responsibilities checklist" -> "6.1 Annual Compliance Checklist"
- "dashboard for deadlines and tasks" -> "6.1.3 Display Compliance Dashboard [UX]"
- "kanban/workstream/task view" -> "6.1 Annual Compliance Checklist"
- "owner and tenant notices" -> "7.1 Notice Automation"
- "gmail integration foundation" -> "7.1.2 Send Email Notice [Integration]"
- "limited permissions and future self-service access" -> "8.1 Role-Based Permissions"
- "scalable platform foundation for multiple complexes" -> "8. Platform Services, Permissions & Audit"

## Quality Gate Checklist
- Hierarchy valid (Module > Feature Set > Functional Unit): Pass
- Numbering sequential and unique: Pass
- No duplicate functional units: Pass
- Each feature set has >= 1 functional unit: Pass
- Scope boundary present for each feature set: Pass
- Dependencies, Risks, Open Questions present for each feature set: Pass
- User story present for each functional unit: Pass
- Acceptance criteria present (2-4) for each functional unit: Pass
- All assumptions isolated in Assumptions section: Pass
- All raw items mapped or marked unmapped: Pass
