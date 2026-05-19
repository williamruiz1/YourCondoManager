// #1327 — wire-format mirror of server `OnboardingWizardSnapshot`. Kept in
// the client tree so the server type doesn't pull server-only imports into
// the bundle. Server source of truth lives in server/storage.ts.

export type OnboardingWizardSnapshot = {
  started: boolean;
  associationId: string | null;
  currentStep: number;
  stepsCompleted: number[];
  stepsSkipped: number[];
  totalSteps: 7;
  wizardStartedAt: string | null;
  wizardTargetCompletionAt: string | null;
  wizardCompletedAt: string | null;
  lastActivityAt: string | null;
};

export type WizardStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WizardStepDefinition = {
  step: WizardStepNumber;
  label: string;
  short: string;
  description: string;
  required: boolean;
};

export const WIZARD_STEPS: readonly WizardStepDefinition[] = [
  {
    step: 1,
    label: "Welcome & community details",
    short: "Community",
    description: "Confirm the legal name and address of your association.",
    required: true,
  },
  {
    step: 2,
    label: "Connect your bank",
    short: "Bank",
    description: "Link a checking account so we can sync transactions automatically.",
    required: false,
  },
  {
    step: 3,
    label: "Upload your owner roster",
    short: "Owners",
    description: "Bring in unit owners from a CSV so we can match payments to people.",
    required: false,
  },
  {
    step: 4,
    label: "Schedule recurring assessments",
    short: "Assessments",
    description: "Set what each owner is charged and how often.",
    required: false,
  },
  {
    step: 5,
    label: "Tell owners you're using YCM",
    short: "Announce",
    description: "Send the welcome message to everyone in your community.",
    required: false,
  },
  {
    step: 6,
    label: "Invite board members",
    short: "Board",
    description: "Add the rest of the board so they can collaborate with you.",
    required: false,
  },
  {
    step: 7,
    label: "Trial-conversion preview",
    short: "Trial",
    description: "Choose how you'll convert once your trial ends.",
    required: true,
  },
] as const;

export function isStepDone(snapshot: OnboardingWizardSnapshot, step: number): boolean {
  return snapshot.stepsCompleted.includes(step);
}

export function isStepSkipped(snapshot: OnboardingWizardSnapshot, step: number): boolean {
  return snapshot.stepsSkipped.includes(step);
}

export function isStepResolved(snapshot: OnboardingWizardSnapshot, step: number): boolean {
  return isStepDone(snapshot, step) || isStepSkipped(snapshot, step);
}
