import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

type FinanceTab = {
  label: string;
  href: string;
  prefix: string;
};

const TABS: FinanceTab[] = [
  { label: "Overview", href: "/app/financial/foundation", prefix: "/app/financial/foundation" },
  { label: "Fee Schedules", href: "/app/financial/recurring-charges", prefix: "/app/financial/recurring-charges" },
  { label: "Assessments", href: "/app/financial/assessments", prefix: "/app/financial/assessments" },
  { label: "Late Fees", href: "/app/financial/late-fees", prefix: "/app/financial/late-fees" },
  { label: "Utilities", href: "/app/financial/utilities", prefix: "/app/financial/utilities" },
  { label: "Ledger", href: "/app/financial/ledger", prefix: "/app/financial/ledger" },
  { label: "Invoices", href: "/app/financial/invoices", prefix: "/app/financial/invoices" },
  { label: "Payments", href: "/app/financial/payments", prefix: "/app/financial/payments" },
  { label: "Budgets", href: "/app/financial/budgets", prefix: "/app/financial/budgets" },
  { label: "Reports", href: "/app/financial/reports", prefix: "/app/financial/reports" },
  { label: "Reconciliation", href: "/app/financial/reconciliation", prefix: "/app/financial/reconciliation" },
];

export function FinanceTabBar() {
  const [location] = useLocation();

  return (
    <div className="border-b border-border bg-background">
      <div className="px-6 overflow-x-auto">
        <nav className="flex gap-0 min-w-max" aria-label="Finance sections">
          {TABS.map((tab) => {
            const isActive = location.startsWith(tab.prefix);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
