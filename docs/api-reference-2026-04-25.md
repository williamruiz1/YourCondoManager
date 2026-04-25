# YCM API Reference — 2026-04-25
**Generated as part of Wave 20 docs backfill.**
**Source:** `server/routes.ts` (16,215 LoC monolith) plus `server/routes/{amenities,autopay,payment-portal}.ts`.
**Total endpoints:** 588 (across 9 functional zones).
**Format:** hand-curated markdown. OpenAPI/Swagger generation deferred — see "Future work" at bottom.

---

## How to read this document

- **Auth column** is the gate that wraps the handler; sub-role enforcement (e.g. `requireAdminRole(["platform-admin"])`) is summarised as "Admin (role-gated)" — consult the route definition for the exact list. The `RouteGuard` (ADR 0b) governs client-side persona gating; this doc covers the server gate only.
- **Purpose column** is auto-generated from the URL shape and verb (List/Read/Create/Update/Delete). It is a heuristic — read the handler for exact behavior.
- **Zones** roughly mirror the 1.1 zone taxonomy (Home/Financials/Operations/Governance/Communications/Platform), plus Portal (owner-portal-only), Public (anonymous), Portfolio Registry (associations/units/persons), and Alerts (4.1 engine).
- All paths are mounted at the Express app root (`server/index.ts` → `registerRoutes(app)`).
- "Portfolio Registry" overlaps Operations in user-facing terms — they are surfaced in `/app/operations/*` and the portfolio dashboard, but the registry endpoints (`/api/associations`, `/api/units`, `/api/persons`) are lifted into their own group here for findability.

---

## Endpoint Inventory by Zone

**Total:** 588 endpoints across 9 zones.

### Portal (96 endpoints)

_Owner Portal — `requirePortal` session gate, `owner` persona only (post 2.2 Q1 collapse). Mounted under `/api/portal/*`._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/portal/access` | Admin | List/read `portal/access` |
| POST | `/api/portal/access` | Admin | Create or action `portal/access` |
| PATCH | `/api/portal/access/:id` | Admin | Update `portal/access/{id}` |
| GET | `/api/portal/amenities` | Portal session | List/read `portal/amenities` |
| GET | `/api/portal/amenities/:id/availability` | Portal session | Read `portal/amenities/{id}/availability` |
| POST | `/api/portal/amenities/:id/reservations` | Portal session | Create or action `portal/amenities/{id}/reservations` |
| GET | `/api/portal/amenities/my-reservations` | Portal session | List/read `portal/amenities/my-reservations` |
| GET | `/api/portal/amenities/settings` | Portal session | List/read `portal/amenities/settings` |
| DELETE | `/api/portal/amenity-reservations/:id` | Portal session | Delete `portal/amenity-reservations/{id}` |
| GET | `/api/portal/announcements` | Portal session | List/read `portal/announcements` |
| GET | `/api/portal/assessments/:assessmentId/detail` | Portal session | Read `portal/assessments/{id}/detail` |
| GET | `/api/portal/association` | Portal session | List/read `portal/association` |
| POST | `/api/portal/autopay/enroll` | Portal session | Create or action `portal/autopay/enroll` |
| GET | `/api/portal/autopay/enrollments` | Portal session | List/read `portal/autopay/enrollments` |
| PATCH | `/api/portal/autopay/enrollments/:id` | Portal session | Update `portal/autopay/enrollments/{id}` |
| GET | `/api/portal/autopay/enrollments/:id/runs` | Portal session | Read `portal/autopay/enrollments/{id}/runs` |
| GET | `/api/portal/balance-summary` | Portal session | List/read `portal/balance-summary` |
| GET | `/api/portal/board/association` | Portal session | List/read `portal/board/association` |
| PATCH | `/api/portal/board/association` | Portal session | Update `portal/board/association` |
| GET | `/api/portal/board/communications/history` | Portal session | List/read `portal/board/communications/history` |
| POST | `/api/portal/board/communications/send` | Portal session | Create or action `portal/board/communications/send` |
| GET | `/api/portal/board/communications/sends` | Portal session | List/read `portal/board/communications/sends` |
| GET | `/api/portal/board/dashboard` | Portal session | List/read `portal/board/dashboard` |
| GET | `/api/portal/board/documents` | Portal session | List/read `portal/board/documents` |
| POST | `/api/portal/board/documents` | Portal session | Create or action `portal/board/documents` |
| PATCH | `/api/portal/board/documents/:id` | Portal session | Update `portal/board/documents/{id}` |
| GET | `/api/portal/board/governance-tasks` | Portal session | List/read `portal/board/governance-tasks` |
| POST | `/api/portal/board/governance-tasks` | Portal session | Create or action `portal/board/governance-tasks` |
| PATCH | `/api/portal/board/governance-tasks/:id` | Portal session | Update `portal/board/governance-tasks/{id}` |
| PATCH | `/api/portal/board/maintenance-requests/:id` | Portal session | Update `portal/board/maintenance-requests/{id}` |
| GET | `/api/portal/board/meetings` | Portal session | List/read `portal/board/meetings` |
| POST | `/api/portal/board/meetings` | Portal session | Create or action `portal/board/meetings` |
| PATCH | `/api/portal/board/meetings/:id` | Portal session | Update `portal/board/meetings/{id}` |
| GET | `/api/portal/board/overview` | Portal session | List/read `portal/board/overview` |
| GET | `/api/portal/board/owner-ledger/entries` | Portal session | List/read `portal/board/owner-ledger/entries` |
| POST | `/api/portal/board/owner-ledger/entries` | Portal session | Create or action `portal/board/owner-ledger/entries` |
| GET | `/api/portal/board/owner-ledger/summary` | Portal session | List/read `portal/board/owner-ledger/summary` |
| GET | `/api/portal/board/persons` | Portal session | List/read `portal/board/persons` |
| PATCH | `/api/portal/board/persons/:id` | Portal session | Update `portal/board/persons/{id}` |
| GET | `/api/portal/board/roles` | Portal session | List/read `portal/board/roles` |
| POST | `/api/portal/board/roles` | Portal session | Create or action `portal/board/roles` |
| GET | `/api/portal/board/units` | Portal session | List/read `portal/board/units` |
| PATCH | `/api/portal/board/units/:id` | Portal session | Update `portal/board/units/{id}` |
| GET | `/api/portal/board/vendor-invoices` | Portal session | List/read `portal/board/vendor-invoices` |
| POST | `/api/portal/board/vendor-invoices` | Portal session | Create or action `portal/board/vendor-invoices` |
| PATCH | `/api/portal/board/vendor-invoices/:id` | Portal session | Update `portal/board/vendor-invoices/{id}` |
| GET | `/api/portal/communications` | Portal session | List/read `portal/communications` |
| GET | `/api/portal/contact-updates` | Portal session | List/read `portal/contact-updates` |
| POST | `/api/portal/contact-updates` | Portal session | Create or action `portal/contact-updates` |
| PATCH | `/api/portal/contact-updates/:id/review` | Admin | Update `portal/contact-updates/{id}/review` |
| GET | `/api/portal/contact-updates/admin` | Admin | List/read `portal/contact-updates/admin` |
| GET | `/api/portal/documents` | Portal session | List/read `portal/documents` |
| GET | `/api/portal/elections` | Portal session | List/read `portal/elections` |
| GET | `/api/portal/elections/:id/detail` | Portal session | Read `portal/elections/{id}/detail` |
| POST | `/api/portal/elections/:id/nominate` | Portal session | Create or action `portal/elections/{id}/nominate` |
| GET | `/api/portal/elections/:id/nominations` | Portal session | Read `portal/elections/{id}/nominations` |
| POST | `/api/portal/elections/:id/proxy` | Portal session | Create or action `portal/elections/{id}/proxy` |
| GET | `/api/portal/elections/:id/proxy-candidates` | Portal session | Read `portal/elections/{id}/proxy-candidates` |
| GET | `/api/portal/elections/active` | Portal session | List/read `portal/elections/active` |
| GET | `/api/portal/elections/archive` | Portal session | List/read `portal/elections/archive` |
| GET | `/api/portal/elections/board-certified` | Portal session | List/read `portal/elections/board-certified` |
| GET | `/api/portal/elections/board-pending` | Portal session | List/read `portal/elections/board-pending` |
| POST | `/api/portal/elections/proxy/:designationId/revoke` | Portal session | Create or action `portal/elections/proxy/{id}/revoke` |
| POST | `/api/portal/feedback` | Portal session | Create or action `portal/feedback` |
| GET | `/api/portal/financial-dashboard` | Portal session | List/read `portal/financial-dashboard` |
| GET | `/api/portal/ledger` | Portal session | List/read `portal/ledger` |
| POST | `/api/portal/maintenance-attachments` | Portal session | Create or action `portal/maintenance-attachments` |
| GET | `/api/portal/maintenance-requests` | Portal session | List/read `portal/maintenance-requests` |
| POST | `/api/portal/maintenance-requests` | Portal session | Create or action `portal/maintenance-requests` |
| GET | `/api/portal/me` | Portal session | List/read `portal/me` |
| PATCH | `/api/portal/me` | Portal session | Update `portal/me` |
| PATCH | `/api/portal/me/sms-opt-in` | Portal session | Update `portal/me/sms-opt-in` |
| GET | `/api/portal/memberships` | Admin | List/read `portal/memberships` |
| POST | `/api/portal/memberships` | Admin | Create or action `portal/memberships` |
| GET | `/api/portal/my-associations` | Portal session | List/read `portal/my-associations` |
| GET | `/api/portal/my-units` | Portal session | List/read `portal/my-units` |
| GET | `/api/portal/notices` | Portal session | List/read `portal/notices` |
| POST | `/api/portal/occupancy` | Portal session | Create or action `portal/occupancy` |
| POST | `/api/portal/pay` | Portal session | Create or action `portal/pay` |
| POST | `/api/portal/payment` | Portal session | Create or action `portal/payment` |
| GET | `/api/portal/payment-methods` | Portal session | List/read `portal/payment-methods` |
| POST | `/api/portal/payment-methods` | Portal session | Create or action `portal/payment-methods` |
| DELETE | `/api/portal/payment-methods/:id` | Portal session | Delete `portal/payment-methods/{id}` |
| PATCH | `/api/portal/payment-methods/:id` | Portal session | Update `portal/payment-methods/{id}` |
| POST | `/api/portal/payment-methods/setup` | Portal session | Create or action `portal/payment-methods/setup` |
| GET | `/api/portal/payment-methods/setup/return` | Portal session | List/read `portal/payment-methods/setup/return` |
| GET | `/api/portal/payment-transactions` | Portal session | List/read `portal/payment-transactions` |
| GET | `/api/portal/payment-transactions/:id` | Portal session | Read `portal/payment-transactions/{id}` |
| GET | `/api/portal/payments/link/:token` | Public | Read `portal/payments/link/{id}` |
| POST | `/api/portal/payments/link/:token/checkout-session` | Public | Create or action `portal/payments/link/{id}/checkout-session` |
| POST | `/api/portal/push/subscribe` | Portal session | Create or action `portal/push/subscribe` |
| POST | `/api/portal/push/unsubscribe` | Portal session | Create or action `portal/push/unsubscribe` |
| GET | `/api/portal/push/vapid-public-key` | Public | List/read `portal/push/vapid-public-key` |
| POST | `/api/portal/request-login` | Public | Create or action `portal/request-login` |
| GET | `/api/portal/units-balance` | Portal session | List/read `portal/units-balance` |
| POST | `/api/portal/verify-login` | Public | Create or action `portal/verify-login` |

### Public (5 endpoints)

_Anonymous endpoints — payment-link landing pages, auto-populated community pages, signup/checkout. No auth._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/public/demo-request` | Public | Create or action `public/demo-request` |
| GET | `/api/public/onboarding/invite/:token` | Public | Read `public/onboarding/invite/{id}` |
| POST | `/api/public/onboarding/invite/:token/submit` | Public | Create or action `public/onboarding/invite/{id}/submit` |
| GET | `/api/public/signup/complete` | Public | List/read `public/signup/complete` |
| POST | `/api/public/signup/start` | Public | Create or action `public/signup/start` |

