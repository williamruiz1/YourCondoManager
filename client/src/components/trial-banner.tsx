import { useState } from "react";
import { format, differenceInDays } from "date-fns";

type TrialBannerProps = {
  trialEndsAt: string | null;
  plan: string;
  onUpgrade: () => void;
};

const DISMISS_KEY_PREFIX = "trial-banner-dismissed-";

function todayKey() {
  return DISMISS_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

export function TrialBanner({ trialEndsAt, onUpgrade }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(todayKey()) === "1"; } catch { return false; }
  });

  if (dismissed || !trialEndsAt) return null;

  const endsAt = new Date(trialEndsAt);
  const daysLeft = differenceInDays(endsAt, new Date());
  if (daysLeft < 0) return null;

  function dismiss() {
    try { localStorage.setItem(todayKey(), "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-amber-600 text-[18px] flex-shrink-0">schedule</span>
        <p className="text-sm font-body">
          Your free trial ends on <strong>{format(endsAt, "MMM d, yyyy")}</strong>
          {daysLeft === 0 ? " — today is the last day." : ` — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining.`}
          {" "}Add a payment method to keep access.
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onUpgrade}
          className="bg-amber-600 text-white text-xs font-bold font-body px-3 py-1.5 rounded-md hover:bg-amber-700 transition-colors"
        >
          Upgrade Now
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss trial banner"
          className="text-amber-700 hover:text-amber-900 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}
