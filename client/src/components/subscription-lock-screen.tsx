type SubscriptionLockScreenProps = {
  status: "canceled" | "unpaid" | "past_due";
  plan: string;
  trialEndsAt?: string | null;
  onManageBilling: () => void;
};

const PLAN_LABELS: Record<string, string> = {
  "self-managed": "Self-Managed",
  "property-manager": "Property Manager",
  "enterprise": "Enterprise",
};

export function SubscriptionLockScreen({
  status,
  plan,
  trialEndsAt,
  onManageBilling,
}: SubscriptionLockScreenProps) {
  const planLabel = PLAN_LABELS[plan] ?? plan;

  const heading =
    status === "canceled"
      ? "Your subscription has ended"
      : status === "unpaid"
      ? "Payment required to continue"
      : "Payment past due";

  const body =
    status === "canceled"
      ? `Your ${planLabel} plan has been canceled. Update your payment method or choose a new plan to restore access.`
      : status === "unpaid"
      ? "We were unable to collect your last payment. Please update your payment method to restore access to your workspace."
      : "Your last invoice is past due. Update your payment method to keep your workspace active.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 p-8 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-destructive text-[32px]">lock</span>
        </div>

        <div className="space-y-2">
          <h2 className="font-headline text-2xl text-foreground">{heading}</h2>
          <p className="text-sm text-muted-foreground font-body leading-relaxed">{body}</p>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={onManageBilling}
            className="w-full bg-primary text-primary-foreground text-sm font-bold font-body px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Update Payment Method
          </button>
          <a
            href="mailto:support@yourcondomanager.org"
            className="block w-full text-sm font-body text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Contact Support
          </a>
        </div>

        {status === "canceled" && (
          <p className="text-xs text-muted-foreground font-body">
            Your data is retained for 30 days after cancellation.
          </p>
        )}
      </div>
    </div>
  );
}