### Financials (105 endpoints)

_Recurring + special assessments, ledgers, payment runs, autopay, late fees, checks, delinquency. Operator-side only (Manager/Board Officer/Assisted Board/PM Assistant/Platform Admin)._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/financial/accounts` | Admin | List/read `financial/accounts` |
| POST | `/api/financial/accounts` | Admin | Create or action `financial/accounts` |
| PATCH | `/api/financial/accounts/:id` | Admin | Update `financial/accounts/{id}` |
| GET | `/api/financial/accounts/activity` | Admin | List/read `financial/accounts/activity` |
| GET | `/api/financial/alerts` | Admin | List/read `financial/alerts` |
| PATCH | `/api/financial/alerts/:id/dismiss` | Admin | Update `financial/alerts/{id}/dismiss` |
| POST | `/api/financial/alerts/generate` | Admin | Create or action `financial/alerts/generate` |
| GET | `/api/financial/approvals` | Admin | List/read `financial/approvals` |
| POST | `/api/financial/approvals` | Admin | Create or action `financial/approvals` |
| PATCH | `/api/financial/approvals/:id` | Admin | Update `financial/approvals/{id}` |
| GET | `/api/financial/assessment-run-log` | Admin | List/read `financial/assessment-run-log` |
| GET | `/api/financial/assessments` | Admin | List/read `financial/assessments` |
| POST | `/api/financial/assessments` | Admin | Create or action `financial/assessments` |
| PATCH | `/api/financial/assessments/:id` | Admin | Update `financial/assessments/{id}` |
| GET | `/api/financial/autopay/enrollments` | Admin | List/read `financial/autopay/enrollments` |
| POST | `/api/financial/autopay/enrollments` | Admin | Create or action `financial/autopay/enrollments` |
| PATCH | `/api/financial/autopay/enrollments/:id` | Admin | Update `financial/autopay/enrollments/{id}` |
| GET | `/api/financial/autopay/enrollments/:id/runs` | Admin | Read `financial/autopay/enrollments/{id}/runs` |
| POST | `/api/financial/autopay/run` | Admin | Create or action `financial/autopay/run` |
| GET | `/api/financial/autopay/runs` | Admin | List/read `financial/autopay/runs` |
| POST | `/api/financial/budget-lines` | Admin | Create or action `financial/budget-lines` |
| PATCH | `/api/financial/budget-lines/:id` | Admin | Update `financial/budget-lines/{id}` |
| POST | `/api/financial/budget-versions` | Admin | Create or action `financial/budget-versions` |
| GET | `/api/financial/budget-versions/:budgetVersionId/lines` | Admin | Read `financial/budget-versions/{id}/lines` |
| PATCH | `/api/financial/budget-versions/:id` | Admin | Update `financial/budget-versions/{id}` |
| GET | `/api/financial/budgets` | Admin | List/read `financial/budgets` |
| POST | `/api/financial/budgets` | Admin | Create or action `financial/budgets` |
| GET | `/api/financial/budgets/:associationId/variance/:budgetVersionId` | Admin | Read `financial/budgets/{id}/variance/{id}` |
| GET | `/api/financial/budgets/:budgetId/versions` | Admin | Read `financial/budgets/{id}/versions` |
| PATCH | `/api/financial/budgets/:id` | Admin | Update `financial/budgets/{id}` |
| GET | `/api/financial/categories` | Admin | List/read `financial/categories` |
| POST | `/api/financial/categories` | Admin | Create or action `financial/categories` |
| PATCH | `/api/financial/categories/:id` | Admin | Update `financial/categories/{id}` |
| GET | `/api/financial/collections-aging` | Admin | List/read `financial/collections-aging` |
| GET | `/api/financial/collections-handoffs` | Admin | List/read `financial/collections-handoffs` |
| POST | `/api/financial/collections-handoffs` | Admin | Create or action `financial/collections-handoffs` |
| PATCH | `/api/financial/collections-handoffs/:id` | Admin | Update `financial/collections-handoffs/{id}` |
| GET | `/api/financial/delinquency-escalations` | Admin | List/read `financial/delinquency-escalations` |
| PATCH | `/api/financial/delinquency-escalations/:id` | Admin | Update `financial/delinquency-escalations/{id}` |
| POST | `/api/financial/delinquency-escalations/run` | Admin | Create or action `financial/delinquency-escalations/run` |
| GET | `/api/financial/delinquency-notices` | Admin | List/read `financial/delinquency-notices` |
| POST | `/api/financial/delinquency-notices/generate` | Admin | Create or action `financial/delinquency-notices/generate` |
| GET | `/api/financial/delinquency-settings` | Admin | List/read `financial/delinquency-settings` |
| POST | `/api/financial/delinquency-settings` | Admin | Create or action `financial/delinquency-settings` |
| GET | `/api/financial/delinquency-thresholds` | Admin | List/read `financial/delinquency-thresholds` |
| POST | `/api/financial/delinquency-thresholds` | Admin | Create or action `financial/delinquency-thresholds` |
| DELETE | `/api/financial/delinquency-thresholds/:id` | Admin | Delete `financial/delinquency-thresholds/{id}` |
| PATCH | `/api/financial/delinquency-thresholds/:id` | Admin | Update `financial/delinquency-thresholds/{id}` |
| GET | `/api/financial/expense-attachments` | Admin | List/read `financial/expense-attachments` |
| POST | `/api/financial/expense-attachments` | Admin | Create or action `financial/expense-attachments` |
| GET | `/api/financial/fee-schedules` | Admin | List/read `financial/fee-schedules` |
| POST | `/api/financial/fee-schedules` | Admin | Create or action `financial/fee-schedules` |
| PATCH | `/api/financial/fee-schedules/:id` | Admin | Update `financial/fee-schedules/{id}` |
| GET | `/api/financial/invoices` | Admin | List/read `financial/invoices` |
| POST | `/api/financial/invoices` | Admin | Create or action `financial/invoices` |
| PATCH | `/api/financial/invoices/:id` | Admin | Update `financial/invoices/{id}` |
| GET | `/api/financial/late-fee-events` | Admin | List/read `financial/late-fee-events` |
| GET | `/api/financial/late-fee-rules` | Admin | List/read `financial/late-fee-rules` |
| POST | `/api/financial/late-fee-rules` | Admin | Create or action `financial/late-fee-rules` |
| PATCH | `/api/financial/late-fee-rules/:id` | Admin | Update `financial/late-fee-rules/{id}` |
| POST | `/api/financial/late-fees/calculate` | Admin | Create or action `financial/late-fees/calculate` |
| GET | `/api/financial/owner-ledger/entries` | Admin | List/read `financial/owner-ledger/entries` |
| POST | `/api/financial/owner-ledger/entries` | Admin | Create or action `financial/owner-ledger/entries` |
| POST | `/api/financial/owner-ledger/import` | Admin | Create or action `financial/owner-ledger/import` |
| GET | `/api/financial/owner-ledger/summary/:associationId` | Admin | Read `financial/owner-ledger/summary/{id}` |
| POST | `/api/financial/owner-payment-links` | Admin | Create or action `financial/owner-payment-links` |
| GET | `/api/financial/partial-payment-rules` | Admin | List/read `financial/partial-payment-rules` |
| PUT | `/api/financial/partial-payment-rules` | Admin | Replace `financial/partial-payment-rules` |
| GET | `/api/financial/payment-activity` | Admin | List/read `financial/payment-activity` |
| GET | `/api/financial/payment-exceptions` | Admin | List/read `financial/payment-exceptions` |
| GET | `/api/financial/payment-gateway/connections` | Admin | List/read `financial/payment-gateway/connections` |
| POST | `/api/financial/payment-gateway/validate` | Admin | Create or action `financial/payment-gateway/validate` |
| POST | `/api/financial/payment-instructions/send` | Admin | Create or action `financial/payment-instructions/send` |
| GET | `/api/financial/payment-methods` | Admin | List/read `financial/payment-methods` |
| POST | `/api/financial/payment-methods` | Admin | Create or action `financial/payment-methods` |
| PATCH | `/api/financial/payment-methods/:id` | Admin | Update `financial/payment-methods/{id}` |
| GET | `/api/financial/payment-plans` | Admin | List/read `financial/payment-plans` |
| POST | `/api/financial/payment-plans` | Admin | Create or action `financial/payment-plans` |
| PATCH | `/api/financial/payment-plans/:id` | Admin | Update `financial/payment-plans/{id}` |
| POST | `/api/financial/reconciliation/auto-match` | Admin | Create or action `financial/reconciliation/auto-match` |
| GET | `/api/financial/reconciliation/imports` | Admin | List/read `financial/reconciliation/imports` |
| POST | `/api/financial/reconciliation/imports` | Admin | Create or action `financial/reconciliation/imports` |
| GET | `/api/financial/reconciliation/periods` | Admin | List/read `financial/reconciliation/periods` |
| POST | `/api/financial/reconciliation/periods` | Admin | Create or action `financial/reconciliation/periods` |
| PATCH | `/api/financial/reconciliation/periods/:id` | Admin | Update `financial/reconciliation/periods/{id}` |
| GET | `/api/financial/reconciliation/transactions` | Admin | List/read `financial/reconciliation/transactions` |
| PATCH | `/api/financial/reconciliation/transactions/:id/match` | Admin | Update `financial/reconciliation/transactions/{id}/match` |
| GET | `/api/financial/recurring-charges/runs` | Admin | List/read `financial/recurring-charges/runs` |
| POST | `/api/financial/recurring-charges/runs/:id/retry` | Admin | Create or action `financial/recurring-charges/runs/{id}/retry` |
| GET | `/api/financial/recurring-charges/schedules` | Admin | List/read `financial/recurring-charges/schedules` |
| POST | `/api/financial/recurring-charges/schedules` | Admin | Create or action `financial/recurring-charges/schedules` |
| PATCH | `/api/financial/recurring-charges/schedules/:id` | Admin | Update `financial/recurring-charges/schedules/{id}` |
| GET | `/api/financial/reminder-rules` | Admin | List/read `financial/reminder-rules` |
| POST | `/api/financial/reminder-rules` | Admin | Create or action `financial/reminder-rules` |
| PATCH | `/api/financial/reminder-rules/:id` | Admin | Update `financial/reminder-rules/{id}` |
| POST | `/api/financial/reminder-rules/:id/run` | Admin | Create or action `financial/reminder-rules/{id}/run` |
| GET | `/api/financial/reports/ar-aging` | Admin | List/read `financial/reports/ar-aging` |
| GET | `/api/financial/reports/board-summary` | Admin | List/read `financial/reports/board-summary` |
| GET | `/api/financial/reports/profit-loss` | Admin | List/read `financial/reports/profit-loss` |
| POST | `/api/financial/retries/run` | Admin | Create or action `financial/retries/run` |
| GET | `/api/financial/retry-eligible` | Admin | List/read `financial/retry-eligible` |
| POST | `/api/financial/rules/:ruleId/run` | Admin | Create or action `financial/rules/{id}/run` |
| GET | `/api/financial/utilities` | Admin | List/read `financial/utilities` |
| POST | `/api/financial/utilities` | Admin | Create or action `financial/utilities` |
| PATCH | `/api/financial/utilities/:id` | Admin | Update `financial/utilities/{id}` |

### Operations (51 endpoints)

_Maintenance, work orders, vendors, insurance, inspections, amenities, parcel tracking, service requests._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/amenities` | Admin | List/read `amenities` |
| POST | `/api/amenities` | Admin | Create or action `amenities` |
| DELETE | `/api/amenities/:id` | Admin | Delete `amenities/{id}` |
| PATCH | `/api/amenities/:id` | Admin | Update `amenities/{id}` |
| GET | `/api/amenities/:id/blocks` | Admin | Read `amenities/{id}/blocks` |
| POST | `/api/amenities/:id/blocks` | Admin | Create or action `amenities/{id}/blocks` |
| GET | `/api/amenities/:id/reservations` | Admin | Read `amenities/{id}/reservations` |
| DELETE | `/api/amenity-blocks/:id` | Admin | Delete `amenity-blocks/{id}` |
| PATCH | `/api/amenity-reservations/:id` | Admin | Update `amenity-reservations/{id}` |
| GET | `/api/inspections` | Admin | List/read `inspections` |
| POST | `/api/inspections` | Admin | Create or action `inspections` |
| PATCH | `/api/inspections/:id` | Admin | Update `inspections/{id}` |
| POST | `/api/inspections/:id/findings/:findingIndex/convert-to-work-order` | Admin | Create or action `inspections/{id}/findings/{id}/convert-to-work-order` |
| POST | `/api/maintenance/escalations/run` | Admin | Create or action `maintenance/escalations/run` |
| POST | `/api/maintenance/instances/:id/convert-to-work-order` | Admin | Create or action `maintenance/instances/{id}/convert-to-work-order` |
| GET | `/api/maintenance/requests` | Admin | List/read `maintenance/requests` |
| POST | `/api/maintenance/requests` | Admin | Create or action `maintenance/requests` |
| PATCH | `/api/maintenance/requests/:id` | Admin | Update `maintenance/requests/{id}` |
| POST | `/api/maintenance/requests/:id/convert-to-work-order` | Admin | Create or action `maintenance/requests/{id}/convert-to-work-order` |
| GET | `/api/maintenance/schedules` | Admin | List/read `maintenance/schedules` |
| POST | `/api/maintenance/schedules` | Admin | Create or action `maintenance/schedules` |
| PATCH | `/api/maintenance/schedules/:id` | Admin | Update `maintenance/schedules/{id}` |
| POST | `/api/maintenance/schedules/:id/generate` | Admin | Create or action `maintenance/schedules/{id}/generate` |
| GET | `/api/operations/dashboard` | Admin | List/read `operations/dashboard` |
| GET | `/api/operations/reports/:reportType` | Admin | Read `operations/reports/{id}` |
| GET | `/api/vendor-portal/me` | Public | List/read `vendor-portal/me` |
| POST | `/api/vendor-portal/request-login` | Public | Create or action `vendor-portal/request-login` |
| POST | `/api/vendor-portal/verify-login` | Public | Create or action `vendor-portal/verify-login` |
| GET | `/api/vendor-portal/work-orders` | Public | List/read `vendor-portal/work-orders` |
| GET | `/api/vendor-portal/work-orders/:id` | Public | Read `vendor-portal/work-orders/{id}` |
| PATCH | `/api/vendor-portal/work-orders/:id/estimated-completion` | Public | Update `vendor-portal/work-orders/{id}/estimated-completion` |
| POST | `/api/vendor-portal/work-orders/:id/invoice` | Public | Create or action `vendor-portal/work-orders/{id}/invoice` |
| POST | `/api/vendor-portal/work-orders/:id/notes` | Public | Create or action `vendor-portal/work-orders/{id}/notes` |
| POST | `/api/vendor-portal/work-orders/:id/photos` | Public | Create or action `vendor-portal/work-orders/{id}/photos` |
| PATCH | `/api/vendor-portal/work-orders/:id/status` | Public | Update `vendor-portal/work-orders/{id}/status` |
| GET | `/api/vendors` | Admin | List/read `vendors` |
| POST | `/api/vendors` | Admin | Create or action `vendors` |
| PATCH | `/api/vendors/:id` | Admin | Update `vendors/{id}` |
| GET | `/api/vendors/:id/documents` | Admin | Read `vendors/{id}/documents` |
| POST | `/api/vendors/:id/documents` | Admin | Create or action `vendors/{id}/documents` |
| GET | `/api/vendors/:id/metrics` | Admin | Read `vendors/{id}/metrics` |
| GET | `/api/vendors/:id/portal-credential` | Admin | Read `vendors/{id}/portal-credential` |
| PATCH | `/api/vendors/:id/portal-credential/:credentialId/revoke` | Admin | Update `vendors/{id}/portal-credential/{id}/revoke` |
| POST | `/api/vendors/:id/portal-invite` | Admin | Create or action `vendors/{id}/portal-invite` |
| GET | `/api/vendors/renewal-alerts` | Admin | List/read `vendors/renewal-alerts` |
| GET | `/api/work-orders` | Admin | List/read `work-orders` |
| POST | `/api/work-orders` | Admin | Create or action `work-orders` |
| PATCH | `/api/work-orders/:id` | Admin | Update `work-orders/{id}` |
| DELETE | `/api/work-orders/:id/photos` | Admin | Delete `work-orders/{id}/photos` |
| POST | `/api/work-orders/:id/photos` | Admin | Create or action `work-orders/{id}/photos` |
| GET | `/api/work-orders/:id/vendor-activity` | Admin | Read `work-orders/{id}/vendor-activity` |

