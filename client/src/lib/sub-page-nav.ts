import type { SubPage } from "@/components/workspace-page-header";

export const financeSubPages: SubPage[] = [
  { label: "Chart of Accounts", href: "/app/financial/foundation" },
  { label: "Billing", href: "/app/financial/billing" },
  { label: "Payments", href: "/app/financial/payments" },
  { label: "Expenses", href: "/app/financial/expenses" },
  { label: "Reports", href: "/app/financial/reports" },
];

export const operationsSubPages: SubPage[] = [
  { label: "Dashboard", href: "/app/operations/dashboard" },
  { label: "Work Orders", href: "/app/work-orders" },
  { label: "Maintenance", href: "/app/maintenance-schedules" },
  { label: "Inspections", href: "/app/inspections" },
  { label: "Vendors", href: "/app/vendors" },
  { label: "Feedback", href: "/app/resident-feedback" },
];

export const platformSubPages: SubPage[] = [
  { label: "Controls", href: "/app/platform/controls" },
  { label: "Admin Users", href: "/app/admin/users" },
  { label: "Executive", href: "/app/admin/executive" },
  { label: "Roadmap", href: "/app/admin/roadmap" },
];

export const boardGovernanceSubPages: SubPage[] = [
  { label: "Board", href: "/app/board" },
  { label: "Governance", href: "/app/governance" },
  { label: "Communications", href: "/app/communications" },
  { label: "Announcements", href: "/app/announcements" },
];
