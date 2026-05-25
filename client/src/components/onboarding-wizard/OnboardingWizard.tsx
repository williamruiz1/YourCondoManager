// #1327 — Day-0-14 self-managed onboarding wizard root component.
//
// Plain English: this is the full-page wizard that a brand-new HOA treasurer
// lands on right after they finish signup. It walks them through the seven
// things they need to do to get value out of YCM in the first two weeks. The
// page reads and writes its state through /api/onboarding/wizard so they can
// pause, log out, come back tomorrow, and pick up exactly where they were.
//
// Wizard shell scope (Child A of the #1327 build): step routing + persistence +
// Steps 1, 6, 7. Steps 2–5 surface as "coming soon" placeholders that the user
// can skip; Child B + Child C dispatches add the real implementations.
import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { trackEvent } from "@/lib/tracking";
import { reportError } from "@/lib/error-reporting";
import { ArrowRight, PartyPopper } from "lucide-react";
import { StepIndicator } from "./StepIndicator";
import { Step1CommunityDetails } from "./Step1CommunityDetails";
import { Step2ConnectBank } from "./Step2ConnectBank";
import { Step3UploadRoster } from "./Step3UploadRoster";
import { Step4RecurringAssessments } from "./Step4RecurringAssessments";
import { Step5MassCommunication } from "./Step5MassCommunication";
import { Step6InviteBoard } from "./Step6InviteBoard";
import { Step7TrialPreview } from "./Step7TrialPreview";
import { StepComingSoon } from "./StepComingSoon";
import { WIZARD_STEPS, type OnboardingWizardSnapshot, type WizardStepNumber } from "./types";

const QUERY_KEY = ["/api/onboarding/wizard"] as const;