### Communications (26 endpoints)

_Notices, announcements, campaigns, inbox, conversations, SMS/email/push delivery, feedback._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/announcements` | Admin | List/read `announcements` |
| POST | `/api/announcements` | Admin | Create or action `announcements` |
| DELETE | `/api/announcements/:id` | Admin | Delete `announcements/{id}` |
| PATCH | `/api/announcements/:id` | Admin | Update `announcements/{id}` |
| GET | `/api/communications/delivery-stats` | Admin | List/read `communications/delivery-stats` |
| GET | `/api/communications/history` | Admin | List/read `communications/history` |
| GET | `/api/communications/push-subscriber-count` | Admin | List/read `communications/push-subscriber-count` |
| GET | `/api/communications/readiness` | Admin | List/read `communications/readiness` |
| GET | `/api/communications/recipients/preview` | Admin | List/read `communications/recipients/preview` |
| POST | `/api/communications/run-scheduled` | Admin | Create or action `communications/run-scheduled` |
| POST | `/api/communications/send` | Admin | Create or action `communications/send` |
| POST | `/api/communications/send-push` | Admin | Create or action `communications/send-push` |
| POST | `/api/communications/send-sms` | Admin | Create or action `communications/send-sms` |
| POST | `/api/communications/send-targeted` | Admin | Create or action `communications/send-targeted` |
| GET | `/api/communications/sends` | Admin | List/read `communications/sends` |
| PATCH | `/api/communications/sends/:id/approval` | Admin | Update `communications/sends/{id}/approval` |
| PATCH | `/api/communications/sends/:id/delivery` | Admin | Update `communications/sends/{id}/delivery` |
| GET | `/api/communications/sms-delivery-logs` | Admin | List/read `communications/sms-delivery-logs` |
| GET | `/api/communications/sms-recipient-count` | Admin | List/read `communications/sms-recipient-count` |
| GET | `/api/communications/templates` | Admin | List/read `communications/templates` |
| POST | `/api/communications/templates` | Admin | Create or action `communications/templates` |
| PATCH | `/api/communications/templates/:id` | Admin | Update `communications/templates/{id}` |
| GET | `/api/feedback` | Admin | List/read `feedback` |
| POST | `/api/feedback` | Admin | Create or action `feedback` |
| PATCH | `/api/feedback/:id` | Admin | Update `feedback/{id}` |
| GET | `/api/feedback/analytics` | Admin | List/read `feedback/analytics` |

### Governance (92 endpoints)

_Elections, voting, meetings, board operations, document repository, hub map issues, resolutions._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/board-roles` | Admin | List/read `board-roles` |
| POST | `/api/board-roles` | Admin | Create or action `board-roles` |
| DELETE | `/api/board-roles/:id` | Admin | Delete `board-roles/{id}` |
| POST | `/api/board-roles/:id/invite-access` | Admin | Create or action `board-roles/{id}/invite-access` |
| GET | `/api/board/dashboard` | Admin | List/read `board/dashboard` |
| GET | `/api/board/overview` | Admin | List/read `board/overview` |
| GET | `/api/documents` | Admin | List/read `documents` |
| POST | `/api/documents` | Admin | Create or action `documents` |
| DELETE | `/api/documents/:id` | Admin | Delete `documents/{id}` |
| PATCH | `/api/documents/:id` | Admin | Update `documents/{id}` |
| GET | `/api/documents/:id/tags` | Admin | Read `documents/{id}/tags` |
| POST | `/api/documents/:id/tags` | Admin | Create or action `documents/{id}/tags` |
| GET | `/api/documents/:id/versions` | Admin | Read `documents/{id}/versions` |
| POST | `/api/documents/:id/versions` | Admin | Create or action `documents/{id}/versions` |
| PATCH | `/api/documents/:id/versions/:versionId/set-current` | Admin | Update `documents/{id}/versions/{id}/set-current` |
| GET | `/api/documents/:id/versions/export` | Admin | Read `documents/{id}/versions/export` |
| GET | `/api/documents/missing-files` | Admin | List/read `documents/missing-files` |
| GET | `/api/elections` | Admin | List/read `elections` |
| POST | `/api/elections` | Admin | Create or action `elections` |
| DELETE | `/api/elections/:id` | Admin | Delete `elections/{id}` |
| GET | `/api/elections/:id` | Admin | Read `elections/{id}` |
| PATCH | `/api/elections/:id` | Admin | Update `elections/{id}` |
| GET | `/api/elections/:id/audit-export` | Admin | Read `elections/{id}/audit-export` |
| GET | `/api/elections/:id/casts` | Admin | Read `elections/{id}/casts` |
| POST | `/api/elections/:id/certify` | Admin | Create or action `elections/{id}/certify` |
| GET | `/api/elections/:id/eligibility-report` | Admin | Read `elections/{id}/eligibility-report` |
| POST | `/api/elections/:id/generate-tokens` | Admin | Create or action `elections/{id}/generate-tokens` |
| GET | `/api/elections/:id/nominations` | Admin | Read `elections/{id}/nominations` |
| POST | `/api/elections/:id/nominations/:optionId/approve` | Admin | Create or action `elections/{id}/nominations/{id}/approve` |
| POST | `/api/elections/:id/nominations/:optionId/reject` | Admin | Create or action `elections/{id}/nominations/{id}/reject` |
| GET | `/api/elections/:id/options` | Admin | Read `elections/{id}/options` |
| POST | `/api/elections/:id/options` | Admin | Create or action `elections/{id}/options` |
| DELETE | `/api/elections/:id/options/:optionId` | Admin | Delete `elections/{id}/options/{id}` |
| GET | `/api/elections/:id/proxies` | Admin | Read `elections/{id}/proxies` |
| POST | `/api/elections/:id/proxies` | Admin | Create or action `elections/{id}/proxies` |
| GET | `/api/elections/:id/proxy-documents` | Admin | Read `elections/{id}/proxy-documents` |
| POST | `/api/elections/:id/proxy-documents` | Admin | Create or action `elections/{id}/proxy-documents` |
| GET | `/api/elections/:id/result-report` | Admin | Read `elections/{id}/result-report` |
| POST | `/api/elections/:id/send-reminders` | Admin | Create or action `elections/{id}/send-reminders` |
| GET | `/api/elections/:id/tally` | Admin | Read `elections/{id}/tally` |
| GET | `/api/elections/:id/tokens` | Admin | Read `elections/{id}/tokens` |
| GET | `/api/elections/:id/tokens-detail` | Admin | Read `elections/{id}/tokens-detail` |
| POST | `/api/elections/:id/tokens/:tokenId/resend` | Admin | Create or action `elections/{id}/tokens/{id}/resend` |
| GET | `/api/elections/active-summary` | Admin | List/read `elections/active-summary` |
| GET | `/api/elections/analytics` | Admin | List/read `elections/analytics` |
| GET | `/api/elections/ballot/:token` | Public | Read `elections/ballot/{id}` |
| POST | `/api/elections/ballot/:token/cast` | Public | Create or action `elections/ballot/{id}/cast` |
| GET | `/api/elections/compliance-summary` | Admin | List/read `elections/compliance-summary` |
| DELETE | `/api/elections/proxies/:proxyId` | Admin | Delete `elections/proxies/{id}` |
| GET | `/api/governance/calendar/events` | Admin | List/read `governance/calendar/events` |
| POST | `/api/governance/calendar/events` | Admin | Create or action `governance/calendar/events` |
| PATCH | `/api/governance/calendar/events/:id` | Admin | Update `governance/calendar/events/{id}` |
| POST | `/api/governance/compliance-alert-overrides` | Admin | Create or action `governance/compliance-alert-overrides` |
| GET | `/api/governance/compliance-alerts` | Admin | List/read `governance/compliance-alerts` |
| PATCH | `/api/governance/meeting-notes/:id` | Admin | Update `governance/meeting-notes/{id}` |
| GET | `/api/governance/meetings` | Admin | List/read `governance/meetings` |
| POST | `/api/governance/meetings` | Admin | Create or action `governance/meetings` |
| PATCH | `/api/governance/meetings/:id` | Admin | Update `governance/meetings/{id}` |
| GET | `/api/governance/meetings/:id/agenda-items` | Admin | Read `governance/meetings/{id}/agenda-items` |
| POST | `/api/governance/meetings/:id/agenda-items` | Admin | Create or action `governance/meetings/{id}/agenda-items` |
| GET | `/api/governance/meetings/:id/notes` | Admin | Read `governance/meetings/{id}/notes` |
| POST | `/api/governance/meetings/:id/notes` | Admin | Create or action `governance/meetings/{id}/notes` |
| GET | `/api/governance/platform-gaps` | Admin | List/read `governance/platform-gaps` |
| GET | `/api/governance/reminder-rules` | Admin | List/read `governance/reminder-rules` |
| POST | `/api/governance/reminder-rules` | Admin | Create or action `governance/reminder-rules` |
| PATCH | `/api/governance/reminder-rules/:id` | Admin | Update `governance/reminder-rules/{id}` |
| POST | `/api/governance/reminder-rules/:id/run` | Admin | Create or action `governance/reminder-rules/{id}/run` |
| GET | `/api/governance/resolutions` | Admin | List/read `governance/resolutions` |
| POST | `/api/governance/resolutions` | Admin | Create or action `governance/resolutions` |
| PATCH | `/api/governance/resolutions/:id` | Admin | Update `governance/resolutions/{id}` |
| GET | `/api/governance/resolutions/:id/votes` | Admin | Read `governance/resolutions/{id}/votes` |
| POST | `/api/governance/resolutions/:id/votes` | Admin | Create or action `governance/resolutions/{id}/votes` |
| GET | `/api/governance/tasks` | Admin | List/read `governance/tasks` |
| POST | `/api/governance/tasks` | Admin | Create or action `governance/tasks` |
| PATCH | `/api/governance/tasks/:id` | Admin | Update `governance/tasks/{id}` |
| POST | `/api/governance/tasks/:id/evidence` | Admin | Create or action `governance/tasks/{id}/evidence` |
| POST | `/api/governance/tasks/generate` | Admin | Create or action `governance/tasks/generate` |
| GET | `/api/governance/templates` | Admin | List/read `governance/templates` |
| POST | `/api/governance/templates` | Admin | Create or action `governance/templates` |
| PATCH | `/api/governance/templates/:id` | Admin | Update `governance/templates/{id}` |
| POST | `/api/governance/templates/:templateId/assign` | Admin | Create or action `governance/templates/{id}/assign` |
| GET | `/api/governance/templates/:templateId/items` | Admin | Read `governance/templates/{id}/items` |
| POST | `/api/governance/templates/:templateId/items` | Admin | Create or action `governance/templates/{id}/items` |
| POST | `/api/governance/templates/:templateId/new-version` | Admin | Create or action `governance/templates/{id}/new-version` |
| GET | `/api/governance/templates/:templateId/versions` | Admin | Read `governance/templates/{id}/versions` |
| POST | `/api/governance/templates/bootstrap-state-library` | Admin | Create or action `governance/templates/bootstrap-state-library` |
| GET | `/api/hub/:identifier/buildings` | Public | Read `hub/{id}/buildings` |
| GET | `/api/hub/:identifier/buildings/:buildingId` | Public | Read `hub/{id}/buildings/{id}` |
| GET | `/api/hub/:identifier/public` | Public | Read `hub/{id}/public` |
| GET | `/api/hub/portal/home` | Portal session | List/read `hub/portal/home` |
| POST | `/api/hub/portal/map/issues` | Portal session | Create or action `hub/portal/map/issues` |
| GET | `/api/hub/portal/map/issues/mine` | Portal session | List/read `hub/portal/map/issues/mine` |

