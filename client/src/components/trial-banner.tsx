/**
 * TrialBanner — Home zone trial-status banner (4.4 Q5, Wave 13).
 *
 * Spec (decisions/4.4-signup-and-checkout-flow.md Q5, 2026-04-24):
 *   - Visible when platformSubscriptions.status === "trialing" and a valid
 *     trialEndsAt is set.
 *   - Single trial-status surface — sidebar is NOT decorated with trial
 *     state. The settings-level detail lives at /app/settings/billing.
 *   - Dismiss is **per-session** (sessionStorage) — not per-day and not
 *     per-user. Clearing the session (logout, tab close, or token expiry)
 *     restores the banner on next load.
 *   - Upgrade CTA opens Stripe Customer Portal (via onUpgrade prop) in a
 *     new tab — the wrapper in App.tsx handles the window.open.
 */

import { useState } from "react";
import { format, differenceInDays } from "date-fns";

type TrialBannerProps = {
  trialEndsAt: string | null;
  plan: string;
  onUpgrade: () => void;
};

// 4.4 Q5 (Wave 13) — session-scoped dismiss. sessionStorage clears on tab
// close or explicit logout, which is the intended re-prompt cadence.
const DISMISS_KEY = "ycm:trial-banner-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function TrialBanner({ trialEndsAt, onUpgrade }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());

  if (dismissed || !trialEndsAt) return null;

  const endsAt = new Date(trialEndsAt);
  const daysLeft = differenceInDays(endsAt, new Date());
  if (daysLeft < 0) return null;

  function dismiss() {
    writeDismissed();
    setDismissed(true);
  }

  return (
    <div
      data-testid="trial-banner"
      className="bg-amber-50 border-b border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200 px-4 py-2.5 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[18px] flex-shrink-0">schedule</span>
        <p className="text-sm font-body">
          Your free trial ends on <strong>{format(endsAt, "MMM d, yyyy")}</strong>
          {daysLeft === 0 ? " — today is the last day." : ` — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining.`}
          {" "}Add a payment method to keep access.
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          data-testid="trial-banner-upgrade"
          onClick={onUpgrade}
          className="bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950 text-xs font-bold font-body px-3 py-1.5 rounded-md hover:bg-amber-700 dark:hover:bg-amber-400 transition-colors"
        >
          Upgrade Now
        </button>
        <button
          data-testid="trial-banner-dismiss"
          onClick={dismiss}
          aria-label="Dismiss trial banner"
          className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}
