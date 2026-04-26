/**
 * PmUpgradePrompt — Self-managed dual-path "add another HOA" modal.
 *
 * Spec evolution:
 *   Wave 13 (4.4 Q6, 2026-04-24): single-CTA "upgrade to PM tier" prompt.
 *   Wave 39 (4.4 Q5/Q6, 2026-04-26): founder-ratified per-HOA self-managed
 *     billing model. Self-managed = N subscriptions, one per association
 *     (uniqueIndex on `platformSubscriptions.associationId`). PM = one
 *     subscription, multiple HOAs (consolidated billing).
 *
 *   The prompt now offers TWO paths:
 *
 *     1. Primary  — "Add this HOA on the self-managed plan"
 *                   Continues the per-HOA self-managed signup flow. Lands
 *                   the user on `/signup?plan=self-managed&context=add`
 *                   (account context is carried by the existing session).
 *
 *     2. Secondary — "Switch to Property Manager (consolidated billing)"
 *                    Opens Stripe Customer Portal so the user can
 *                    upgrade their existing self-managed subscription to
 *                    the PM tier. PM tier covers multiple HOAs under one
 *                    subscription.
 *
 *   Both paths are soft — modal is dismissable. Dismissal persists via
 *   the existing localStorage key (`ycm:pm-upgrade-prompt-dismissed`).
 *
 *   Parent controls visibility via the `open` prop. The modal itself
 *   doesn't know how many associations exist — that check lives in the
 *   parent (typically on the /app/new-association success handler or the
 *   /app/associations list on count-change).
 *
 * Known gap (filed as follow-up workitem in Wave 39):
 *   `/api/public/signup/start` rejects logged-in users by email collision
 *   (server/routes.ts:13977-13978). Adding a 2nd self-managed HOA from a
 *   logged-in account requires either a new endpoint or relaxing that
 *   check. Out of scope for this PR — see PPM follow-up.
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
  // Secondary path — PM-tier consolidated billing via Stripe Customer Portal.
  async function handleSwitchToPm() {
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

  // Primary path — add another self-managed subscription (per-HOA model).
  // Lands on the standard /signup self-managed flow; the same flow used
  // for the user's first HOA. Context flag lets the signup page know
  // we're adding a 2nd+ HOA so it can pre-fill from session.
  function handleAddSelfManaged() {
    dismissPmUpgradePrompt();
    onClose();
    window.location.href = "/signup?plan=self-managed&context=add";
  }

  function handleDismiss() {
    dismissPmUpgradePrompt();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent data-testid="pm-upgrade-prompt" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add another HOA — pick a billing approach</DialogTitle>
          <DialogDescription>
            Self-managed billing is per-HOA. You can add another HOA on the same
            self-managed plan, or consolidate billing across all your HOAs by
            switching to the Property Manager plan.
          </DialogDescription>
        </DialogHeader>

        {/* Trade-off summary — kept brief; detail lives in /app/settings/billing. */}
        <div className="grid gap-3 sm:grid-cols-2 mt-2">
          <div className="rounded-lg border border-border p-3 text-sm font-body">
            <p className="font-semibold text-on-surface mb-1">Self-managed</p>
            <p className="text-on-surface/70 leading-snug">
              Per-HOA pricing · familiar workflow · best for 1–2 HOAs.
            </p>
          </div>
          <div className="rounded-lg border border-border p-3 text-sm font-body">
            <p className="font-semibold text-on-surface mb-1">Property Manager</p>
            <p className="text-on-surface/70 leading-snug">
              Consolidated billing across all your HOAs · better at 3+ HOAs.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            data-testid="pm-upgrade-dismiss"
          >
            Not now
          </Button>
          <Button
            variant="outline"
            onClick={handleSwitchToPm}
            data-testid="pm-upgrade-switch-pm"
          >
            Switch to Property Manager
          </Button>
          <Button
            onClick={handleAddSelfManaged}
            data-testid="pm-upgrade-add-self-managed"
          >
            Add HOA on self-managed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
