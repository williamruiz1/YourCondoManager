// #1327 — wizard progress indicator. Renders the 7-step strip with
// completed / skipped / current / pending state. Keeps a horizontal-scroll
// affordance on narrow screens so all 7 stops are reachable without
// collapsing labels.
import { CheckCircle2, Circle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS, type OnboardingWizardSnapshot } from "./types";

export function StepIndicator({
  snapshot,
  onStepClick,
}: {
  snapshot: OnboardingWizardSnapshot;
  onStepClick?: (step: number) => void;
}) {
  const completed = new Set(snapshot.stepsCompleted);
  const skipped = new Set(snapshot.stepsSkipped);

  return (
    <nav
      aria-label="Onboarding progress"
      className="flex w-full items-center gap-1 overflow-x-auto pb-2 sm:gap-2"
      data-testid="wizard-step-indicator"
    >
      {WIZARD_STEPS.map(({ step, short }, idx) => {
        const done = completed.has(step);
        const wasSkipped = skipped.has(step);
        const active = snapshot.currentStep === step && !done && !wasSkipped;
        const Icon = done ? CheckCircle2 : wasSkipped ? SkipForward : Circle;
        const clickable = Boolean(onStepClick);

        const dotClasses = cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
          done && "bg-primary text-primary-foreground",
          wasSkipped && "bg-muted text-muted-foreground ring-1 ring-border",
          active && "bg-primary/15 text-primary ring-2 ring-primary",
          !done && !wasSkipped && !active && "bg-muted text-muted-foreground",
        );

        const labelClasses = cn(
          "hidden text-xs sm:inline",
          active ? "font-medium text-foreground" : "text-muted-foreground",
        );

        const content = (
          <span className="flex items-center gap-1.5">
            <span className={dotClasses} aria-hidden="true">
              {done || wasSkipped ? <Icon className="h-3.5 w-3.5" /> : step}
            </span>
            <span className={labelClasses}>{short}</span>
          </span>
        );

        return (
          <div key={step} className="flex shrink-0 items-center gap-1 sm:gap-2">
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(step)}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${step}: ${short}${done ? " (done)" : wasSkipped ? " (skipped)" : ""}`}
                data-testid={`wizard-step-jump-${step}`}
                className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {content}
              </button>
            ) : (
              <span aria-current={active ? "step" : undefined}>{content}</span>
            )}
            {idx < WIZARD_STEPS.length - 1 && (
              <span aria-hidden="true" className="h-px w-3 bg-border sm:w-6" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
