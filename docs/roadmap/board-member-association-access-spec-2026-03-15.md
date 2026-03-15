# Board Member Association Access Spec - 2026-03-15

## Objective
Define a board member view for invited individuals and ensure that when an owner is also an active board member, that person receives association-scoped viewing and editing permissions for the association they serve.

## Problem Statement
The current product distinguishes internal admin access from owner portal access, but it does not define a first-class access model for invited board members. That leaves an important gap:
- board service can be recorded
- owner portal access can be granted
- but an owner who is also a board member does not have a documented or enforceable path to association-scoped board operating access

## Product Decision
Board member access is a distinct association-scoped operating role, not a generic owner portal role and not a global admin promotion.

When a person is both:
- an invited board member for an association, and
- an owner in that same association,

their effective permissions are the union of:
- owner self-service permissions for their own records and unit-linked experience, and
- board-member workspace permissions for the invited association.

This access must stop at the association boundary. It must not create platform-wide admin authority.

## Goals
- Allow invited board members to sign in and operate in a board-oriented association view.
- Give owner-board members viewing and editing permissions for the association they serve.
- Preserve least-privilege boundaries so board members cannot administer other associations or platform-global settings.
- Make board-member access lifecycle-driven, auditable, and reversible.

## Non-Goals
- Replace internal platform admin roles.
- Introduce cross-association portfolio access for board members.
- Grant board members platform configuration access, user administration, or roadmap administration.
- Redesign full owner self-service beyond what is needed to support owner-plus-board access.

## Primary Users
- Property administrator inviting a board member
- Active board member operating on behalf of one association
- Owner who is also an active board member for that same association

## Access Model Requirements

### 1. Identity and Eligibility
- A board member invite must attach to a single `person` and a single `association`.
- If the invited person already exists as an owner in that association, the system must reuse that identity rather than create a duplicate user/person record.
- Board-member access becomes active only when:
  - the invite is accepted, and
  - the linked board role is active for the association.
- If board service ends or the invite is revoked, board-member permissions must be removed while any valid owner self-service access remains intact.

### 2. Effective Permissions
- Board members must have view and edit permissions for association-scoped records in the association they serve.
- Minimum in-scope areas:
  - association profile and operating context for the invited association
  - units, persons, owners, occupancy, and board roles for that association
  - documents, meetings, communications, compliance tasks, and other governance records for that association
  - financial and operational records for that association when those records are already available to internal association operators
- Explicit out-of-scope areas:
  - platform controls
  - admin user management
  - roadmap administration
  - portfolio-wide dashboards outside their association
  - records for any other association
- If the same person is both owner and board member, board permissions expand access only within the invited association. Owner-only surfaces and board-member surfaces should coexist under one signed-in identity.

### 3. Invitation and Lifecycle
- Admin must be able to invite a board member from the board/governance workflow.
- Invite states must include at least:
  - invited
  - active
  - expired
  - revoked
  - suspended
- The invite must capture:
  - association
  - person
  - email
  - linked board role
  - inviter
  - sent timestamp
  - accepted timestamp
  - revoked or expired timestamp
- Re-inviting the same person for the same association must update or replace the pending access record rather than create conflicting active roles.

### 4. Board Member View / Workspace
- Invited board members must have a board-member landing experience for the association they serve.
- The UI must clearly show the active association and the fact that the user is acting with board-member permissions.
- For owner-board members, the product must support one identity with combined access, not separate disconnected logins.
- Board-member navigation must include all association-scoped areas they are allowed to view or edit.
- The product must not expose global admin navigation items to board members.

### 5. Security and Audit
- All invite, activation, revocation, suspension, and permission-scope changes must be audit logged.
- All board-member write actions must be attributable to the acting person and association.
- Permission checks must evaluate both:
  - role type
  - association scope
- API endpoints must reject board-member requests that target a different association than the invited scope.

## Recommended Data Model Direction
- Add a first-class board-capable access role rather than overloading `owner`, `tenant`, or `readonly`.
- Model association-scoped board access separately from platform-global admin roles.
- Required fields for the access grant:
  - `associationId`
  - `personId`
  - `email`
  - `role = board-member`
  - `status`
  - `boardRoleId`
  - `invitedBy`
  - `invitedAt`
  - `acceptedAt`
  - `revokedAt`
  - `suspendedAt`
- Effective-permission resolution should combine:
  - base access role
  - association scope
  - active board service state
  - owner relationship state where applicable

## Permission Matrix
| Capability Area | Owner | Board Member | Owner + Board Member |
| --- | --- | --- | --- |
| Own portal documents and notices | Yes | Optional if relevant | Yes |
| View association-scoped governance records | Limited/No | Yes | Yes |
| Edit association-scoped governance records | No | Yes | Yes |
| View association-scoped registry records | No | Yes | Yes |
| Edit association-scoped registry records | No | Yes | Yes |
| View association-scoped financial and operations records | No | Yes | Yes |
| Edit association-scoped financial and operations records | No | Yes | Yes |
| Access platform controls / admin users / roadmap | No | No | No |
| Access other associations | No | No | No |

## Acceptance Criteria
- Given an admin invites a person as a board member for Association A, when that person accepts, then the system activates board-member access only for Association A.
- Given the invited person is also an owner in Association A, when they sign in, then they can access both owner self-service and board-member workspace capabilities under one identity.
- Given that same user attempts to open records for Association B, when they are not scoped to Association B, then the system denies access.
- Given a board member invite is revoked or the board term ends, when the user signs in again, then board-member editing access is removed while valid owner self-service access remains.
- Given a board member edits an association-scoped record, when the change is saved, then the audit log records the actor, association, time, and action.

## Delivery Recommendation
Implement this as a dedicated association-scoped access layer. Do not satisfy the request by promoting board members into full admin users or by stretching the current owner portal role set beyond its intended purpose.

## Roadmap Placement
Place this work as a board-access foundation initiative ahead of broader board automation and owner-experience expansion because later board reporting and board-facing workflows depend on a clean invited board-member access model.