function OnboardingWizardInner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<OnboardingWizardSnapshot>({ queryKey: QUERY_KEY });

  // #1617 — GA4 step-entered: fire once per step transition (not on every
  // re-render). Captures step-enter time so a follow-on dispatch can derive
  // per-step duration when the next step's enter event fires.
  const lastStepEnteredRef = useRef<number | null>(null);
  const stepEnterTimestampRef = useRef<number | null>(null);
  useEffect(() => {
    if (!data || data.wizardCompletedAt) return;
    const current = data.currentStep;
    if (lastStepEnteredRef.current === current) return;
    const now = Date.now();
    const previousStep = lastStepEnteredRef.current;
    const previousEnteredAt = stepEnterTimestampRef.current;
    if (previousStep !== null && previousEnteredAt !== null) {
      const durationMs = now - previousEnteredAt;
      const resolution = data.stepsCompleted.includes(previousStep)
        ? "onboarding_step_completed"
        : data.stepsSkipped.includes(previousStep)
          ? "onboarding_step_skipped"
          : null;
      if (resolution) {
        trackEvent(resolution, { step: previousStep, duration_ms: durationMs });
      }
    }
    trackEvent("onboarding_step_entered", { step: current });
    lastStepEnteredRef.current = current;
    stepEnterTimestampRef.current = now;
  }, [data]);

  // #1617 — emit wizard_completed once on finalization. Pulls the wizard
  // duration from start → completion so the activation dashboard can
  // chart time-to-onboard distributions.
  const completionEmittedRef = useRef(false);
  useEffect(() => {
    if (!data?.wizardCompletedAt) return;
    if (completionEmittedRef.current) return;
    completionEmittedRef.current = true;
    const startedAt = data.wizardStartedAt ? new Date(data.wizardStartedAt).getTime() : null;
    const completedAt = new Date(data.wizardCompletedAt).getTime();
    trackEvent("onboarding_wizard_completed", {
      duration_ms: startedAt ? completedAt - startedAt : null,
      steps_completed: data.stepsCompleted.length,
      steps_skipped: data.stepsSkipped.length,
    });
  }, [data]);

  // Bootstrap a wizard row the first time the page loads. The endpoint is
  // idempotent, so re-fires from React's strict-mode double-effect are safe.
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/wizard/start", {});
      return (await res.json()) as OnboardingWizardSnapshot;
    },
    onSuccess: (snapshot) => queryClient.setQueryData<OnboardingWizardSnapshot>(QUERY_KEY, snapshot),
  });

  useEffect(() => {
    if (!data || data.started) return;
    if (startMutation.isPending || startMutation.isSuccess) return;
    startMutation.mutate();
  }, [data, startMutation]);

  const skipMutation = useMutation({
    mutationFn: async (step: number) => {
      const res = await apiRequest("POST", `/api/onboarding/wizard/step/${step}/skip`, {});
      return (await res.json()) as OnboardingWizardSnapshot;
    },
    onSuccess: (snapshot) => queryClient.setQueryData<OnboardingWizardSnapshot>(QUERY_KEY, snapshot),
    onError: (err: Error) => {
      reportError(err, { feature: "onboarding-wizard", action: "skip-step" });
      toast({ title: "Couldn't skip step", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (step: number) => {
      const res = await apiRequest("POST", `/api/onboarding/wizard/step/${step}/complete`, {});
      return (await res.json()) as OnboardingWizardSnapshot;
    },
    onSuccess: (snapshot) => queryClient.setQueryData<OnboardingWizardSnapshot>(QUERY_KEY, snapshot),
    onError: (err: Error) => {
      reportError(err, { feature: "onboarding-wizard", action: "complete-step" });
      toast({ title: "Couldn't save step", description: err.message, variant: "destructive" });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/wizard/complete", {});
      return (await res.json()) as OnboardingWizardSnapshot;
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData<OnboardingWizardSnapshot>(QUERY_KEY, snapshot);
      toast({ title: "Onboarding complete", description: "Welcome to YCM. You can revisit any step from Settings." });
      setLocation("/app");
    },
    onError: (err: Error) => {
      reportError(err, { feature: "onboarding-wizard", action: "finalize" });
      toast({ title: "Couldn't finish", description: err.message, variant: "destructive" });
    },
  });

  const activeStepDef = useMemo(() => {
    if (!data) return WIZARD_STEPS[0];
    return WIZARD_STEPS.find((s) => s.step === data.currentStep) ?? WIZARD_STEPS[0];
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ── Completion screen ────────────────────────────────────────────────────
  if (data.wizardCompletedAt) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
        <PartyPopper className="h-12 w-12 text-primary" aria-hidden="true" />
        <h1 className="font-headline text-3xl font-bold">You're all set</h1>
        <p className="text-sm text-muted-foreground">
          Onboarding is complete. You can always revisit any step from{" "}
          <span className="font-medium">Settings → Onboarding</span>.
        </p>
        <Button onClick={() => setLocation("/app")} data-testid="wizard-go-to-dashboard">
          Go to dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  const handleSkip = (step: number) => skipMutation.mutate(step);
  const handleComplete = (step: number) => completeMutation.mutate(step);

  const allRequiredDone = WIZARD_STEPS.filter((s) => s.required).every((s) => data.stepsCompleted.includes(s.step));
  const allResolved = WIZARD_STEPS.every((s) => data.stepsCompleted.includes(s.step) || data.stepsSkipped.includes(s.step));

  // ── Step body switch ─────────────────────────────────────────────────────
  const stepNumber = activeStepDef.step as WizardStepNumber;
  let stepBody: JSX.Element;
  switch (stepNumber) {
    case 1:
      stepBody = (
        <Step1CommunityDetails
          snapshot={data}
          onComplete={() => handleComplete(1)}
          isSaving={completeMutation.isPending}
          onSnapshotUpdate={(snapshot) => queryClient.setQueryData<OnboardingWizardSnapshot>(QUERY_KEY, snapshot)}
        />
      );
      break;
    case 2:
      stepBody = (
        <Step2ConnectBank
          snapshot={data}
          onComplete={() => handleComplete(2)}
          onSkip={() => handleSkip(2)}
          isSaving={completeMutation.isPending || skipMutation.isPending}
        />
      );
      break;
    case 3:
      stepBody = (
        <Step3UploadRoster
          snapshot={data}
          onComplete={() => handleComplete(3)}
          onSkip={() => handleSkip(3)}
          isSaving={completeMutation.isPending || skipMutation.isPending}
        />
      );
      break;
    case 4:
      stepBody = (
        <Step4RecurringAssessments
          snapshot={data}
          onComplete={() => handleComplete(4)}
          onSkip={() => handleSkip(4)}
          isSaving={completeMutation.isPending || skipMutation.isPending}
        />
      );
      break;
    case 5:
      stepBody = (
        <Step5MassCommunication
          snapshot={data}
          onComplete={() => handleComplete(5)}
          onSkip={() => handleSkip(5)}
          isSaving={completeMutation.isPending || skipMutation.isPending}
        />
      );
      break;
    case 6:
      stepBody = (
        <Step6InviteBoard
          snapshot={data}
          onComplete={() => handleComplete(6)}
          onSkip={() => handleSkip(6)}
          isSaving={completeMutation.isPending || skipMutation.isPending}
        />
      );
      break;
    case 7:
      stepBody = (
        <Step7TrialPreview
          snapshot={data}
          onComplete={() => handleComplete(7)}
          isSaving={completeMutation.isPending}
        />
      );
      break;
    default:
      stepBody = (
        <StepComingSoon
          step={stepNumber}
          onSkip={() => handleSkip(stepNumber)}
          isSaving={skipMutation.isPending}
        />
      );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6" data-testid="onboarding-wizard">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step {activeStepDef.step} of {WIZARD_STEPS.length}
        </p>
        <h1 className="font-headline text-2xl font-bold">{activeStepDef.label}</h1>
        <p className="text-sm text-muted-foreground">{activeStepDef.description}</p>
      </header>

      <StepIndicator snapshot={data} />

      <Card>
        <CardHeader className="sr-only">
          <CardTitle>{activeStepDef.label}</CardTitle>
          <CardDescription>{activeStepDef.description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">{stepBody}</CardContent>
      </Card>

      {allResolved && !data.wizardCompletedAt && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-6 text-center">
          <p className="text-sm">
            {allRequiredDone
              ? "Every step is resolved. Wrap up onboarding to land on your dashboard."
              : "Some required steps are still incomplete. Finish them to wrap up."}
          </p>
          <Button
            onClick={() => finalizeMutation.mutate()}
            disabled={!allRequiredDone || finalizeMutation.isPending}
            data-testid="wizard-finalize"
          >
            {finalizeMutation.isPending ? "Wrapping up…" : "Finish onboarding"}
          </Button>
        </div>
      )}
    </div>
  );
}

// #1617 — Outer wrapper. Catches render-time crashes in any step
// component and routes them through `reportError` (Sentry-or-console)
// instead of dropping the user on a blank screen mid-onboarding.
export function OnboardingWizard() {
  return (
    <ErrorBoundary>
      <OnboardingWizardInner />
    </ErrorBoundary>
  );
}
