// #1327 — Placeholder body rendered for Steps 2/3/4/5 in the Child A scope.
// Each of those steps gets a full implementation in Child B / Child C
// follow-on dispatches; until then this card lets the user skip the step
// and surface their intent that they need it.
import { Button } from "@/components/ui/button";
import { ArrowRight, Wrench } from "lucide-react";
import { WIZARD_STEPS } from "./types";

// Steps 2, 3, 4 are now fully implemented (founder-os#1616 Child B).
// Step 5 is still routed through here while Child C is in flight.
const FOLLOW_ON: Record<number, { childDispatch: string; reason: string }> = {
  5: { childDispatch: "Child C", reason: "Bulk announcement to owners is being rolled out in a follow-on build." },
};

export function StepComingSoon({
  step,
  onSkip,
  isSaving,
}: {
  step: number;
  onSkip: () => void;
  isSaving: boolean;
}) {
  const def = WIZARD_STEPS.find((s) => s.step === step);
  const followOn = FOLLOW_ON[step];
  return (
    <div className="space-y-4 text-center" data-testid={`wizard-step-${step}-coming-soon`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Wrench className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">{def?.label ?? `Step ${step}`}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{def?.description}</p>
      </div>
      <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {followOn?.reason ?? "This step is coming soon."} Skip it for now and we'll surface a
        reminder once it's ready ({followOn?.childDispatch ?? "follow-on dispatch"}).
      </p>
      <Button type="button" onClick={onSkip} disabled={isSaving} variant="outline" className="w-full" data-testid={`wizard-step-${step}-skip`}>
        {isSaving ? "Saving…" : "Skip for now"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
