# Property Operations Launch Checklist

## Purpose

Prepare the vendor, work-order, inspection, and preventive-maintenance features for live association use with a consistent operator rollout checklist, training outline, and acceptance verification set.

## Rollout Checklist

### 1. Data Readiness
- Confirm each launch association has:
  - at least one active unit
  - vendor registry seeded for core trades
  - support email configured for maintenance workflows
  - at least one admin or manager with operations access
- Verify legacy vendor names used in invoices have corresponding vendor records where operational reporting is required.
- Verify any seed preventive-maintenance templates have valid due dates, responsible parties, and locations.

### 2. Permissions and Access
- Confirm `platform-admin`, `board-admin`, and `manager` roles can access:
  - vendors
  - work orders
  - inspections
  - maintenance schedules
  - operations dashboard
- Confirm `viewer` can access read-only operational views without create/update controls.
- Confirm portal users can:
  - submit maintenance requests
  - review their request history
  - receive request/work-order lifecycle notices

### 3. Workflow Validation
- Create a vendor and attach at least one compliance document.
- Create a work order directly.
- Convert a maintenance request into a work order.
- Create an inspection with at least one finding.
- Convert an inspection finding into a work order.
- Create a preventive-maintenance template.
- Generate schedule instances from the template.
- Convert a due maintenance instance into a work order.
- Confirm operations dashboard metrics update after each workflow.

### 4. Reporting Validation
- Export vendor report CSV.
- Export work-order report CSV.
- Export maintenance report CSV.
- Confirm files download successfully and contain association-scoped records only.

### 5. Audit and Traceability
- Confirm audit logs exist for:
  - vendor create/update
  - work-order create/update
  - inspection create/update
  - inspection finding conversion
  - maintenance schedule template create/update
  - maintenance instance generation and conversion
- Confirm audit entries capture actor, timestamp, entity type, and before/after context where applicable.

## Operator Training Outline

### Training Module 1: Vendor Operations
- Create and update vendor records
- Upload compliance and insurance documents
- Review renewal-risk vendors

### Training Module 2: Work-Order Operations
- Create direct work orders
- Convert maintenance requests
- Assign vendors and update lifecycle status
- Link invoice and cost details

### Training Module 3: Inspections
- Record inspection events
- Add findings with severity and photo references
- Convert findings into work orders

### Training Module 4: Preventive Maintenance
- Create recurring templates
- Generate instances
- Review due and overdue maintenance
- Convert scheduled work into active work orders

### Training Module 5: Operations Oversight
- Review operations dashboard
- Export reports for board and management review
- Use audit logs for operational traceability

## Acceptance Verification

### Scenario 1: Reactive Issue Flow
- Given a maintenance request is submitted
- When an admin converts it into a work order
- Then the work order is created, the request state advances, and the event is visible in audit history

### Scenario 2: Inspection Follow-Up Flow
- Given an inspection contains an open finding
- When an admin converts the finding into a work order
- Then the work order is created and the finding stores the linked work-order id

### Scenario 3: Preventive Maintenance Flow
- Given an active maintenance schedule template exists
- When instances are generated
- Then scheduled or due maintenance instances are created with the correct due dates

### Scenario 4: Scheduled Work Conversion
- Given a due maintenance instance exists
- When an admin converts it into a work order
- Then the instance is marked converted and the work order is linked back

### Scenario 5: Reporting Flow
- Given operational data exists
- When an operator exports vendor, work-order, or maintenance reports
- Then the generated CSV reflects the current association-scoped data set

## Launch Exit Criteria
- Core operator workflows pass without manual database intervention
- Exports download successfully
- Audit entries are present for all critical operations workflows
- At least one association has completed live acceptance verification
- Operators have completed the training outline above
