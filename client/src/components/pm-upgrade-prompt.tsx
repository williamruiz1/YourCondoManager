/**
 * PmUpgradePrompt — Self-managed → PM-tier upgrade modal (4.4 Q6 sub-question,
 * Wave 13).
 *
 * Spec (decisions/4.4-signup-and-checkout-flow.md Q6, 2026-04-24):
 *   Fires when a Manager on the self-managed plan creates a second association.
 *   Soft prompt — dismissable, NOT a hard block. If dismissed, a localStorage
 *   key (`ycm:pm-upgrade-prompt-dismissed`) prevents re-prompting on subsequent
 *   association creates.
 *
 * "Upgrade" CTA → POST /api/admin/billing/portal-session, opens Stripe Customer
 * Portal in a new tab. "Not now" persists the dismiss key and closes the modal.
 *
 * Parent controls visibility via the `open` prop. The modal itself doesn't know
 * how many associations exist — that check lives in the parent (typically on
 * the /app/new-association success handler or the /app/associations list on
 * count-change).
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const PM_UPGRADE_DISMISSED_KEY = "ycm:pm-upgrade-prompt-dismissed";

export function hasPmUpgradePromptBeenDismissed(): boolean {
  try {
    return localStorage.getItem(PM_UPGRADE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissPmUpgradePrompt() {
  try {
    localStorage.setItem(PM_UPGRADE_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

type PmUpgradePromptProps = {
  open: boolean;
  onClose: () => void;
};

export function PmUpgradePrompt({ open, onClose }: PmUpgradePromptProps) {
  async function handleUpgrade() {
    try {
      const res = await fetch("/api/admin/billing/portal-session", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const { url } = (await res.json()) as { url?: string };
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      /* ignore — user can retry via /app/settings/billing */
    }
    dismissPmUpgradePrompt();
    onClose();
  }

  function handleDismiss() {
    dismissPmUpgradePrompt();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent data-testid="pm-upgrade-prompt" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Managing more than one association?</DialogTitle>
          <DialogDescription>
            You just created a second association. The Property Manager plan is designed for
            portfolios of multiple HOAs, condos, and co-ops — with a single flat price instead
            of per-association billing. You can review the plan details and switch in the
            Stripe Customer Portal.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            data-testid="pm-upgrade-dismiss"
          >
            Not now
          </Button>
          <Button onClick={handleUpgrade} data-testid="pm-upgrade-accept">
            Review Property Manager plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
