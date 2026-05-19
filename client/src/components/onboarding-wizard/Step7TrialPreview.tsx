// #1327 — Step 7: trial-conversion preview. Platform billing (#1147) is not
// yet shipped at the time of this dispatch — per OP #27 (Bounded Creative
// Perseverance) and the spec's coordination note, this step renders a
// "save for later" path with the reminder cadence info instead of a live
// Stripe Billing widget. When #1147 lands a follow-on dispatch wires the
// "Add payment method" CTA to the real billing portal.
import { CalendarClock, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardingWizardSnapshot } from "./types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function Step7TrialPreview({
  snapshot,
  onComplete,
  isSaving,
}: {
  snapshot: OnboardingWizardSnapshot;
  onComplete: () => void;
  isSaving: boolean;
}) {
  const trialEndLabel = formatDate(snapshot.wizardTargetCompletionAt);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Here's what happens when your trial ends — no surprises.
      </p>

      <div className="rounded-lg border bg-muted/30 p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Plan</dt>
            <dd className="font-medium">Self-managed (boards under 50 units)</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Trial ends</dt>
            <dd className="font-medium" data-testid="wizard-step-7-trial-end">{trialEndLabel}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reminder cadence</dt>
            <dd className="font-medium">Days 7, 10, 12, 13, and 14 — only for steps still open.</dd>
          </div>
        </dl>
      </div>

      <ul className="space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span><strong>No credit card required up front.</strong> We'll prompt for payment after your trial ends.</span>
        </li>
        <li className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span><strong>Save for later.</strong> Convert any time before {trialEndLabel} — we'll send the link.</span>
        </li>
        <li className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span><strong>Cancel anytime.</strong> No long-term contract; we'll keep your data 30 days after cancel.</span>
        </li>
      </ul>

      <div className="rounded-md border border-dashed bg-background p-4 text-xs text-muted-foreground" data-testid="wizard-step-7-billing-fallback">
        Platform billing is rolling out shortly. Until then, you'll get an email at the start of
        Day 14 with a one-click "Add payment method" link. Nothing happens automatically — your
        access stays full until you confirm payment.
      </div>

      <Button
        type="button"
        onClick={onComplete}
        disabled={isSaving}
        className="w-full"
        data-testid="wizard-step-7-acknowledge"
      >
        {isSaving ? "Saving…" : "Got it — remind me at Day 14"}
      </Button>
    </div>
  );
}
