// zone: shared (i18n registry)
//
// 5.6 — i18n scaffolding (Wave 21).
//
// Spec: docs/projects/platform-overhaul/decisions/5.6-i18n-scaffolding.md
//
// This module is the canonical English string registry for the top-10
// surfaces extracted in Wave 21. Translation modules (`strings.es.ts`,
// `strings.fr.ts`, …) are introduced in a later wave when the product
// commits to a localized release. For Wave 21 we extract only — no
// translation, no i18next dependency, no plural / interpolation engine.
//
// Keys are flat dotted strings using the convention `<surface>.<context>.<element>`
// e.g. `home.alerts.title`, `inbox.tab.unread`, `portal.home.greeting`.
//
// Surfaces in scope (10):
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
    "14-day free trial · 7-day grace window after trial ends before workspace is locked. Add a payment method in the Stripe Customer Portal to continue uninterrupted.",

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
} as const;

export type StringKey = keyof typeof strings;
