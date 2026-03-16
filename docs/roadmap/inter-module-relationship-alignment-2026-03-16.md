# Inter-Module Relationship Alignment Review (2026-03-16)

## Scope Reviewed
- Residential ownership and occupancy workflows
- Governance meetings and resolution workflows
- Compliance rule extraction workflows
- Communications and finance workflow boundaries

## Findings
- Occupancy had remained exposed as a standalone module despite unit-scoped modeling goals.
- Governance meetings and resolutions were queried without strict active-association scoping in the page layer.
- Compliance rule extraction could return zero when approved clause records were absent.
- Payment method registry ownership was mixed into communications instead of finance.

## Alignment Decisions Implemented
- Occupancy navigation was removed from primary app navigation and routing now redirects `/app/occupancy` to `/app/units`.
- Governance meeting/resolution/person datasets in the meetings workspace are scoped to the active association.
- Compliance extraction now supports a template-based fallback source when approved clauses are missing.
- Payment method registry ownership is in finance; communications now links operators to finance for payment method setup.
- Residential relationship syncing now updates association memberships when ownership/occupancy records are created, updated, ended, or removed.

## Validation Signals Added
- `GET /api/associations/:id/overview` now returns `x-association-overview-duration-ms` for lightweight latency verification.
- Governance compliance extraction responses now include source mode (`approved-clauses` or `template-fallback`) for operational traceability.

## Remaining Follow-up
- Continue reducing communications surface complexity after section workspace split.
- Evaluate whether the standalone occupancy page file should be retired after route deprecation stabilization.