### Portfolio Registry (68 endpoints)

_Associations, buildings, units, persons, owners, occupancies, portfolio dashboard._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/addresses/search` | Admin | List/read `addresses/search` |
| GET | `/api/associations` | Admin | List/read `associations` |
| POST | `/api/associations` | Admin | Create or action `associations` |
| DELETE | `/api/associations/:id` | Admin | Delete `associations/{id}` |
| PATCH | `/api/associations/:id` | Admin | Update `associations/{id}` |
| POST | `/api/associations/:id/archive` | Admin | Create or action `associations/{id}/archive` |
| GET | `/api/associations/:id/hub/action-links` | Admin | Read `associations/{id}/hub/action-links` |
| POST | `/api/associations/:id/hub/action-links` | Admin | Create or action `associations/{id}/hub/action-links` |
| DELETE | `/api/associations/:id/hub/action-links/:linkId` | Admin | Delete `associations/{id}/hub/action-links/{id}` |
| PUT | `/api/associations/:id/hub/action-links/:linkId` | Admin | Replace `associations/{id}/hub/action-links/{id}` |
| POST | `/api/associations/:id/hub/auto-populate` | Admin | Create or action `associations/{id}/hub/auto-populate` |
| GET | `/api/associations/:id/hub/config` | Admin | Read `associations/{id}/hub/config` |
| PUT | `/api/associations/:id/hub/config` | Admin | Replace `associations/{id}/hub/config` |
| GET | `/api/associations/:id/hub/info-blocks` | Admin | Read `associations/{id}/hub/info-blocks` |
| POST | `/api/associations/:id/hub/info-blocks` | Admin | Create or action `associations/{id}/hub/info-blocks` |
| DELETE | `/api/associations/:id/hub/info-blocks/:blockId` | Admin | Delete `associations/{id}/hub/info-blocks/{id}` |
| PUT | `/api/associations/:id/hub/info-blocks/:blockId` | Admin | Replace `associations/{id}/hub/info-blocks/{id}` |
| GET | `/api/associations/:id/hub/map/issues` | Admin | Read `associations/{id}/hub/map/issues` |
| PUT | `/api/associations/:id/hub/map/issues/:issueId` | Admin | Replace `associations/{id}/hub/map/issues/{id}` |
| GET | `/api/associations/:id/hub/map/layers` | Admin | Read `associations/{id}/hub/map/layers` |
| POST | `/api/associations/:id/hub/map/layers` | Admin | Create or action `associations/{id}/hub/map/layers` |
| PUT | `/api/associations/:id/hub/map/layers/:layerId` | Admin | Replace `associations/{id}/hub/map/layers/{id}` |
| GET | `/api/associations/:id/hub/map/layers/:layerId/nodes` | Admin | Read `associations/{id}/hub/map/layers/{id}/nodes` |
| POST | `/api/associations/:id/hub/map/nodes` | Admin | Create or action `associations/{id}/hub/map/nodes` |
| DELETE | `/api/associations/:id/hub/map/nodes/:nodeId` | Admin | Delete `associations/{id}/hub/map/nodes/{id}` |
| PUT | `/api/associations/:id/hub/map/nodes/:nodeId` | Admin | Replace `associations/{id}/hub/map/nodes/{id}` |
| GET | `/api/associations/:id/hub/notices` | Admin | Read `associations/{id}/hub/notices` |
| POST | `/api/associations/:id/hub/notices` | Admin | Create or action `associations/{id}/hub/notices` |
| DELETE | `/api/associations/:id/hub/notices/:noticeId` | Admin | Delete `associations/{id}/hub/notices/{id}` |
| PUT | `/api/associations/:id/hub/notices/:noticeId` | Admin | Replace `associations/{id}/hub/notices/{id}` |
| GET | `/api/associations/:id/insurance` | Admin | Read `associations/{id}/insurance` |
| POST | `/api/associations/:id/insurance` | Admin | Create or action `associations/{id}/insurance` |
| DELETE | `/api/associations/:id/insurance/:policyId` | Admin | Delete `associations/{id}/insurance/{id}` |
| PATCH | `/api/associations/:id/insurance/:policyId` | Admin | Update `associations/{id}/insurance/{id}` |
| GET | `/api/associations/:id/overview` | Admin | Read `associations/{id}/overview` |
| GET | `/api/associations/:id/pm-toggles` | Admin | Read `associations/{id}/pm-toggles` |
| PUT | `/api/associations/:id/pm-toggles/:toggleKey` | Admin | Replace `associations/{id}/pm-toggles/{id}` |
| POST | `/api/associations/:id/restore` | Admin | Create or action `associations/{id}/restore` |
| GET | `/api/associations/:id/settings/amenities` | Admin | Read `associations/{id}/settings/amenities` |
| PATCH | `/api/associations/:id/settings/amenities` | Admin | Update `associations/{id}/settings/amenities` |
| GET | `/api/associations/search` | Admin | List/read `associations/search` |
| GET | `/api/buildings` | Admin | List/read `buildings` |
| POST | `/api/buildings` | Admin | Create or action `buildings` |
| PATCH | `/api/buildings/:id` | Admin | Update `buildings/{id}` |
| GET | `/api/occupancies` | Admin | List/read `occupancies` |
| POST | `/api/occupancies` | Admin | Create or action `occupancies` |
| DELETE | `/api/occupancies/:id` | Admin | Delete `occupancies/{id}` |
| PATCH | `/api/occupancies/:id` | Admin | Update `occupancies/{id}` |
| POST | `/api/owners/bulk-update` | Admin | Create or action `owners/bulk-update` |
| GET | `/api/ownerships` | Admin | List/read `ownerships` |
| POST | `/api/ownerships` | Admin | Create or action `ownerships` |
| DELETE | `/api/ownerships/:id` | Admin | Delete `ownerships/{id}` |
| PATCH | `/api/ownerships/:id` | Admin | Update `ownerships/{id}` |
| GET | `/api/persons` | Admin | List/read `persons` |
| POST | `/api/persons` | Admin | Create or action `persons` |
| DELETE | `/api/persons/:id` | Admin | Delete `persons/{id}` |
| PATCH | `/api/persons/:id` | Admin | Update `persons/{id}` |
| POST | `/api/persons/import` | Admin | Create or action `persons/import` |
| GET | `/api/portfolio/summary` | Admin | List/read `portfolio/summary` |
| GET | `/api/portfolio/threshold-alerts` | Admin | List/read `portfolio/threshold-alerts` |
| GET | `/api/residential/dataset` | Admin | List/read `residential/dataset` |
| GET | `/api/search` | Admin | List/read `search` |
| GET | `/api/units` | Admin | List/read `units` |
| POST | `/api/units` | Admin | Create or action `units` |
| DELETE | `/api/units/:id` | Admin | Delete `units/{id}` |
| PATCH | `/api/units/:id` | Admin | Update `units/{id}` |
| GET | `/api/units/:id/history` | Admin | Read `units/{id}/history` |
| POST | `/api/units/import` | Admin | Create or action `units/import` |

### Alerts (4 endpoints)

_Cross-association alert engine (4.1) — single aggregation endpoint for the Home cross-association panel + four `HubAlertWidget` instances. 60 s cache, targeted invalidation._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/alerts/:alertId/dismiss` | Admin | Create or action `alerts/{id}/dismiss` |
| POST | `/api/alerts/:alertId/read` | Admin | Create or action `alerts/{id}/read` |
| POST | `/api/alerts/:alertId/restore` | Admin | Create or action `alerts/{id}/restore` |
| GET | `/api/alerts/cross-association` | Admin | List/read `alerts/cross-association` |

