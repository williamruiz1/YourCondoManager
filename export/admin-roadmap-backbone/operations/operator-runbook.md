# Operator Runbook — HOA Platform

## Overview

This runbook covers day-to-day operations, incident response, cutover procedures, and launch KPIs for the HOA management platform.

---

## 1. Environment Setup

### Required Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PAYMENT_WEBHOOK_SHARED_SECRET` | Legacy shared secret for webhook auth | No (use HMAC instead) |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID | For Gmail integration |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret | For Gmail integration |

### Database Bootstrap

```bash
# Apply schema migrations
npm run db:push

# Seed known associations (runs on every startup automatically)
# No manual action needed — server/seed.ts runs seedDatabase() on boot
```

---

## 2. Routine Operations

### Recurring Charges
- Charges run manually or on demand via **Finance → Recurring Charges → Run Now**
- API: `POST /api/financial/recurring-charges/run` with `{ associationId }`
- Failed runs appear in the Run History table with a Retry button
- Max retries per schedule are configurable per association

### Autopay Processing
- Autopay runs: `POST /api/financial/autopay/run` with `{ associationId }`
- Active enrollments with `nextPaymentDate <= now` will be processed
- Failures are logged to `autopay_runs` table

### Bank Reconciliation
- Import statements via Finance → Reconciliation → New Import
- Supports JSON and CSV (Date, Description, Amount columns)
- Run auto-match: `POST /api/financial/reconciliation/auto-match`
- Close periods to lock matched transactions
- Only platform-admin can reopen locked periods

### Financial Alerts
- Generate alerts: `POST /api/financial/alerts/generate` with `{ associationId }`
- Alerts cover: large payments (>$5000), delinquency spikes, reconciliation gaps
- Dismiss from Finance → Ledger → Finance-Grade Alerts

---

## 3. Incident Response

### Duplicate Webhook Events
- The `payment_webhook_events` table has a unique index on `(associationId, provider, providerEventId)`
- Duplicate events return HTTP 200 with `{ duplicate: true }` — no ledger entry is created
- Force-transition event status via Admin → Payments → Webhook Monitor → Event States

### Failed Autopay/Recurring Runs
1. Check `autopay_runs` or `recurring_charge_runs` for `status = "failed"`
2. Review `errorMessage` column for root cause
3. Use Retry button in the UI or call the retry API endpoint
4. If max retries exhausted, create ledger entry manually via Finance → Ledger

### Webhook Signature Failures
- All webhook requests should include `x-webhook-hmac-sha256: <hmac-sha256-of-payload>`
- Manage signing secrets at Admin → Payments → Webhook Security
- Rotate secrets by adding a new one — old one is automatically deactivated

---

## 4. Cutover Plan

### Pre-Cutover Checklist

- [ ] All production associations created and scoped to correct admin users
- [ ] Fee schedules, late fee rules, and recurring charge schedules configured
- [ ] Partial payment rules set per association
- [ ] Portal access granted to all owners
- [ ] Payment method configs published (ACH, Zelle, etc.)
- [ ] Webhook signing secrets configured for payment providers
- [ ] QA seed data purged (Admin → Platform Controls → QA Seed Data Management)
- [ ] Board package templates and governance task templates assigned
- [ ] Reconciliation periods created for current month
- [ ] Payment acceptance tests pass: `npm run test:payments`

### Day-of-Cutover Steps

1. Take a final database snapshot
2. Run QA seed data dry-run preview: confirm only test associations identified
3. Execute QA purge (confirm)
4. Send portal access invitations to all owners
5. Monitor financial alerts for first 24h

### Post-Cutover Monitoring

- Check `financial_alerts` for any delinquency spikes or reconciliation gaps
- Verify autopay enrollment emails are sending
- Monitor `payment_webhook_events` for failed webhooks

---

## 5. Launch KPIs

| KPI | Target | Measurement |
|---|---|---|
| Portal Adoption Rate | ≥ 70% owners active in first 30 days | `portal_accesses` count / total ownership count |
| Payment Collection Rate | ≥ 95% of due charges collected within 30 days | Payments / Charges ratio in ledger |
| Reconciliation Completion | 100% periods closed by month+5 | `reconciliation_periods` with status=closed |
| Autopay Enrollment | ≥ 30% owners enrolled within 60 days | `autopay_enrollments` with status=active |
| Late Fee Issuance | < 10% of accounts have outstanding late fees | `owner_ledger_entries` late-fee vs total charge ratio |
| Webhook Success Rate | ≥ 99.9% uptime | `payment_webhook_events` status=processed / total |
| Support Ticket Volume | < 5 tickets/week/100 units after first 30 days | External support system |

---

## 6. Maintenance Notes

- Schema changes: always run `npm run db:push` after editing `shared/schema.ts`
- Board package auto-schedule: configured per association in Admin → Board Packages
- Governance template library: Platform-admin assigns state templates to associations
