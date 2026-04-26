// zone: shared (i18n registry)
//
// 5.6 — i18n scaffolding (Wave 21 + Wave 24 round-2 extension).
//
// Spec: docs/projects/platform-overhaul/decisions/5.6-i18n-scaffolding.md
//
// This module is the canonical English string registry. Translation modules
// (`strings.es.ts`, `strings.fr.ts`, …) are introduced in a later wave when
// the product commits to a localized release. We extract only — no
// translation, no i18next dependency, no plural / interpolation engine.
//
// Keys are flat dotted strings using the convention `<surface>.<context>.<element>`
// e.g. `home.alerts.title`, `inbox.tab.unread`, `portal.home.greeting`.
//
// Surfaces in scope (10 — Wave 21):
//   1. `home.*`                     — `client/src/pages/dashboard.tsx`
//   2. `inbox.*`                    — `client/src/pages/communications-inbox.tsx`
//   3. `hub.financials.*`           — `client/src/pages/hubs/financials-hub.tsx`
//   4. `hub.operations.*`           — `client/src/pages/hubs/operations-hub.tsx`
//   5. `hub.governance.*`           — `client/src/pages/hubs/governance-hub.tsx`
//   6. `hub.communications.*`       — `client/src/pages/hubs/communications-hub.tsx`
//   7. `financialRules.*`           — `client/src/pages/financial-rules.tsx`
//   8. `portal.home.*`              — `client/src/pages/portal/portal-home.tsx`
//   9. `portal.finances.*`          — `client/src/pages/portal/portal-finances.tsx`
//  10. `settings.billing.*`         — `client/src/pages/settings-billing.tsx`
//
// Surfaces extended (15 — Wave 24, round 2):
//  11. `financialFoundation.*`      — `client/src/pages/financial-foundation.tsx`
//  12. `financialBilling.*`         — `client/src/pages/financial-billing.tsx`
//  13. `financialRecurring.*`       — `client/src/pages/financial-recurring-charges.tsx`
//  14. `financialLateFees.*`        — `client/src/pages/financial-late-fees.tsx`
//  15. `financialDelinquency.*`     — `client/src/pages/financial-delinquency.tsx`
//  16. `financialPayments.*`        — `client/src/pages/financial-payments.tsx`
//  17. `financialLedger.*`          — `client/src/pages/financial-ledger.tsx`
//  18. `workOrders.*`               — `client/src/pages/work-orders.tsx`
//  19. `vendors.*`                  — `client/src/pages/vendors.tsx`
//  20. `meetings.*`                 — `client/src/pages/meetings.tsx`
//  21. `elections.*`                — `client/src/pages/elections.tsx`
//  22. `announcements.*`            — `client/src/pages/announcements.tsx`
//  23. `documents.*`                — `client/src/pages/documents.tsx`
//  24. `persons.*`                  — `client/src/pages/persons.tsx`
//  25. `units.*`                    — `client/src/pages/units.tsx`
//
// Surfaces extended (8 — Wave 27, round 3):
//  26. `insurance.*`                — `client/src/pages/insurance.tsx`
//  27. `maintenanceSchedules.*`     — `client/src/pages/maintenance-schedules.tsx`
//  28. `inspections.*`              — `client/src/pages/inspections.tsx`
//  29. `residentFeedback.*`         — `client/src/pages/resident-feedback.tsx`
//  30. `executive.*`                — `client/src/pages/executive.tsx`
//  31. `adminUsers.*`               — `client/src/pages/admin-users.tsx`
//  32. `operationsDashboard.*`      — `client/src/pages/operations-dashboard.tsx`
//  33. `aiIngestion.*`              — `client/src/pages/ai-ingestion.tsx`
//
// Surfaces extended (5 — Wave 31, round 4):
//  34. `board.*`                    — `client/src/pages/board.tsx`
//  35. `boardPackages.*`            — `client/src/pages/board-packages.tsx`
//  36. `governance.*`               — `client/src/pages/governance.tsx`
//  37. `communityHubPublic.*`       — `client/src/pages/community-hub-public.tsx`
//
// Surfaces extended (3 — Wave 42, public marketing brochure):
//  38. `landing.*`                  — `client/src/pages/landing.tsx`
//  39. `pricing.*`                  — `client/src/pages/pricing.tsx`
//  40. `solutions.*`                — `client/src/pages/solutions.tsx`
//
// Wave 42 closes the Wave 31 deferral. The 3 brochure surfaces now flow
// through the registry like every other surface; static UI copy is
// extracted, dynamic content (tier price numbers from API, plan-name
// lookups) stays inline. Translation engine still ships in a follow-up
// wave when product commits to a non-English locale.
//
// Common keys live under `common.*`. Surface-specific copy stays
// scoped under its surface prefix.

