// #1327 — /app/onboarding page wrapper. Owns the page chrome and delegates
// step-routing to <OnboardingWizard>. Sits inside the existing admin shell
// (authenticated /app/*) so the same login/session guardrails as any other
// admin route apply.
import { OnboardingWizard } from "@/components/onboarding-wizard/OnboardingWizard";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background">
      <OnboardingWizard />
    </div>
  );
}