### Platform (141 endpoints)

_Platform Admin surfaces (`/api/platform/*`), authentication (`/api/auth/*`), Stripe webhooks, AI ingestion, system bootstrap, observability, billing, dashboard summaries._

| Verb | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/admin/analytics` | Admin | List/read `admin/analytics` |
| GET | `/api/admin/assessment-execution/parity-report` | Admin | List/read `admin/assessment-execution/parity-report` |
| GET | `/api/admin/associations/:id/activity` | Admin | Read `admin/associations/{id}/activity` |
| GET | `/api/admin/associations/:id/workspace` | Admin | Read `admin/associations/{id}/workspace` |
| POST | `/api/admin/billing/portal-session` | Admin | Create or action `admin/billing/portal-session` |
| GET | `/api/admin/billing/subscription` | Admin | List/read `admin/billing/subscription` |
| GET | `/api/admin/board-packages` | Admin | List/read `admin/board-packages` |
| PATCH | `/api/admin/board-packages/:id` | Admin | Update `admin/board-packages/{id}` |
| POST | `/api/admin/board-packages/:id/distribute` | Admin | Create or action `admin/board-packages/{id}/distribute` |
| GET | `/api/admin/board-packages/distribution-history` | Admin | List/read `admin/board-packages/distribution-history` |
| POST | `/api/admin/board-packages/generate/:templateId` | Admin | Create or action `admin/board-packages/generate/{id}` |
| POST | `/api/admin/board-packages/run-scheduled` | Admin | Create or action `admin/board-packages/run-scheduled` |
| GET | `/api/admin/board-packages/templates` | Admin | List/read `admin/board-packages/templates` |
| POST | `/api/admin/board-packages/templates` | Admin | Create or action `admin/board-packages/templates` |
| PATCH | `/api/admin/board-packages/templates/:id` | Admin | Update `admin/board-packages/templates/{id}` |
| POST | `/api/admin/contextual-feedback` | Admin | Create or action `admin/contextual-feedback` |
| POST | `/api/admin/executive/sync` | Admin | Create or action `admin/executive/sync` |
| GET | `/api/admin/executive/updates` | Admin | List/read `admin/executive/updates` |
| POST | `/api/admin/executive/updates` | Admin | Create or action `admin/executive/updates` |
| PATCH | `/api/admin/executive/updates/:id` | Admin | Update `admin/executive/updates/{id}` |
| GET | `/api/admin/executive/updates/:id/evidence` | Admin | Read `admin/executive/updates/{id}/evidence` |
| POST | `/api/admin/executive/updates/:id/evidence` | Admin | Create or action `admin/executive/updates/{id}/evidence` |
| GET | `/api/admin/me/preferences` | Admin | List/read `admin/me/preferences` |
| PUT | `/api/admin/me/preferences` | Admin | Replace `admin/me/preferences` |
| GET | `/api/admin/payment-events` | Admin | List/read `admin/payment-events` |
| PATCH | `/api/admin/payment-events/:id/status` | Admin | Update `admin/payment-events/{id}/status` |
| GET | `/api/admin/payment-events/:id/transitions` | Admin | Read `admin/payment-events/{id}/transitions` |
| GET | `/api/admin/payment-transactions` | Admin | List/read `admin/payment-transactions` |
| GET | `/api/admin/portfolio/alerts` | Admin | List/read `admin/portfolio/alerts` |
| GET | `/api/admin/portfolio/associations` | Admin | List/read `admin/portfolio/associations` |
| GET | `/api/admin/portfolio/recent-activity` | Admin | List/read `admin/portfolio/recent-activity` |
| GET | `/api/admin/portfolio/summary` | Admin | List/read `admin/portfolio/summary` |
| POST | `/api/admin/projects` | Admin | Create or action `admin/projects` |
| DELETE | `/api/admin/projects/:projectId` | Admin | Delete `admin/projects/{id}` |
| GET | `/api/admin/projects/:projectId` | Admin | Read `admin/projects/{id}` |
| PATCH | `/api/admin/projects/:projectId` | Admin | Update `admin/projects/{id}` |
| GET | `/api/admin/qa-seed/preview` | Admin | List/read `admin/qa-seed/preview` |
| POST | `/api/admin/qa-seed/purge` | Admin | Create or action `admin/qa-seed/purge` |
| GET | `/api/admin/roadmap` | Admin | List/read `admin/roadmap` |
| GET | `/api/admin/roadmap/feature-tree` | Admin | List/read `admin/roadmap/feature-tree` |
| POST | `/api/admin/tasks` | Admin | Create or action `admin/tasks` |
| DELETE | `/api/admin/tasks/:taskId` | Admin | Delete `admin/tasks/{id}` |
| GET | `/api/admin/tasks/:taskId` | Admin | Read `admin/tasks/{id}` |
| PATCH | `/api/admin/tasks/:taskId` | Admin | Update `admin/tasks/{id}` |
| GET | `/api/admin/tasks/:taskId/attachments` | Admin | Read `admin/tasks/{id}/attachments` |
| POST | `/api/admin/tasks/:taskId/attachments` | Admin | Create or action `admin/tasks/{id}/attachments` |
| DELETE | `/api/admin/tasks/:taskId/attachments/:attachmentId` | Admin | Delete `admin/tasks/{id}/attachments/{id}` |
| GET | `/api/admin/users` | Admin | List/read `admin/users` |
| POST | `/api/admin/users` | Admin | Create or action `admin/users` |
| PATCH | `/api/admin/users/:id/active` | Admin | Update `admin/users/{id}/active` |
| PATCH | `/api/admin/users/:id/role` | Admin | Update `admin/users/{id}/role` |
| GET | `/api/admin/webhook-secrets` | Admin | List/read `admin/webhook-secrets` |
| POST | `/api/admin/webhook-secrets` | Admin | Create or action `admin/webhook-secrets` |
| POST | `/api/admin/workstreams` | Admin | Create or action `admin/workstreams` |
| DELETE | `/api/admin/workstreams/:workstreamId` | Admin | Delete `admin/workstreams/{id}` |
| GET | `/api/admin/workstreams/:workstreamId` | Admin | Read `admin/workstreams/{id}` |
| PATCH | `/api/admin/workstreams/:workstreamId` | Admin | Update `admin/workstreams/{id}` |
| GET | `/api/ai/ingestion/clauses` | Admin | List/read `ai/ingestion/clauses` |
| PATCH | `/api/ai/ingestion/clauses/:id/review` | Admin | Update `ai/ingestion/clauses/{id}/review` |
| GET | `/api/ai/ingestion/clauses/:id/suggested-links` | Admin | Read `ai/ingestion/clauses/{id}/suggested-links` |
| POST | `/api/ai/ingestion/clauses/:id/suggested-links` | Admin | Create or action `ai/ingestion/clauses/{id}/suggested-links` |
| GET | `/api/ai/ingestion/clauses/:id/tags` | Admin | Read `ai/ingestion/clauses/{id}/tags` |
| POST | `/api/ai/ingestion/clauses/:id/tags` | Admin | Create or action `ai/ingestion/clauses/{id}/tags` |
| GET | `/api/ai/ingestion/compliance-rules` | Admin | List/read `ai/ingestion/compliance-rules` |
| POST | `/api/ai/ingestion/compliance-rules/extract` | Admin | Create or action `ai/ingestion/compliance-rules/extract` |
| GET | `/api/ai/ingestion/governance/approved-links` | Admin | List/read `ai/ingestion/governance/approved-links` |
| POST | `/api/ai/ingestion/import-runs/:runId/reprocess` | Admin | Create or action `ai/ingestion/import-runs/{id}/reprocess` |
| POST | `/api/ai/ingestion/import-runs/:runId/rollback` | Admin | Create or action `ai/ingestion/import-runs/{id}/rollback` |
| GET | `/api/ai/ingestion/import-runs/:runId/rollback-preview` | Admin | Read `ai/ingestion/import-runs/{id}/rollback-preview` |
| GET | `/api/ai/ingestion/jobs` | Admin | List/read `ai/ingestion/jobs` |
| POST | `/api/ai/ingestion/jobs` | Admin | Create or action `ai/ingestion/jobs` |
| GET | `/api/ai/ingestion/jobs/:id/history-summary` | Admin | Read `ai/ingestion/jobs/{id}/history-summary` |
| POST | `/api/ai/ingestion/jobs/:id/process` | Admin | Create or action `ai/ingestion/jobs/{id}/process` |
| GET | `/api/ai/ingestion/jobs/:id/records` | Admin | Read `ai/ingestion/jobs/{id}/records` |
| GET | `/api/ai/ingestion/monitoring` | Admin | List/read `ai/ingestion/monitoring` |
| GET | `/api/ai/ingestion/records/:id/bank-resolution` | Admin | Read `ai/ingestion/records/{id}/bank-resolution` |
| GET | `/api/ai/ingestion/records/:id/import-runs` | Admin | Read `ai/ingestion/records/{id}/import-runs` |
| PATCH | `/api/ai/ingestion/records/:id/review` | Admin | Update `ai/ingestion/records/{id}/review` |
| GET | `/api/ai/ingestion/rollout-policy` | Admin | List/read `ai/ingestion/rollout-policy` |
| POST | `/api/ai/ingestion/rollout-policy` | Admin | Create or action `ai/ingestion/rollout-policy` |
| GET | `/api/ai/ingestion/runtime-status` | Admin | List/read `ai/ingestion/runtime-status` |
| PATCH | `/api/ai/ingestion/suggested-links/:id` | Admin | Update `ai/ingestion/suggested-links/{id}` |
| POST | `/api/ai/ingestion/superseded-cleanup` | Admin | Create or action `ai/ingestion/superseded-cleanup` |
| GET | `/api/ai/ingestion/superseded-cleanup-preview` | Admin | List/read `ai/ingestion/superseded-cleanup-preview` |
| GET | `/api/analysis/:resourceId/history/:module` | Admin | Read `analysis/{id}/history/{id}` |
| POST | `/api/analysis/:resourceId/history/:module/:versionId/revert` | Admin | Create or action `analysis/{id}/history/{id}/{id}/revert` |
| POST | `/api/analysis/:resourceId/history/:module/runs` | Admin | Create or action `analysis/{id}/history/{id}/runs` |
| POST | `/api/analysis/:resourceId/history/:module/versions` | Admin | Create or action `analysis/{id}/history/{id}/versions` |
| GET | `/api/assets` | Admin | List/read `assets` |
| POST | `/api/assets` | Admin | Create or action `assets` |
| DELETE | `/api/assets/:id` | Admin | Delete `assets/{id}` |
| PATCH | `/api/assets/:id` | Admin | Update `assets/{id}` |
| GET | `/api/audit-logs` | Admin | List/read `audit-logs` |
| GET | `/api/dashboard/alerts` | Admin | List/read `dashboard/alerts` |
| GET | `/api/dashboard/stats` | Admin | List/read `dashboard/stats` |
| GET | `/api/debug/admin-context` | Admin | List/read `debug/admin-context` |
| GET | `/api/health` | Public | List/read `health` |
| GET | `/api/health/details` | Admin | List/read `health/details` |
| GET | `/api/onboarding/completeness` | Admin | List/read `onboarding/completeness` |
| POST | `/api/onboarding/dismiss` | Admin | Create or action `onboarding/dismiss` |
| POST | `/api/onboarding/intake` | Admin | Create or action `onboarding/intake` |
| GET | `/api/onboarding/invites` | Admin | List/read `onboarding/invites` |
| POST | `/api/onboarding/invites` | Admin | Create or action `onboarding/invites` |
| POST | `/api/onboarding/invites/:id/send` | Admin | Create or action `onboarding/invites/{id}/send` |
| POST | `/api/onboarding/invites/reminders/run` | Admin | Create or action `onboarding/invites/reminders/run` |
| GET | `/api/onboarding/signup-checklist` | Admin | List/read `onboarding/signup-checklist` |
| GET | `/api/onboarding/state` | Admin | List/read `onboarding/state` |
| GET | `/api/onboarding/submissions` | Admin | List/read `onboarding/submissions` |
| PATCH | `/api/onboarding/submissions/:id/review` | Admin | Update `onboarding/submissions/{id}/review` |
| POST | `/api/onboarding/unit-links/ensure` | Admin | Create or action `onboarding/unit-links/ensure` |
| POST | `/api/onboarding/unit-links/regenerate` | Admin | Create or action `onboarding/unit-links/regenerate` |
| GET | `/api/platform/admin-association-scopes` | Admin | List/read `platform/admin-association-scopes` |
| POST | `/api/platform/admin-association-scopes` | Admin | Create or action `platform/admin-association-scopes` |
| GET | `/api/platform/auth/google-status` | Admin | List/read `platform/auth/google-status` |
| POST | `/api/platform/billing/configure` | Admin | Create or action `platform/billing/configure` |
| GET | `/api/platform/billing/summary` | Admin | List/read `platform/billing/summary` |
| GET | `/api/platform/email-threads` | Admin | List/read `platform/email-threads` |
| GET | `/api/platform/email/logs` | Admin | List/read `platform/email/logs` |
| GET | `/api/platform/email/logs/:id` | Admin | Read `platform/email/logs/{id}` |
| GET | `/api/platform/email/policy` | Admin | List/read `platform/email/policy` |
| GET | `/api/platform/email/provider-status` | Admin | List/read `platform/email/provider-status` |
| POST | `/api/platform/email/test` | Admin | Create or action `platform/email/test` |
| GET | `/api/platform/email/tracking/click/:token` | Public | Read `platform/email/tracking/click/{id}` |
| GET | `/api/platform/email/tracking/pixel/:token` | Public | Read `platform/email/tracking/pixel/{id}` |
| POST | `/api/platform/email/tracking/purge` | Admin | Create or action `platform/email/tracking/purge` |
| POST | `/api/platform/email/verify` | Admin | Create or action `platform/email/verify` |
| GET | `/api/platform/permission-envelopes` | Admin | List/read `platform/permission-envelopes` |
| POST | `/api/platform/permission-envelopes` | Admin | Create or action `platform/permission-envelopes` |
| PATCH | `/api/platform/permission-envelopes/:id` | Admin | Update `platform/permission-envelopes/{id}` |
| POST | `/api/platform/push/configure` | Admin | Create or action `platform/push/configure` |
| GET | `/api/platform/push/provider-status` | Admin | List/read `platform/push/provider-status` |
| POST | `/api/platform/sms/configure` | Admin | Create or action `platform/sms/configure` |
| GET | `/api/platform/sms/provider-status` | Admin | List/read `platform/sms/provider-status` |
| GET | `/api/platform/tenant-config` | Admin | List/read `platform/tenant-config` |
| POST | `/api/platform/tenant-config` | Admin | Create or action `platform/tenant-config` |
| GET | `/api/system/bootstrap-status` | Public | List/read `system/bootstrap-status` |
| GET | `/api/uploads/:filename` | Public | Read `uploads/{id}` |
| POST | `/api/webhooks/payments` | Public | Create or action `webhooks/payments` |
| POST | `/api/webhooks/platform/stripe` | Public | Create or action `webhooks/platform/stripe` |
| POST | `/api/webhooks/twilio/sms-delivery` | Public | Create or action `webhooks/twilio/sms-delivery` |
| POST | `/api/webhooks/twilio/sms-status` | Public | Create or action `webhooks/twilio/sms-status` |

---

## Auth Gate Reference

| Gate | Source | Applies to | Notes |
|---|---|---|---|
| `requireAdmin` | `server/auth.ts` | Operator-side (`/api/*` non-portal) | Validates Passport admin session. Sets `req.adminUser`. |
| `requireAdminRole([roles])` | `server/auth.ts` | Operator-side, role-narrowed | Layered on top of `requireAdmin`. Reads from the canonical `AdminRole` enum (post 2.1 Q3). |
| `requirePortal` | `server/auth.ts` | Owner-portal (`/api/portal/*`) | Validates portal-side OTP/email session. Sets `req.portalUser` to the owner Person. |
| `requirePlatformAdmin` | `server/auth.ts` | Platform-admin-only paths | Convenience wrapper; equivalent to `requireAdminRole(["platform-admin"])`. |
| `none` (Public) | n/a | Anonymous endpoints | Stripe/Twilio webhooks, signup, public payment links, public hub pages, system bootstrap. |

## Future work — OpenAPI generation

This document is hand-curated. OpenAPI/Swagger generation is deferred for the following reasons:

- Most handlers use `req.body` directly without binding to a `zod` schema, so request schemas would have to be reverse-engineered from `storage.ts` types.
- Response shapes are inconsistent (some return raw drizzle rows, others return curated DTOs).
- `routes.ts` is a 16k-line monolith; per-endpoint metadata (description, `@operationId`) would need to be added inline before generation is meaningful.

**Recommended path** when OpenAPI becomes a priority:

1. Decompose `server/routes.ts` into per-zone files (`server/routes/portal.ts`, `server/routes/financials.ts`, ...) — currently only `amenities.ts`, `autopay.ts`, and `payment-portal.ts` are split out.

2. Adopt `zod-to-openapi` or `tsoa` and require every handler to declare a request/response schema.

3. Generate the spec at build time and commit alongside this hand-curated doc until coverage matches.

Filed as Wave 20 follow-up workitem: "API documentation: OpenAPI generation path".