export const strings = {
  // ---------------------------------------------------------------------
  // Common (shared verbs / nouns reused across surfaces)
  // ---------------------------------------------------------------------
  "common.skipToContent": "Skip to content",
  "common.review": "Review",
  "common.refresh": "Refresh",
  "common.viewAll": "View all",
  "common.seeAll": "See all",
  "common.back": "Back",
  "common.retry": "Retry",
  "common.signOut": "Sign out",
  "common.loading": "Loading…",
  "common.saving": "Saving…",

  // ---------------------------------------------------------------------
  // 1. Home (`/app`)
  // ---------------------------------------------------------------------
  "home.title": "Home",
  "home.summary":
    "Today's action surface — alerts, quick actions, and elections. Drill into Portfolio Health for aggregate counts across all associations.",
  "home.eyebrow": "Workspace",
  "home.shortcut.openAssociationContext": "Open Association Context",
  "home.shortcut.reviewDocuments": "Review Documents",

  "home.welcome.title": "Welcome — let's get your first association set up",
  "home.welcome.body":
    "The setup wizard walks you through creating your association, adding units, configuring your HOA fee, and adding a board member — all in about 5 minutes.",
  "home.welcome.cta": "Start Setup",

  "home.viewerBanner":
    "You have viewer access — create and edit actions are disabled. Contact your administrator to request elevated permissions.",

  "home.portfolioHealth.title": "Portfolio Health",
  "home.portfolioHealth.body":
    "Aggregate counts and comparative health across all associations — associations, units, owners, tenants, board members, and documents.",
  "home.portfolioHealth.cta": "Open Portfolio Health",

  "home.quickActions.title": "Quick Actions",
  "home.quickActions.newWorkOrder": "New Work Order",
  "home.quickActions.scheduleMeeting": "Schedule Meeting",
  "home.quickActions.inviteBoardMember": "Invite Board Member",
  "home.quickActions.billing": "Billing",
  "home.quickActions.newAssociation": "New Association",
  "home.quickActions.selectAssociationHint": "Select an association above to enable quick actions.",

  "home.activeElections.title": "Active Elections",
  "home.activeElections.empty": "No active elections",
  "home.activeElections.quorumMet": "Quorum met",
  "home.activeElections.noQuorum": "No quorum",

  "home.alerts.title": "Attention Required",
  "home.alerts.subtitleScoped":
    "Live alerts scoped to the selected association, plus cross-association operational signals.",
  "home.alerts.subtitlePortfolio": "Portfolio-wide alerts across all associations.",
  "home.alerts.allClear": "All clear",
  "home.alerts.allClearBody":
    "No overdue work orders, due maintenance, urgent items, or insurance alerts.",

  "home.alert.overdueWorkOrders.label": "Overdue work orders",
  "home.alert.overdueWorkOrders.sub":
    "Work orders past their scheduled date across all associations — need resolution",
  "home.alert.dueMaintenance.label": "Maintenance due within 7 days",
  "home.alert.dueMaintenance.sub":
    "Scheduled preventive maintenance across all associations — convert to work orders",
  "home.alert.urgentWorkOrders.label": "Urgent work orders",
  "home.alert.urgentWorkOrders.sub":
    "Open work orders marked urgent — need immediate attention",
  "home.alert.stalledWorkOrders.label": "Stalled open work orders",
  "home.alert.stalledWorkOrders.sub":
    "Work orders open for more than 7 days with no status update",
  "home.alert.complianceOverdue.label": "Overdue compliance tasks",
  "home.alert.complianceOverdue.sub": "Governance tasks past their due date",
  "home.alert.complianceDueSoon.label": "Compliance tasks due in 14 days",
  "home.alert.complianceDueSoon.sub": "Upcoming governance deadlines requiring action",
  "home.alert.insuranceExpired.label": "Vendors with expired insurance",
  "home.alert.insuranceExpired.sub":
    "Do not assign work orders until coverage is renewed",
  "home.alert.insuranceDueSoon.label": "Vendor insurance expiring soon",
  "home.alert.insuranceDueSoon.sub":
    "Insurance expiring within 30 days — request renewal certificates",
  "home.alert.delinquent.label": "Delinquent accounts",
  "home.alert.delinquent.sub": "Owner accounts with outstanding balances",
  "home.alert.dataIntegrity.label": "Data integrity warning",

  "home.associations.title": "Associations",
  "home.associations.manage": "Manage Associations",
  "home.associations.inContext": "In Context",
  "home.associations.useContext": "Use Context",
  "home.associations.empty.title": "No associations yet",
  "home.associations.empty.body":
    "Create an association before using the portfolio workspace.",

  "home.currentContext.title": "Current Association Context",
  "home.currentContext.cta": "Open In-Context View",
  "home.currentContext.body":
    "Portfolio stays here on the dashboard. Use the in-context view for the selected association's overview, documents, buildings, units, ownership, and occupancy workflow.",

  // ---------------------------------------------------------------------
  // 2. Central Inbox (`/app/communications/inbox`)
  // ---------------------------------------------------------------------
  "inbox.title": "Inbox",
  "inbox.subtitle":
    "One place for cross-association alerts across every zone you can access. Dismissing an alert archives it here and clears it from the Home panel.",

  "inbox.tab.all": "All",
  "inbox.tab.unread": "Unread",
  "inbox.tab.archived": "Archived",

  "inbox.heading.unread": "Unread alerts",
  "inbox.heading.archived": "Archived alerts",
  "inbox.heading.all": "All alerts",

  "inbox.empty.all": "Inbox is empty",
  "inbox.empty.unread": "No unread alerts — all caught up",
  "inbox.empty.archived": "No archived alerts",

  "inbox.error.title": "Couldn't load inbox",
  "inbox.error.body":
    "We hit an error loading your alert inbox. Try again, or refresh the page if the problem persists.",

  "inbox.action.view": "View",
  "inbox.action.markAsRead": "Mark as read",
  "inbox.action.dismiss": "Dismiss",
  "inbox.action.restore": "Restore",
  "inbox.action.couldNotRestoreTitle": "Could not restore alert",
  "inbox.action.unknownError": "Unknown error",

  // ---------------------------------------------------------------------
  // 3. Financials hub
  // ---------------------------------------------------------------------
  "hub.financials.title": "Financials",
  "hub.financials.summary":
    "Upcoming overview of payments, billing, reports, and expenses.",
  "hub.financials.empty.title": "Financials zone hub coming soon",
  "hub.financials.empty.body":
    "This hub will surface an overview of payments, billing, reports, and expenses. Use the sidebar for the individual financial surfaces in the meantime.",
  "hub.financials.returnHome": "Return to Home",

  // ---------------------------------------------------------------------
  // 4. Operations hub
  // ---------------------------------------------------------------------
  "hub.operations.title": "Operations",
  "hub.operations.summary":
    "Upcoming overview of work orders, vendors, maintenance, and inspections.",
  "hub.operations.empty.title": "Operations zone hub coming soon",
  "hub.operations.empty.body":
    "This hub will surface an overview of work orders, vendors, maintenance, and inspections. Use the sidebar for the individual operations surfaces in the meantime.",
  "hub.operations.returnHome": "Return to Home",

  // ---------------------------------------------------------------------
  // 5. Governance hub
  // ---------------------------------------------------------------------
  "hub.governance.title": "Governance",
  "hub.governance.summary":
    "Upcoming overview of board activities, elections, meetings, and compliance.",
  "hub.governance.empty.title": "Governance zone hub coming soon",
  "hub.governance.empty.body":
    "This hub will surface an overview of board activities, elections, meetings, and compliance.",
  "hub.governance.returnHome": "Return to Home",

  // ---------------------------------------------------------------------
  // 6. Communications hub
  // ---------------------------------------------------------------------
  "hub.communications.title": "Communications",
  "hub.communications.summary":
    "Upcoming overview of notices, announcements, and community hub.",
  "hub.communications.empty.title": "Communications zone hub coming soon",
  "hub.communications.empty.body":
    "This hub will surface an overview of notices, announcements, and the community hub.",
  "hub.communications.returnHome": "Return to Home",

  // ---------------------------------------------------------------------
  // 7. Assessment Rules (`/app/financial/rules`)
  // ---------------------------------------------------------------------
  "financialRules.title": "Assessment Rules",
  "financialRules.summary":
    "Consolidated surface for recurring charges, special assessments, and unified run history.",
  "financialRules.eyebrow": "Finance",
  "financialRules.crumb.financials": "Financials",
  "financialRules.crumb.assessmentRules": "Assessment Rules",

  "financialRules.tab.recurring": "Recurring",
  "financialRules.tab.specialAssessments": "Special Assessments",
  "financialRules.tab.runHistory": "Run History",

  "financialRules.filters.title": "Filters",
  "financialRules.filters.body": "Rule type, status, and date window.",
  "financialRules.filters.ruleType": "Rule type",
  "financialRules.filters.status": "Status",
  "financialRules.filters.dateRange": "Date range",
  "financialRules.filters.customWindow": "Custom window",
  "financialRules.filters.all": "All",
  "financialRules.filters.recurring": "Recurring",
  "financialRules.filters.specialAssessment": "Special Assessment",
  "financialRules.filters.success": "Success",
  "financialRules.filters.failed": "Failed",
  "financialRules.filters.retrying": "Retrying",
  "financialRules.filters.skipped": "Skipped",
  "financialRules.filters.deferred": "Deferred",
  "financialRules.filters.last7": "Last 7 days",
  "financialRules.filters.last30": "Last 30 days",
  "financialRules.filters.last90": "Last 90 days",
  "financialRules.filters.custom": "Custom",

  "financialRules.runHistory.title": "Run History",
  "financialRules.runHistory.body":
    "Unified execution log (recurring + special assessments). Populated by the assessment orchestrator (Wave 7).",
  "financialRules.runHistory.selectAssociation":
    "Select an association to view run history.",
  "financialRules.runHistory.error.title": "Couldn't load run history",
  "financialRules.runHistory.error.body":
    "We hit an error loading the assessment run log. Try again or adjust the filters.",
  "financialRules.runHistory.empty.title": "No run history in this window",
  "financialRules.runHistory.empty.body":
    "Successful and failed assessment runs will show here once the orchestrator processes a rule.",

  "financialRules.runHistory.col.runStarted": "Run Started",
  "financialRules.runHistory.col.ruleType": "Rule Type",
  "financialRules.runHistory.col.rule": "Rule",
  "financialRules.runHistory.col.unit": "Unit",
  "financialRules.runHistory.col.status": "Status",
  "financialRules.runHistory.col.amount": "Amount",
  "financialRules.runHistory.col.ledger": "Ledger",
  "financialRules.runHistory.col.error": "Error",

  // ---------------------------------------------------------------------
  // 8. Portal Home (`/portal`)
  // ---------------------------------------------------------------------
  "portal.home.greetingFallback": "Welcome to your portal",
  "portal.home.cards.yourUnits": "Your units",
  "portal.home.cards.balance": "Account balance",
  "portal.home.cards.openRequests": "Open requests",
  "portal.home.cards.viewFinances": "View finances →",
  "portal.home.cards.submitOrTrack": "Submit or track →",

  "portal.home.notices.title": "Recent notices",
  "portal.home.notices.empty": "You're all caught up. No notices right now.",

  "portal.home.activity.title": "Request activity",
  "portal.home.activity.empty": "No maintenance requests yet.",

  "portal.home.shortcuts.communityEyebrow": "My Community",
  "portal.home.shortcuts.communityTitle": "Community hub",
  "portal.home.shortcuts.communityBody":
    "Notices, events, announcements, and the public community hub.",
  "portal.home.shortcuts.amenitiesEyebrow": "Amenities",
  "portal.home.shortcuts.amenitiesTitle": "Reserve a space",
  "portal.home.shortcuts.amenitiesBody":
    "Book amenities and track your upcoming reservations.",
  "portal.home.shortcuts.documentsEyebrow": "Documents",
  "portal.home.shortcuts.documentsTitle": "Association documents",
  "portal.home.shortcuts.documentsBody":
    "Read governing documents, meeting minutes, and policies.",
  "portal.home.shortcuts.paymentsEyebrow": "Payments",
  "portal.home.shortcuts.paymentsTitle": "Payment methods",
  "portal.home.shortcuts.paymentsBody": "Manage bank accounts and autopay.",

  "portal.home.elections.voteNow": "Vote now",
  "portal.home.elections.openForVoting": "Open for voting",

  // ---------------------------------------------------------------------
  // 9. Portal Finances (`/portal/finances`)
  // ---------------------------------------------------------------------
  "portal.finances.title": "My Finances",
  "portal.finances.subtitle":
    "Pay dues, manage payment methods, and review your ledger history.",
  "portal.finances.cards.balanceDue": "Balance due",
  "portal.finances.cards.totalPaidYtd": "Total paid (YTD)",
  "portal.finances.cards.totalChargesYtd": "Total charges (YTD)",
  "portal.finances.makePayment.title": "Make a payment",
  "portal.finances.makePayment.amountPlaceholder": "Amount",
  "portal.finances.makePayment.cta": "Pay now",
  "portal.finances.makePayment.redirecting": "Redirecting…",
  "portal.finances.makePayment.body":
    "Secure checkout via Stripe. You'll be redirected to complete the payment.",
  "portal.finances.quickLinks.title": "Quick links",
  "portal.finances.quickLinks.paymentMethods": "Payment methods & autopay",
  "portal.finances.quickLinks.fullLedger": "Full ledger history",
  "portal.finances.upcoming.title": "Upcoming special assessments",
  "portal.finances.recentLedger.title": "Recent ledger",
  "portal.finances.recentLedger.viewFull": "View full ledger",
  "portal.finances.recentLedger.empty": "No ledger entries yet.",
  "portal.finances.col.date": "Date",
  "portal.finances.col.type": "Type",
  "portal.finances.col.description": "Description",
  "portal.finances.col.amount": "Amount",

  "portal.finances.paymentMethods.title": "Payment methods",
  "portal.finances.paymentMethods.subtitle":
    "Bank accounts linked to your portal and autopay enrollments.",
  "portal.finances.paymentMethods.add": "Add method",
  "portal.finances.paymentMethods.opening": "Opening…",
  "portal.finances.paymentMethods.savedTitle": "Saved methods",
  "portal.finances.paymentMethods.savedEmpty":
    "No saved payment methods yet. Add a bank account to enable faster checkout and autopay.",
  "portal.finances.paymentMethods.default": "Default",
  "portal.finances.paymentMethods.setDefault": "Set default",
  "portal.finances.paymentMethods.remove": "Remove",
  "portal.finances.paymentMethods.bankAccount": "Bank account",

  "portal.finances.autopay.title": "Autopay enrollments",
  "portal.finances.autopay.empty":
    "You are not currently enrolled in autopay. Enroll from the finances hub to automate monthly dues.",
  "portal.finances.autopay.statusLabel": "Status:",

  "portal.finances.ledger.title": "Ledger history",
  "portal.finances.ledger.subtitle":
    "All charges, assessments, payments, late fees, and adjustments.",
  "portal.finances.ledger.empty.title": "No transactions yet",
  "portal.finances.ledger.empty.body":
    "Charges, assessments, payments, and adjustments will appear here once your account has activity.",
  "portal.finances.ledger.empty.filterMatch": "No ledger entries match this filter.",

  "portal.finances.assessment.backLink": "← Back to My Finances",
  "portal.finances.assessment.title": "Assessment detail",
  "portal.finances.assessment.body":
    "Leveraging the 4.3 Q5 drill-in surface for the selected special assessment.",

  // ---------------------------------------------------------------------
  // 10. Settings → Billing (`/app/settings/billing`)
  // ---------------------------------------------------------------------
  "settings.billing.title": "Billing",
  "settings.billing.subtitle":
    "Manage your plan, payment method, and billing history.",
  "settings.billing.loading": "Loading subscription…",

  "settings.billing.empty.title": "No billing account",
  "settings.billing.empty.body":
    "This association is not linked to a paid subscription. Contact support if you believe this is incorrect.",

  "settings.billing.plan.currentLabel": "Current plan",

  "settings.billing.trial.endsLabel": "Trial ends:",
  "settings.billing.trial.note":
    "21-day free trial · 7-day grace window after trial ends before workspace is locked. Add a payment method in the Stripe Customer Portal to continue uninterrupted.",

  "settings.billing.period.cancels": "Cancels on:",
  "settings.billing.period.next": "Next invoice:",

  "settings.billing.manage.title": "Manage billing",
  "settings.billing.manage.body":
    "Open the Stripe Customer Portal to update your payment method, change plan, view invoices, or cancel.",
  "settings.billing.manage.cta": "Manage Billing",
  "settings.billing.manage.note":
    "Opens the Stripe-hosted portal in a new tab. You'll return here after completing any changes.",

  "settings.billing.plan.selfManaged": "Self-Managed",
  "settings.billing.plan.propertyManager": "Property Manager",
  "settings.billing.plan.enterprise": "Enterprise",

  "settings.billing.status.trialing": "Trial",
  "settings.billing.status.active": "Active",
  "settings.billing.status.pastDue": "Past due",
  "settings.billing.status.canceled": "Canceled",
  "settings.billing.status.unpaid": "Unpaid",
  "settings.billing.status.incomplete": "Incomplete",

  // ---------------------------------------------------------------------
  // Wave 24 — Round 2 extension (15 surfaces)
  // ---------------------------------------------------------------------

  // Common (shared additions for Wave 24)
  "common.eyebrow.finance": "Finance",
  "common.eyebrow.operations": "Operations",
  "common.eyebrow.governance": "Board & Governance",
  "common.eyebrow.records": "Records",
  // Phase 12 (3.3 Zone 1): "Finance" → "Financials" to match 1.1 Q1
  // canonical zone label and align with the breadcrumb-paths.ts registry.
  "common.crumb.finance": "Financials",
  "common.crumb.operations": "Operations",
  "common.crumb.board": "Board",
  "common.crumb.dashboard": "Dashboard",
  "common.action.save": "Save",
  "common.action.saving": "Saving…",
  "common.action.cancel": "Cancel",
  "common.action.create": "Create",
  "common.action.update": "Update",
  "common.action.delete": "Delete",
  "common.action.edit": "Edit",
  "common.action.add": "Add",
  "common.action.importCsv": "Import CSV",
  "common.toast.error": "Error",

  // ---------------------------------------------------------------------
  // 11. Financial Foundation (`/app/financial/foundation`)
  // ---------------------------------------------------------------------
  "financialFoundation.title": "Chart of Accounts",
  "financialFoundation.summary":
    "Configure financial accounts, categories, and recurring charge schedules for the active association.",
  "financialFoundation.crumb": "Chart of Accounts",
  "financialFoundation.tabs.accounts": "Accounts",
  "financialFoundation.tabs.accountActivity": "Account Activity",
  "financialFoundation.tabs.recurringCharges": "Recurring Charges",
  "financialFoundation.scope.explanation":
    "Accounts and categories are scoped to the active association. Select one to manage its chart of accounts.",
  "financialFoundation.accounts.heading": "Accounts",
  "financialFoundation.accounts.add": "Add Account",
  "financialFoundation.accounts.dialogTitle": "Create Account",
  "financialFoundation.accounts.toast.created": "Account created",
  "financialFoundation.categories.heading": "Categories",
  "financialFoundation.categories.add": "Add Category",
  "financialFoundation.categories.dialogTitle": "Create Category",
  "financialFoundation.categories.toast.created": "Category created",
  "financialFoundation.activity.tableLabel": "Account activity (budget vs. invoiced)",
  "financialFoundation.activity.col.code": "Code",
  "financialFoundation.activity.col.name": "Name",
  "financialFoundation.activity.col.type": "Type",
  "financialFoundation.activity.col.budgeted": "Budgeted",
  "financialFoundation.activity.col.invoiced": "Invoiced",
  "financialFoundation.activity.col.variance": "Variance",
  "financialFoundation.activity.col.utilization": "Utilization",
  "financialFoundation.activity.col.invoices": "Invoices",
  "financialFoundation.approvals.toast.submitted": "Approval request submitted",
  "financialFoundation.approvals.toast.updated": "Approval updated",

  // ---------------------------------------------------------------------
  // 12. Financial Billing (`/app/financial/billing`)
  // ---------------------------------------------------------------------
  "financialBilling.title": "Billing",
  "financialBilling.summary":
    "Manage owner ledger entries, special assessments, late fee rules, and delinquency escalations.",
  "financialBilling.crumb": "Billing",
  "financialBilling.tabs.ledger": "Owner Ledger",
  "financialBilling.tabs.assessments": "Assessments",
  "financialBilling.tabs.lateFees": "Late Fees",
  "financialBilling.tabs.delinquency": "Delinquency",

  // ---------------------------------------------------------------------
  // 13. Recurring Charges (`/app/financial/recurring-charges`)
  // ---------------------------------------------------------------------
  "financialRecurring.title": "Recurring Charges",
  "financialRecurring.summary":
    "Define automatic charge schedules, run them on demand, and manage failed charge retries.",
  "financialRecurring.crumb": "Recurring Charges",

  // ---------------------------------------------------------------------
  // 14. Late Fees (`/app/financial/late-fees`)
  // ---------------------------------------------------------------------
  "financialLateFees.title": "Late Fees",
  "financialLateFees.summary":
    "Manage late fee rules, review applied fees, and recover delinquent balances through payment plans and collections handoffs.",
  "financialLateFees.crumb": "Late Fees",
  "financialLateFees.empty.noRules.title": "No late fee rules",
  "financialLateFees.empty.noEvents.title": "No fee events yet",
  "financialLateFees.confirm.applyTitle": "Apply late fees?",
  "financialLateFees.confirm.runEscalationTitle": "Run escalation scan?",

  // ---------------------------------------------------------------------
  // 15. Delinquency (`/app/financial/delinquency`)
  // ---------------------------------------------------------------------
  "financialDelinquency.tabs.escalations": "Active Escalations",
  "financialDelinquency.tabs.thresholds": "Threshold Config",
  "financialDelinquency.tabs.aging": "Aging",
  "financialDelinquency.tabs.notices": "Notices",
  "financialDelinquency.tabs.settings": "Settings",
  "financialDelinquency.confirm.scanTitle": "Run delinquency scan?",
  "financialDelinquency.confirm.runScan": "Run Scan",
  "financialDelinquency.action.runScan": "Run Delinquency Scan",
  "financialDelinquency.action.scanning": "Scanning...",
  "financialDelinquency.empty.noEscalations": "No escalations found",
  "financialDelinquency.empty.noThresholds": "No thresholds configured",
  "financialDelinquency.confirm.deleteThreshold": "Delete threshold?",
  "financialDelinquency.filter.allStatuses": "All statuses",
  "financialDelinquency.filter.active": "Active",
  "financialDelinquency.filter.onPaymentPlan": "On Plan",
  "financialDelinquency.filter.referred": "Referred",
  "financialDelinquency.filter.resolved": "Resolved",
  "financialDelinquency.summary.onPaymentPlan": "On Payment Plan",
  "financialDelinquency.summary.referred": "Referred",

  // ---------------------------------------------------------------------
  // 16. Payments (`/app/financial/payments`)
  // ---------------------------------------------------------------------
  "financialPayments.title": "Payments",
  "financialPayments.summary":
    "Configure how owners pay their dues — add payment methods, optionally connect an ACH gateway, and generate owner payment links.",
  "financialPayments.crumb": "Payments",
  "financialPayments.tab.methods": "Methods",
  "financialPayments.tab.gateway": "Gateway",
  "financialPayments.tab.gatewayOn": "Gateway On",
  "financialPayments.tab.links": "Links",
  "financialPayments.tab.autopay": "Autopay",

  // ---------------------------------------------------------------------
  // 17. Owner Ledger (`/app/financial/ledger`)
  // ---------------------------------------------------------------------
  "financialLedger.title": "Owner Ledger",
  "financialLedger.summary":
    "Post owner-ledger entries, review balances, and monitor collection risk within the active association scope.",
  "financialLedger.crumb": "Owner Ledger",
  "financialLedger.shortcut.openInvoices": "Open Invoices",
  "financialLedger.shortcut.openBudgets": "Open Budgets",

  // ---------------------------------------------------------------------
  // 18. Work Orders (`/app/operations/work-orders`)
  // ---------------------------------------------------------------------
  "workOrders.title": "Work Orders",
  "workOrders.summary": "Manage work orders and preventive maintenance schedules.",
  "workOrders.crumb": "Work Orders",
  "workOrders.tabs.workOrders": "Work Orders",
  "workOrders.tabs.maintenance": "Maintenance",

  // ---------------------------------------------------------------------
  // 19. Vendors (`/app/operations/vendors`)
  // ---------------------------------------------------------------------
  "vendors.title": "Vendors",
  "vendors.summary": "Manage vendors, compliance tracking, and inspection records.",
  "vendors.crumb": "Vendors",
  "vendors.tabs.vendors": "Vendors",
  "vendors.tabs.inspections": "Inspections",

  // ---------------------------------------------------------------------
  // 20. Meetings (`/app/board/meetings`)
  // ---------------------------------------------------------------------
  "meetings.title": "Meetings",
  "meetings.summary":
    "Schedule meetings, manage agendas, record minutes, and track resolutions.",
  "meetings.crumb": "Meetings",

  // ---------------------------------------------------------------------
  // 21. Elections (`/app/board/elections`)
  // ---------------------------------------------------------------------
  "elections.title": "Elections & Votes",
  "elections.summary":
    "Create and manage elections, referendums, and board votes for the association.",
  "elections.crumb": "Elections & Votes",

  // ---------------------------------------------------------------------
  // 22. Announcements (`/app/board/announcements`)
  // ---------------------------------------------------------------------
  "announcements.title": "Community Announcements",
  "announcements.summary":
    "Post announcements and bulletins visible to residents in the owner portal.",
  "announcements.crumb": "Announcements",

  // ---------------------------------------------------------------------
  // 23. Documents (`/app/documents`)
  // ---------------------------------------------------------------------
  "documents.title": "Documents",
  "documents.summary":
    "Upload, classify, and manage documents for the active association without losing workspace context.",
  "documents.crumb": "Documents",
  "documents.docTitle.documents": "Documents",
  "documents.docTitle.operations": "Operations Records",
  "documents.shortcut.openAssociationContext": "Open Association Context",
  "documents.shortcut.openCommunications": "Open Communications",
  "documents.action.upload": "Upload Document",
  "documents.dialog.uploadTitle": "Upload Document",

  // ---------------------------------------------------------------------
  // 24. People (`/app/persons`)
  // ---------------------------------------------------------------------
  "persons.title": "People",
  "persons.subtitle": "Owners, tenants, and board members across your associations.",
  "persons.action.addPerson": "Add Person",
  "persons.action.importCsv": "Import CSV",
  "persons.action.assignBoardRole": "Assign Board Role",
  "persons.dialog.importTitle": "Import People from CSV",
  "persons.dialog.newTitle": "New Person",
  "persons.dialog.editTitle": "Edit Person",
  "persons.dialog.assignBoardRoleTitle": "Assign Board Role",
  "persons.empty.noPeople.title": "No people yet",
  "persons.empty.noPeople.description":
    "People are the owners, tenants, and board members in your community. Click \"Add Person\" to create the first profile — then link them to units via the Ownership section.",
  "persons.empty.noMatches.title": "No matches",
  "persons.search.placeholder": "Search by name, email, or phone…",
  "persons.toast.createSuccess": "Person created successfully",
  "persons.toast.updateSuccess": "Person updated successfully",
  "persons.tableLabel": "People",

  // ---------------------------------------------------------------------
  // 25. Buildings & Units (`/app/units`)
  // ---------------------------------------------------------------------
  "units.title": "Buildings & Units",
  "units.docTitle": "Buildings & Units",
  "units.eyebrow": "Lease Workspace",
  "units.action.addBuilding": "Add Building",
  "units.action.addUnit": "Add Unit",
  "units.action.importCsv": "Import CSV",
  "units.dialog.newBuilding": "New Building",
  "units.dialog.newUnit": "New Unit",
  "units.dialog.editUnit": "Edit Unit",
  "units.dialog.buildingDetails": "Building Details",
  "units.snapshot.label": "Current Snapshot",
  "units.toast.buildingAdded": "Building added. You can now add units.",

  // ---------------------------------------------------------------------
  // 26. Insurance (`/app/insurance`)
  // ---------------------------------------------------------------------
  "insurance.title": "Insurance Policies",
  "insurance.summary":
    "Track association-level D&O, fidelity bond, master policy, and other insurance coverage with expiration alerts.",
  "insurance.eyebrow": "Compliance",
  "insurance.crumb": "Insurance Policies",
  "insurance.action.addPolicy": "Add Policy",
  "insurance.dialog.newTitle": "New Insurance Policy",
  "insurance.dialog.editTitle": "Edit Policy",
  "insurance.tableLabel": "Insurance policies",
  "insurance.empty.title": "No insurance policies",
  "insurance.empty.description":
    "Track liability, property, and umbrella policies here. Add your first policy above to start expiry-monitoring.",
  "insurance.empty.selectAssociation": "Select an association to view insurance policies.",
  "insurance.scope.active": "Showing insurance policies for the active association.",
  "insurance.scope.inactive": "Select an association to view or manage its insurance policies.",
  "insurance.col.type": "Type",
  "insurance.col.carrier": "Carrier",
  "insurance.col.policyNumber": "Policy #",
  "insurance.col.coverage": "Coverage",
  "insurance.col.expiration": "Expiration",
  "insurance.col.actions": "Actions",
  "insurance.section.policies": "Policies",

  // ---------------------------------------------------------------------
  // 27. Maintenance Schedules (`/app/maintenance-schedules`)
  // ---------------------------------------------------------------------
  "maintenanceSchedules.title": "Maintenance Schedules",
  "maintenanceSchedules.summary":
    "Manage recurring preventive maintenance templates, generate due instances, and convert them into work orders.",
  "maintenanceSchedules.eyebrow": "Operations",
  "maintenanceSchedules.crumb": "Maintenance Schedules",
  "maintenanceSchedules.action.newSchedule": "New Schedule",
  "maintenanceSchedules.action.registerAsset": "Register Asset",
  "maintenanceSchedules.dialog.newTitle": "Create Maintenance Schedule",
  "maintenanceSchedules.dialog.editTitle": "Edit Maintenance Schedule",
  "maintenanceSchedules.dialog.assetNewTitle": "Register Asset",
  "maintenanceSchedules.dialog.assetEditTitle": "Edit Asset",
  "maintenanceSchedules.stats.templates": "Templates",
  "maintenanceSchedules.stats.due": "Due instances",
  "maintenanceSchedules.stats.converted": "Converted",
  "maintenanceSchedules.templates.tableLabel": "Maintenance schedule templates",
  "maintenanceSchedules.instances.tableLabel": "Generated maintenance instances",
  "maintenanceSchedules.assets.tableLabel": "Asset registry",
  "maintenanceSchedules.assets.title": "Asset Registry",
  "maintenanceSchedules.assets.summary":
    "Track physical assets, service history, and replacement planning.",
  "maintenanceSchedules.empty.templates": "No maintenance schedules yet.",
  "maintenanceSchedules.empty.instances": "No generated schedule instances yet.",
  "maintenanceSchedules.empty.assets": "No assets registered yet.",
  "maintenanceSchedules.col.title": "Title",
  "maintenanceSchedules.col.component": "Component",
  "maintenanceSchedules.col.frequency": "Frequency",
  "maintenanceSchedules.col.nextDue": "Next Due",
  "maintenanceSchedules.col.status": "Status",
  "maintenanceSchedules.col.actions": "Actions",
  "maintenanceSchedules.col.scheduledWork": "Scheduled Work",
  "maintenanceSchedules.col.due": "Due",
  "maintenanceSchedules.col.workOrder": "Work Order",
  "maintenanceSchedules.col.asset": "Asset",
  "maintenanceSchedules.col.location": "Location",
  "maintenanceSchedules.col.condition": "Condition",
  "maintenanceSchedules.col.lastServiced": "Last Serviced",

  // ---------------------------------------------------------------------
  // 28. Inspections (`/app/inspections`)
  // ---------------------------------------------------------------------
  "inspections.title": "Inspection Records",
  "inspections.summary":
    "Record unit and common-area inspections, document findings, and turn follow-up items into work orders.",
  "inspections.eyebrow": "Operations",
  "inspections.crumb": "Inspection Records",
  "inspections.action.newInspection": "New Inspection",
  "inspections.dialog.newTitle": "Create Inspection",
  "inspections.dialog.editTitle": "Edit Inspection",
  "inspections.tableLabel": "Inspection records",
  "inspections.empty.records": "No inspection records yet.",
  "inspections.empty.findings": "No findings",
  "inspections.stats.records": "Inspection records",
  "inspections.stats.openFindings": "Open findings",
  "inspections.stats.linkedFindings": "Linked to work orders",
  "inspections.col.location": "Location",
  "inspections.col.type": "Type",
  "inspections.col.inspector": "Inspector",
  "inspections.col.condition": "Condition",
  "inspections.col.findings": "Findings",
  "inspections.col.inspected": "Inspected",
  "inspections.col.actions": "Actions",
  "inspections.action.addFinding": "Add Finding",
  "inspections.action.viewWorkOrder": "View Work Order",
  "inspections.action.createWorkOrder": "Create Work Order",

  // ---------------------------------------------------------------------
  // 29. Resident Feedback (`/app/resident-feedback`)
  // ---------------------------------------------------------------------
  "residentFeedback.title": "Resident Feedback",
  "residentFeedback.summary":
    "Monitor satisfaction scores, track feedback themes, and follow up with residents.",
  "residentFeedback.eyebrow": "Operations",
  "residentFeedback.crumb": "Resident Feedback",
  "residentFeedback.empty.selectAssociation":
    "Select an association to view feedback analytics.",
  "residentFeedback.empty.noResults": "No feedback found for the selected filters.",
  "residentFeedback.empty.byCategory": "No feedback yet.",
  "residentFeedback.stats.total": "Total Feedback",
  "residentFeedback.stats.avg": "Avg Satisfaction",
  "residentFeedback.stats.open": "Open Items",
  "residentFeedback.stats.resolved": "Resolved",
  "residentFeedback.section.scoreDistribution": "Score Distribution",
  "residentFeedback.section.byCategory": "Feedback by Category",
  "residentFeedback.tableLabel": "Resident feedback",
  "residentFeedback.col.subject": "Subject",
  "residentFeedback.col.category": "Category",
  "residentFeedback.col.score": "Score",
  "residentFeedback.col.submitter": "Submitter",
  "residentFeedback.col.status": "Status",
  "residentFeedback.col.date": "Date",
  "residentFeedback.col.actions": "Actions",
  "residentFeedback.dialog.noteTitle": "Add Admin Note",
  "residentFeedback.action.review": "Review",
  "residentFeedback.action.resolve": "Resolve",
  "residentFeedback.action.note": "Note",
  "residentFeedback.action.saveNote": "Save Note",
  "residentFeedback.filter.all": "All",
  "residentFeedback.filter.allCategories": "All categories",

  // ---------------------------------------------------------------------
  // 30. Executive Delivery Deck (`/app/admin/executive`)
  // ---------------------------------------------------------------------
  "executive.title": "Executive Delivery Deck",
  "executive.summary":
    "Slide format: one project per slide with a problem-solution-features table.",
  "executive.eyebrow": "Platform",
  "executive.crumb": "Executive Delivery Deck",
  "executive.action.createTemplate": "Create Slide Template",
  "executive.action.creating": "Creating...",
  "executive.action.sync": "Sync from Roadmap",
  "executive.action.syncing": "Syncing...",
  "executive.tabs.highlights": "Highlights Deck",
  "executive.tabs.defend": "Defend",
  "executive.empty.noSlides.title": "No project slides available yet",
  "executive.empty.noSlides.description":
    "Executive slides will appear here once the platform admin publishes the next quarterly review.",
  "executive.loading": "Loading executive slides...",
  "executive.col.problem": "Problem",
  "executive.col.solution": "Solution",
  "executive.col.features": "Features Delivered",
  "executive.empty.noFeatures": "No features listed.",
  "executive.deck.tableLabel": "Project problem, solution, and features",
  "executive.defend.title": "Defend Log",
  "executive.defend.description": "Attach proof points to the selected slide.",
  "executive.defend.entriesTitle": "Evidence Entries",
  "executive.defend.empty": "No evidence logged yet.",
  "executive.defend.action.add": "Add Evidence",
  "executive.defend.action.saving": "Saving...",
  "executive.defend.placeholder.label": "Label",
  "executive.defend.placeholder.value": "Value / URL / Metric",
  "executive.defend.placeholder.slide": "Select project slide",
  "executive.defend.option.selectSlide": "Select slide",
  "executive.action.prevSlide": "Previous slide",
  "executive.action.nextSlide": "Next slide",

  // ---------------------------------------------------------------------
  // 31. Admin Users (`/app/admin/users`)
  // ---------------------------------------------------------------------
  "adminUsers.title": "Admin Users",
  "adminUsers.summary":
    "Manage operator access, role changes, and activation state in a mobile-safe admin workflow.",
  "adminUsers.eyebrow": "Admin",
  "adminUsers.crumb": "Admin Users",
  "adminUsers.action.add": "Add Admin User",
  "adminUsers.dialog.title": "Create Admin User",
  "adminUsers.tableLabel": "Admin users and roles",
  "adminUsers.empty.title": "No admin users",
  "adminUsers.empty.description":
    "Create at least one admin user. Admin users manage associations, billing, and platform-level settings.",
  "adminUsers.col.email": "Email",
  "adminUsers.col.currentRole": "Current Role",
  "adminUsers.col.status": "Status",
  "adminUsers.col.updateRole": "Update Role",
  "adminUsers.col.reason": "Reason",
  "adminUsers.col.action": "Action",
  "adminUsers.label.email": "Email",
  "adminUsers.label.role": "Role",
  "adminUsers.label.active": "Active",
  "adminUsers.action.apply": "Apply",
  "adminUsers.action.applyChange": "Apply role change",

  // ---------------------------------------------------------------------
  // 32. Operations Dashboard (`/app/operations/dashboard`)
  // ---------------------------------------------------------------------
  "operationsDashboard.title": "Operations Overview",
  "operationsDashboard.summary":
    "Monitor active work, preventive maintenance pressure, vendor risk, and inspection follow-up from one operations view.",
  "operationsDashboard.eyebrow": "Operations",
  "operationsDashboard.crumb": "Operations Overview",
  "operationsDashboard.action.exportVendors": "Export Vendor Report",
  "operationsDashboard.action.exportWorkOrders": "Export Work Orders",
  "operationsDashboard.action.exportMaintenance": "Export Maintenance",
  "operationsDashboard.section.workOrderAging": "Work Order Aging",
  "operationsDashboard.section.vendorStatus": "Vendor Status",
  "operationsDashboard.section.recentInspections": "Recent Inspections",
  "operationsDashboard.section.recentWorkOrders": "Recent Work Orders",
  "operationsDashboard.section.dueInstances": "Due Maintenance Instances",
  "operationsDashboard.section.audit": "Operations Audit Trail",
  "operationsDashboard.section.nextActions": "Operations Next Actions",
  "operationsDashboard.empty.inspections": "No inspections yet.",
  "operationsDashboard.empty.workOrders": "No work orders yet.",
  "operationsDashboard.empty.dueInstances": "No due maintenance instances.",
  "operationsDashboard.empty.audit": "No operations audit entries yet.",
  "operationsDashboard.stat.openWorkOrders": "Open Work Orders",
  "operationsDashboard.stat.dueMaintenance": "Due Maintenance",
  "operationsDashboard.stat.openFindings": "Open Findings",
  "operationsDashboard.stat.activeVendors": "Active Vendors",
  "operationsDashboard.stat.renewalRisk": "Renewal Risk",
  "operationsDashboard.stat.overdueInstances": "Overdue Instances",

  // ---------------------------------------------------------------------
  // 33. AI Ingestion (`/app/ai-ingestion`)
  // ---------------------------------------------------------------------
  "aiIngestion.title": "AI Ingestion",
  "aiIngestion.summary":
    "Submit document ingestion jobs, review extracted records, and approve them into the canonical store.",
  "aiIngestion.eyebrow": "Platform",
  "aiIngestion.crumb": "AI Ingestion",
  "aiIngestion.tableLabel": "Ingestion jobs",
  "aiIngestion.recordsTableLabel": "Extracted records",

  // ---------------------------------------------------------------------
  // 34. Board Members (`/app/board`)
  // ---------------------------------------------------------------------
  "board.title": "Board Members",
  "board.summary": "Manage board positions for the current association context.",
  "board.eyebrow": "Board & Governance",
  "board.crumb": "Board",
  "board.tableLabel": "Board members",
  "board.action.assignRole": "Assign Role",
  "board.dialog.title": "Assign Board Role",
  "board.dialog.contextLabel": "Association Context:",
  "board.dialog.contextNone": "None selected",
  "board.field.person": "Person",
  "board.field.personPlaceholder": "Select person",
  "board.field.role": "Role",
  "board.field.rolePlaceholder": "Select role",
  "board.field.startDate": "Start Date",
  "board.field.endDate": "End Date",
  "board.field.inviteToWorkspace": "Invite to board workspace",
  "board.field.inviteToWorkspaceHint":
    "Creates or updates association-scoped portal access for this board member.",
  "board.field.inviteEmail": "Invite Email",
  "board.field.inviteEmailPlaceholder": "Uses person's email if blank",
  "board.empty.title": "No board members yet",
  "board.empty.body":
    "Board members govern the association. Click \"Assign Role\" to designate a person as President, Treasurer, Secretary, or Member. You'll need people created first — go to People > Add Person.",
  "board.col.member": "Member",
  "board.col.association": "Association",
  "board.col.role": "Role",
  "board.col.termStart": "Term Start",
  "board.col.termEnd": "Term End",
  "board.col.status": "Status",

  // ---------------------------------------------------------------------
  // 35. Board Packages (`/app/board/packages`)
  // ---------------------------------------------------------------------
  "boardPackages.title": "Board Packages",
  "boardPackages.summary":
    "Configure recurring board packet templates, generate draft packages by period, and schedule auto-generation relative to upcoming meetings.",
  "boardPackages.eyebrow": "Board & Governance",
  "boardPackages.crumb": "Board Packages",

  // ---------------------------------------------------------------------
  // 36. Governance Overview (`/app/governance`)
  // ---------------------------------------------------------------------
  "governance.title": "Governance",
  "governance.summary":
    "Manage meetings, board packages, elections, and compliance in one place.",
  "governance.eyebrow": "Board & Governance",
  "governance.crumb": "Governance",
  "governance.tabs.meetings": "Meetings",
  "governance.tabs.packages": "Board Packages",
  "governance.tabs.elections": "Elections",
  "governance.tabs.compliance": "Compliance",

  // ---------------------------------------------------------------------
  // 37. Community Hub (Public) (`/community/:identifier`)
  // ---------------------------------------------------------------------
  "communityHubPublic.title": "Community Hub",
  "communityHubPublic.loading": "Loading community hub...",
  "communityHubPublic.error.title": "Community Hub Not Found",
  "communityHubPublic.error.body":
    "This community hub doesn't exist or hasn't been enabled yet.",

  // ---------------------------------------------------------------------
  // Wave 42 — public marketing brochure (3 surfaces)
  //
  // Static UI copy only. Dynamic content (tier prices loaded from the
  // pricing strategy doc / API, plan-name labels driven by Stripe lookup)
  // intentionally stays inline.
  // ---------------------------------------------------------------------

  // Shared marketing chrome (top-nav, mobile menu, persona toggle, common CTAs).
  "marketing.brand": "Your Condo Manager",
  "marketing.skipToContent": "Skip to main content",
  "marketing.nav.label": "Main navigation",
  "marketing.nav.platform": "Platform",
  "marketing.nav.solutions": "Solutions",
  "marketing.nav.pricing": "Pricing",
  "marketing.nav.toggleMenu": "Toggle menu",
  "marketing.cta.signIn": "Sign In",
  "marketing.cta.openWorkspace": "Open Workspace",
  "marketing.cta.startFreeTrial": "Start Free Trial",
  "marketing.persona.manager": "Property Managers",
  "marketing.persona.board": "Board Members",
  "marketing.persona.resident": "Residents",

  // ---------------------------------------------------------------------
  // 38. Landing (`/`)
  // ---------------------------------------------------------------------
  "landing.hero.eyebrow": "Architecture of Trust",
  "landing.hero.headlineLead": "Everything your association needs.",
  "landing.hero.headlineEmphasis": "Nothing it doesn't.",
  "landing.hero.subhead":
    "The definitive platform for modern property governance. Streamline operations, empower boards, and engage residents with structural clarity.",
  "landing.hero.cta.primary": "Get Started Free",
  "landing.hero.cta.secondary": "Schedule Demo",
  "landing.hero.image.alt":
    "Modern architectural glass facade reflecting a clear blue sky with sophisticated structural lines and high-end professional aesthetic",

  "landing.persona.toggleLabel": "Tailored for you:",
  "landing.persona.whyPrefix": "Why",

  // Persona — board (default)
  "landing.persona.board.badge": "For self-managed condo boards",
  "landing.persona.board.headline":
    "Give your board the tools to govern with confidence.",
  "landing.persona.board.subhead":
    "Your Condo Manager gives volunteer boards everything needed to handle finances, governance, residents, and maintenance — without expensive management fees or complicated software.",
  "landing.persona.board.ctaPrimary": "Start managing your association",
  "landing.persona.board.ctaSecondary": "See what's included",
  "landing.persona.board.feature.finances.title": "Clear, simple finances",
  "landing.persona.board.feature.finances.body":
    "Collect assessments, track expenses, manage budgets, and produce statements your board and owners can actually understand.",
  "landing.persona.board.feature.governance.title": "Governance made easy",
  "landing.persona.board.feature.governance.body":
    "Store governing documents, track board decisions, manage meeting minutes, and stay compliant — all in one place.",
  "landing.persona.board.feature.portal.title": "Owner & resident portal",
  "landing.persona.board.feature.portal.body":
    "Give owners a portal to view their account, pay dues, and access documents without calling a board member.",
  "landing.persona.board.feature.maintenance.title": "Maintenance tracking",
  "landing.persona.board.feature.maintenance.body":
    "Log work orders, track vendor activity, and build maintenance schedules so nothing falls through the cracks.",
  "landing.persona.board.proof.1": "No property management experience required",
  "landing.persona.board.proof.2": "Designed for board volunteers, not accountants",
  "landing.persona.board.proof.3": "Residents stay informed automatically",
  "landing.persona.board.proof.4": "All your records in one secure place",

  // Persona — manager
  "landing.persona.manager.badge": "For property management companies",
  "landing.persona.manager.headline":
    "Run your entire portfolio from one command center.",
  "landing.persona.manager.subhead":
    "Your Condo Manager gives property managers a single platform for every association — billing, owners, maintenance, governance, and reporting — without the spreadsheets.",
  "landing.persona.manager.ctaPrimary": "Get started — it's free",
  "landing.persona.manager.ctaSecondary": "Schedule a demo",
  "landing.persona.manager.feature.visibility.title": "Portfolio-wide visibility",
  "landing.persona.manager.feature.visibility.body":
    "See every association's financial health, open work orders, and compliance status at a glance. Drill into any property in one click.",
  "landing.persona.manager.feature.billing.title": "Automated billing & ledger",
  "landing.persona.manager.feature.billing.body":
    "Run assessments, late fees, utility billing, and recurring charges across all properties. Keep every ledger clean and audit-ready.",
  "landing.persona.manager.feature.reporting.title": "Board-ready reporting",
  "landing.persona.manager.feature.reporting.body":
    "Generate financial reports, board packages, and meeting minutes without exporting to a third tool.",
  "landing.persona.manager.feature.team.title": "Role-based team access",
  "landing.persona.manager.feature.team.body":
    "Invite your whole team with scoped permissions per association — no shared passwords, no access sprawl.",
  "landing.persona.manager.proof.1": "Manage dozens of associations from one login",
  "landing.persona.manager.proof.2": "Role-based access for your whole team",
  "landing.persona.manager.proof.3": "No per-association setup headaches",
  "landing.persona.manager.proof.4": "Consistent workflow across every property",

  // Persona — resident
  "landing.persona.resident.badge": "For residents & homeowners",
  "landing.persona.resident.headline":
    "Stay connected and in control of your home.",
  "landing.persona.resident.subhead":
    "Access your account, pay dues online, track maintenance requests, and stay informed about your community — all without making a phone call.",
  "landing.persona.resident.ctaPrimary": "Access your portal",
  "landing.persona.resident.ctaSecondary": "Learn more",
  "landing.persona.resident.feature.pay.title": "Pay dues online",
  "landing.persona.resident.feature.pay.body":
    "View your account balance, pay assessments, and download statements from any device, any time.",
  "landing.persona.resident.feature.requests.title": "Submit & track requests",
  "landing.persona.resident.feature.requests.body":
    "Create maintenance requests and follow their status in real time — no chasing the board down.",
  "landing.persona.resident.feature.documents.title": "Community documents",
  "landing.persona.resident.feature.documents.body":
    "Access bylaws, meeting minutes, rules, and notices whenever you need them, all in one place.",
  "landing.persona.resident.feature.informed.title": "Stay informed",
  "landing.persona.resident.feature.informed.body":
    "Receive announcements, board updates, and community news delivered straight to you.",
  "landing.persona.resident.proof.1": "Pay dues anytime, from any device",
  "landing.persona.resident.proof.2": "No more chasing the board for information",
  "landing.persona.resident.proof.3": "Your full account history always accessible",
  "landing.persona.resident.proof.4": "Stay in the loop on community updates",

  // Bento grid
  "landing.bento.heading": "Integrated Excellence",
  "landing.bento.subhead":
    "Professional tools designed for the complexities of modern estates.",
  "landing.bento.dues.title": "Automated Dues",
  "landing.bento.dues.body":
    "Collect payments and generate late notices without manual intervention.",
  "landing.bento.maintenance.title": "Maintenance Hub",
  "landing.bento.maintenance.body":
    "Track work orders from submission to completion. Manage vendors and schedule recurring maintenance in one place.",
  "landing.bento.archives.title": "Smart Archives",
  "landing.bento.archives.body":
    "Store and retrieve governing documents, meeting minutes, and notices — organized, accessible, and always up to date.",
  "landing.bento.comms.title": "Mass Comms",
  "landing.bento.comms.body":
    "Send announcements, notices, and updates to all residents or targeted groups via email — directly from the platform.",
  "landing.bento.reporting.title": "Real-time Financial Reporting",
  "landing.bento.reporting.body":
    "Generate balance sheets, income statements, and budget comparisons with a single click. No more waiting for end-of-month reconciliations.",
  "landing.bento.reporting.cta": "Explore Analytics",
  "landing.bento.voting.title": "Board Vote Tracking",
  "landing.bento.voting.body":
    "Record resolutions, track votes, and confirm quorum during board meetings — with a complete audit trail.",
  "landing.bento.inspections.title": "Inspections & Schedules",
  "landing.bento.inspections.body":
    "Schedule and track property inspections, log findings, and manage recurring maintenance across all your buildings.",

  // Compliance / security panel
  "landing.compliance.audit.title": "Always Audit-Ready",
  "landing.compliance.audit.body":
    "Every transaction, vote, and communication is timestamped and immutable. Your Condo Manager ensures your association meets state regulations effortlessly.",
  "landing.compliance.access.title": "Secure Institutional Access",
  "landing.compliance.access.body":
    "Bank-grade encryption and 2FA protect sensitive owner data. Granular permissions ensure board members only see what they need to.",
  "landing.compliance.log.label": "Security Log",
  "landing.compliance.log.statusActive": "ACTIVE",

  // Final CTA
  "landing.finalCta.title": "Ready to elevate your association?",
  "landing.finalCta.body":
    "The modern platform for condo and HOA associations — built to handle finances, governance, residents, and maintenance in one place.",
  "landing.finalCta.viewPricing": "View pricing",
  "landing.finalCta.startTrial": "Start Your Free Trial",
  "landing.finalCta.speakExpert": "Speak with an Expert",

  // ---------------------------------------------------------------------
  // 39. Pricing (`/pricing`)
  // ---------------------------------------------------------------------
  "pricing.hero.eyebrow": "Simple, Transparent Pricing",
  "pricing.hero.headlineLead": "Run your association",
  "pricing.hero.headlineEmphasis": "without a property manager.",
  "pricing.hero.subhead":
    "Flat monthly pricing per association. No per-unit fees, no contracts, no surprises. Built for self-managed boards who want a real system — not another spreadsheet.",

  "pricing.cards.popular": "Most Popular",
  "pricing.cards.perMonth": "/month",
  "pricing.cards.startTrial14": "Start 14-Day Free Trial",
  "pricing.cards.startTrial": "Start Free Trial",
  "pricing.cards.contactSales": "Contact Sales",

  "pricing.cards.selfManaged.name": "Self-Managed",
  "pricing.cards.selfManaged.tagline":
    "For self-managed Boards & Condo Associations.",
  "pricing.cards.selfManaged.tierLowLabel": "Under 30 units:",
  "pricing.cards.selfManaged.tierHighLabel": "30 units or more:",
  "pricing.cards.selfManaged.feeNote": "Per association. No per-unit fees.",
  "pricing.cards.selfManaged.feature.portal": "Owner Portal with payment history",
  "pricing.cards.selfManaged.feature.dues":
    "Automated dues & assessment collection",
  "pricing.cards.selfManaged.feature.maintenance":
    "Maintenance request tracking",
  "pricing.cards.selfManaged.feature.documents":
    "Document management & board packages",
  "pricing.cards.selfManaged.feature.governance":
    "Governance meeting & compliance tools",

  "pricing.cards.propertyManager.name": "Property Manager",
  "pricing.cards.propertyManager.tagline": "For growing management firms.",
  "pricing.cards.propertyManager.feature.scope": "Manage 5–10 Associations",
  "pricing.cards.propertyManager.feature.dashboard":
    "Multi-Portfolio Dashboard",
  "pricing.cards.propertyManager.feature.vendor": "Vendor Marketplace Access",
  "pricing.cards.propertyManager.feature.assets":
    "Advanced Asset Management",
  "pricing.cards.propertyManager.feature.reporting":
    "Bulk Reporting & Exports",

  "pricing.cards.enterprise.name": "Enterprise",
  "pricing.cards.enterprise.tagline":
    "Bespoke solutions for large portfolios.",
  "pricing.cards.enterprise.priceCustom": "Custom",
  "pricing.cards.enterprise.feature.scope": "10+ Associations",
  "pricing.cards.enterprise.feature.success":
    "Dedicated Success Manager",
  "pricing.cards.enterprise.feature.app": "White-label Resident App",
  "pricing.cards.enterprise.feature.api": "API & Custom Integrations",

  "pricing.compare.heading": "Plan Comparison",
  "pricing.compare.col.capability": "Capability",
  "pricing.compare.col.selfManaged": "Self-Managed",
  "pricing.compare.col.propertyManager": "Property Manager",
  "pricing.compare.col.enterprise": "Enterprise",
  "pricing.compare.row.associations": "Associations",
  "pricing.compare.row.unitPricing": "Unit Pricing",
  "pricing.compare.row.multiPortfolio": "Multi-Portfolio View",
  "pricing.compare.row.residentApp": "Resident App",
  "pricing.compare.row.api": "API Access",
  "pricing.compare.row.support": "Support",
  "pricing.compare.value.standardized": "Standardized",
  "pricing.compare.value.customized": "Customized",
  "pricing.compare.value.standardApp": "Standard",
  "pricing.compare.value.whitelabelApp": "White-label available",
  "pricing.compare.value.helpCenter": "Help Center",
  "pricing.compare.value.priorityChat": "Priority Email / Chat",
  "pricing.compare.value.dedicated": "Dedicated Account Manager",

  "pricing.trust.security.title": "Unrivaled Security.",
  "pricing.trust.security.body":
    "Your association data is protected by bank-grade encryption and regional compliance standards. We take the burden of trust off your shoulders.",
  "pricing.trust.security.gdpr": "GDPR Ready",
  "pricing.trust.security.soc2": "SOC 2 Type II",
  "pricing.trust.uptime.title": "99.9% Uptime",
  "pricing.trust.uptime.body":
    "Our infrastructure is built on distributed cloud systems, ensuring your portal is always live for residents.",
  "pricing.trust.setup.title.line1": "Setup in",
  "pricing.trust.setup.title.line2": "Minutes",
  "pricing.trust.integrate.title.line1": "Integrate",
  "pricing.trust.integrate.title.line2": "Anywhere",

  "pricing.finalCta.title": "Ready to stop managing on spreadsheets?",
  "pricing.finalCta.body":
    "Your Condo Manager gives self-managed boards a real system of record — dues collection, owner portal, maintenance tracking, and governance tools in one place. No property manager required.",
  "pricing.finalCta.startTrial": "Start 14-Day Free Trial",
  "pricing.finalCta.scheduleDemo": "Schedule a Demo",

  // ---------------------------------------------------------------------
  // 40. Solutions (`/solutions`)
  // ---------------------------------------------------------------------
  "solutions.hero.eyebrow": "Our Solutions",
  "solutions.hero.headlineLead": "The Infrastructure of",
  "solutions.hero.headlineEmphasis": "Modern Excellence.",
  "solutions.hero.subhead":
    "Your Condo Manager provides the architectural framework for high-performance property ecosystems—from independent boards to global management firms.",
  "solutions.hero.scrollHint": "SCROLL TO EXPLORE",

  "solutions.persona.toggleLabel": "Choose your solution:",

  // Section — board (self-managed associations)
  "solutions.board.headline.line1": "Self-Managed",
  "solutions.board.headline.line2": "Associations",
  "solutions.board.body":
    "Empower your board with professional-grade tools designed for simplicity and total transparency. We remove the friction of community governance.",
  "solutions.board.feature.dues.title": "Dues Collection",
  "solutions.board.feature.dues.body":
    "Automated, secure digital payments with real-time delinquency tracking.",
  "solutions.board.feature.maintenance.title": "Maintenance Hubs",
  "solutions.board.feature.maintenance.body":
    "Centralized ticketing for common areas and private unit requests.",
  "solutions.board.feature.voting.title": "Digital Voting",
  "solutions.board.feature.voting.body":
    "Legally-compliant proxy voting and secure community polls.",
  "solutions.board.image.alt": "Modern architectural detail",

  // Section — manager (property management companies)
  "solutions.manager.eyebrow": "Enterprise Scale",
  "solutions.manager.headline.line1": "Property Management",
  "solutions.manager.headline.line2": "Companies",
  "solutions.manager.subhead":
    "Sophisticated multi-entity management for firms that demand precision, scalability, and institutional-grade reporting.",
  "solutions.manager.reporting.title": "Centralized Reporting",
  "solutions.manager.reporting.body":
    "Aggregate financial data across your entire portfolio. Generate board-ready reports in seconds with customizable KPIs.",
  "solutions.manager.reporting.image.alt": "Data visualization",
  "solutions.manager.accounting.title.line1": "Multi-Entity",
  "solutions.manager.accounting.title.line2": "Accounting",
  "solutions.manager.accounting.body":
    "Robust GL, automated bank recs, and segmented financial tracking for every association under management.",
  "solutions.manager.accounting.cta": "Learn about Security",
  "solutions.manager.vendor.title": "Vendor Management",
  "solutions.manager.vendor.body":
    "Streamline procurement and work orders with integrated compliance tracking and automated COI monitoring.",
  "solutions.manager.comms.title": "Automated Communications",
  "solutions.manager.comms.body":
    "Broadcast notifications via SMS, email, and app push across all properties simultaneously.",

  // Section — resident (modern resident journey)
  "solutions.resident.eyebrow": "Resident Experience",
  "solutions.resident.headline": "The Modern Resident Journey",
  "solutions.resident.body":
    "Property management is no longer just about maintenance; it's about hospitality. Provide your residents with a high-touch digital experience that enhances their lifestyle.",
  "solutions.resident.image.alt": "Resident using mobile app",
  "solutions.resident.booking.label": "Upcoming Booking",
  "solutions.resident.booking.title": "Rooftop Lounge",
  "solutions.resident.booking.time": "Today at 7:00 PM",
  "solutions.resident.feature.amenity.title": "Amenity Booking",
  "solutions.resident.feature.amenity.body":
    "Real-time scheduling for pools, gyms, and party rooms with integrated guest management.",
  "solutions.resident.feature.payments.title": "One-Touch Payments",
  "solutions.resident.feature.payments.body":
    "A seamless mobile-first wallet for recurring dues, guest parking, and on-demand services.",
  "solutions.resident.feature.bulletin.title": "Community Bulletin",
  "solutions.resident.feature.bulletin.body":
    "A curated digital space for local announcements, community classifieds, and verified social groups.",

  // Final CTA
  "solutions.finalCta.title": "Ready to elevate your estate?",
  "solutions.finalCta.body":
    "Join the leading properties that have standardized their operations on Your Condo Manager.",
  "solutions.finalCta.requestDemo": "Request a Demo",
  "solutions.finalCta.requestDemoAria":
    "Request a demo of Your Condo Manager solutions",
  "solutions.finalCta.viewPricing": "View Pricing",
  "solutions.finalCta.viewPricingAria":
    "View Your Condo Manager pricing",
} as const;

export type StringKey = keyof typeof strings;
