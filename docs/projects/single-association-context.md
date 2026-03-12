# Single-Association Context Project

## Goal
Scope all non-overview property management modules to one selected association (HOA) at a time.

## Plan
1. Add a global active-association selector in the app shell (top-right) with persisted state.
2. Apply association scoping automatically to non-admin, non-overview API GET requests.
3. Update backend list endpoints and storage queries to filter by `associationId`.
4. Keep overview/admin-global modules unscoped:
   - Dashboard overview
   - Associations registry
   - Admin roadmap
   - Admin users
5. Validate with typecheck and production build.

## Implementation Notes
- Active association is stored in `localStorage` as `activeAssociationId`.
- Requests to scoped endpoints append `?associationId=<id>` automatically when available.
- People are scoped by association-linked relationships (units/ownerships/occupancies/board roles/owner ledger).

## Acceptance Criteria
- Selecting an HOA updates module data across non-overview pages.
- Refresh preserves selected HOA.
- Scoped endpoints return only the selected HOA’s records.
- Dashboard remains an all-associations overview.
