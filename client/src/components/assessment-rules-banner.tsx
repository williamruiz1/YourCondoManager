// zone: Financials (cross-cutting)
//
// 4.3 Wave 8 — legacy redirect banner.
//
// Shown on /app/financial/foundation and /app/financial/billing to direct
// users to the new consolidated /app/financial/rules surface. Dismissal is
// persisted in localStorage so the notice does not nag across sessions. The
// underlying surfaces keep working for this release cycle; the 5.1 cleanup
// wave will physically retire them.
//
// Spec anchor: decisions/4.3-recurring-assessment-rules-engine.md#q9.

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ASSESSMENT_RULES_BANNER_STORAGE_KEY = "ycm:banner:assessment-rules-moved";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ASSESSMENT_RULES_BANNER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASSESSMENT_RULES_BANNER_STORAGE_KEY, "1");
  } catch {
    /* storage disabled — silently ignore; banner returns next load. */
  }
}

export function AssessmentRulesBanner() {
  // Default to true so the banner flashes in only after the localStorage
  // check resolves — avoids a layout shift for users who have dismissed it.
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  if (dismissed) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border border-amber-200/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
      data-testid="assessment-rules-banner"
      role="status"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex-1 min-w-0">
          Assessment rules have moved to{" "}
          <Link
            href="/app/financial/rules"
            className="font-medium underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
            data-testid="assessment-rules-banner-link"
          >
            Assessment Rules
            <ArrowRight className="inline h-3 w-3 ml-0.5" aria-hidden="true" />
          </Link>
          . This page will redirect in an upcoming release.
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 -mr-1 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
        onClick={() => {
          writeDismissed();
          setDismissed(true);
        }}
        aria-label="Dismiss notice"
        data-testid="assessment-rules-banner-dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
