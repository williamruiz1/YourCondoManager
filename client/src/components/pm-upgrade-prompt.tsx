/**
 * PmUpgradePrompt — Self-managed dual-path "add another HOA" modal.
 *
 * Spec evolution:
 *   Wave 13 (4.4 Q6, 2026-04-24): single-CTA "upgrade to PM tier" prompt.
 *   Wave 39 (4.4 Q5/Q6, 2026-04-26): founder-ratified per-HOA self-managed
 *     billing model. Self-managed = N subscriptions, one per association
 *     (uniqueIndex on `platformSubscriptions.associationId`). PM = one
 *     subscription, multiple HOAs (consolidated billing).
 *   Wave 39 follow-up (2026-04-26): authenticated 2nd-HOA path. The
 *     primary CTA opens an in-place "Add HOA" form that POSTs to
 *     `/api/admin/associations/start-checkout` (no new adminUsers row;
 *     reuses session) and redirects the browser to the returned
 *     `checkoutUrl`. The legacy `/signup?plan=self-managed&context=add`
 *     redirect is preserved as a fallback for unauthenticated callers
 *     (the modal is mounted only on authenticated surfaces today, but
 *     the fallback keeps the old behaviour intact for any surface that
 *     still mounts it without an auth context).
 *
 *   The prompt offers TWO paths:
 *
 *     1. Primary  — "Add HOA on self-managed"
 *                   Authenticated callers see a small follow-up form for
 *                   the new HOA's name + optional address + unit count,
 *                   POST to the new authenticated checkout endpoint, and
 *                   redirect to Stripe Checkout. Unauthenticated callers
 *                   fall back to /signup?plan=self-managed&context=add.
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
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  /**
   * When true, the primary CTA opens the in-place "add HOA" form and
   * POSTs to the authenticated /api/admin/associations/start-checkout
   * endpoint. When false (or undefined), the primary CTA falls back to
   * the legacy `/signup?plan=self-managed&context=add` redirect (for
   * surfaces that don't carry an admin session).
   *
   * Defaults to true — every surface that currently mounts this modal
   * lives behind /app/* (authenticated). The escape hatch exists so the
   * pre-Wave-39-follow-up redirect still works for any future
   * unauthenticated mount.
   */
  authenticated?: boolean;
};

export function PmUpgradePrompt({ open, onClose, authenticated = true }: PmUpgradePromptProps) {
  const [addHoaOpen, setAddHoaOpen] = useState(false);

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

  // Primary path.
  function handleAddSelfManaged() {
    if (authenticated) {
      // Open the follow-up dialog. Don't dismiss yet — the user might cancel
      // out of the form and we want the parent to stay open. We close the
      // outer modal here so we don't stack two dialogs.
      onClose();
      setAddHoaOpen(true);
      return;
    }

    // Unauthenticated fallback — keep prior behaviour. Lands on the public
    // signup page with a `context=add` flag.
    dismissPmUpgradePrompt();
    onClose();
    window.location.href = "/signup?plan=self-managed&context=add";
  }

  function handleDismiss() {
    dismissPmUpgradePrompt();
    onClose();
  }

  function handleAddHoaClose() {
    setAddHoaOpen(false);
  }

  return (
    <>
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

      <AddHoaDialog
        open={addHoaOpen}
        onClose={handleAddHoaClose}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// AddHoaDialog — the authenticated 2nd-HOA self-managed checkout form.
// Posts to /api/admin/associations/start-checkout and redirects the
// browser to Stripe Checkout on success.
// ---------------------------------------------------------------------------

type AddHoaDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function AddHoaDialog({ open, onClose }: AddHoaDialogProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [unitCount, setUnitCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setAddress("");
    setUnitCount("");
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Association name is required.");
      return;
    }

    const parsedUnits = unitCount.trim() ? Number(unitCount.trim()) : null;
    if (parsedUnits !== null && (!Number.isFinite(parsedUnits) || !Number.isInteger(parsedUnits) || parsedUnits <= 0)) {
      setError("Unit count must be a positive whole number.");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        associationName: trimmedName,
        plan: "self-managed",
      };
      const trimmedAddress = address.trim();
      if (trimmedAddress) body.associationAddress = trimmedAddress;
      if (parsedUnits !== null) body.unitCount = parsedUnits;

      const res = await fetch("/api/admin/associations/start-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        setError(payload?.message ?? `Request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { checkoutUrl?: string };
      if (!data.checkoutUrl) {
        setError("Stripe checkout URL was not returned. Please try again.");
        setSubmitting(false);
        return;
      }
      // Dismiss the upgrade-prompt key and hand off to Stripe.
      dismissPmUpgradePrompt();
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent data-testid="add-hoa-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add another HOA</DialogTitle>
          <DialogDescription>
            Continue to Stripe to start a new self-managed subscription for this
            HOA. The 21-day free trial applies — no credit card required to
            start.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-hoa-name">Association name</Label>
            <Input
              id="add-hoa-name"
              data-testid="add-hoa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside Towers HOA"
              required
              maxLength={200}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-hoa-address">Address (optional)</Label>
            <Input
              id="add-hoa-address"
              data-testid="add-hoa-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State"
              maxLength={500}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-hoa-unit-count">Unit count (optional)</Label>
            <Input
              id="add-hoa-unit-count"
              data-testid="add-hoa-unit-count"
              type="number"
              min={1}
              max={100000}
              value={unitCount}
              onChange={(e) => setUnitCount(e.target.value)}
              placeholder="e.g. 24"
              disabled={submitting}
            />
          </div>
          {error && (
            <p
              data-testid="add-hoa-error"
              className="text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={submitting}
              data-testid="add-hoa-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              data-testid="add-hoa-submit"
            >
              {submitting ? "Starting checkout…" : "Continue to checkout"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
