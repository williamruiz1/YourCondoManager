import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// ── Plan data ─────────────────────────────────────────────────────────────────

type PlanKey = "self-managed" | "property-manager" | "enterprise";

const PLANS: Record<
  PlanKey,
  {
    name: string;
    price: string;
    tagline: string;
    features: string[];
    trial: string;
  }
> = {
  "self-managed": {
    name: "Self-Managed",
    price: "$99/mo",
    tagline: "For independent Boards & HOAs",
    features: [
      "Single Association Portal",
      "Maintenance Request Tool",
      "Automated Dues Collection",
      "Owner Portal",
      "Document Management",
    ],
    trial: "14-day free trial",
  },
  "property-manager": {
    name: "Property Manager",
    price: "$449/mo",
    tagline: "For growing management firms",
    features: [
      "Manage 5–10 Associations",
      "Multi-Portfolio Dashboard",
      "Vendor Marketplace",
      "Advanced Asset Management",
      "Bulk Reporting",
    ],
    trial: "14-day free trial",
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    tagline: "Bespoke solutions for large portfolios",
    features: [
      "10+ Associations",
      "Dedicated Success Manager",
      "White-label Resident App",
      "API & Custom Integrations",
    ],
    trial: "Contact us for a custom trial",
  },
};

const SELF_MANAGED_TIERS = [
  { label: "1–25 units", min: 1, max: 25, price: "$99/mo" },
  { label: "26–75 units", min: 26, max: 75, price: "$149/mo" },
  { label: "76+ units", min: 76, max: Infinity, price: "$199/mo" },
];

function getSelfManagedTier(unitCount: number) {
  return SELF_MANAGED_TIERS.find(
    (t) => unitCount >= t.min && unitCount <= t.max,
  );
}

const ASSOCIATION_TYPES = [
  "HOA",
  "Condo Association",
  "Co-op",
  "Townhome Association",
  "Mixed-Use",
];

// ── Form schema ───────────────────────────────────────────────────────────────

const formSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid work email"),
  organizationName: z.string().min(1, "Organization name is required"),
  associationType: z.string().optional(),
  unitCount: z.coerce
    .number()
    .int()
    .min(1, "Enter a unit count of at least 1")
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ── Left panel ────────────────────────────────────────────────────────────────

function PlanPanel({ planKey }: { planKey: PlanKey }) {
  const plan = PLANS[planKey];

  return (
    <div className="bg-primary text-on-primary flex flex-col justify-between px-10 py-12 min-h-full">
      {/* Logo */}
      <div>
        <a href="/" className="font-headline text-2xl font-semibold italic tracking-tight hover:opacity-80 transition-opacity">
          Your Condo Manager
        </a>
      </div>

      {/* Plan details */}
      <div className="flex-1 mt-12">
        <p className="text-sm font-label font-semibold uppercase tracking-widest opacity-70 mb-3">
          {plan.tagline}
        </p>
        <h2 className="font-headline text-5xl font-bold leading-tight mb-2">
          {plan.name}
        </h2>
        <p className="font-headline text-3xl opacity-90 mb-8">{plan.price}</p>

        <ul className="space-y-3.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm font-body">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 flex-shrink-0">
                <Check className="h-3 w-3" />
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-xl bg-white/10 px-5 py-4 text-sm font-body opacity-90">
          <span className="font-semibold">{plan.trial}</span>
          {plan.trial.includes("14-day") && (
            <span> — no credit card required to start.</span>
          )}
        </div>
      </div>

      {/* Trust badge */}
      <div className="mt-12 flex items-center gap-2 text-xs font-label opacity-60">
        <ShieldCheck className="h-4 w-4 flex-shrink-0" />
        <span>End-to-end encrypted · Stripe-secured payments</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlanSignupPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const rawPlan = params.get("plan") ?? "property-manager";
  const planKey: PlanKey =
    rawPlan === "self-managed" || rawPlan === "property-manager" || rawPlan === "enterprise"
      ? (rawPlan as PlanKey)
      : "property-manager";

  const isEnterprise = planKey === "enterprise";
  const isSelfManaged = planKey === "self-managed";

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleAuthed, setGoogleAuthed] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      organizationName: "",
      associationType: "",
      unitCount: undefined,
    },
  });

  // After Google OAuth — redirect existing users, pre-fill new ones
  async function prefillFromSession() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const session = await res.json() as {
        authenticated?: boolean;
        admin?: { email: string; id: string } | null;
        user?: { email: string } | null;
      };

      // Already has a workspace → send them there
      if (session?.authenticated && session?.admin?.id) {
        window.location.assign("/app");
        return;
      }

      const email = session?.admin?.email || session?.user?.email;
      if (email) {
        form.setValue("email", email, { shouldValidate: true });
        setGoogleAuthed(true);
      }
    } catch { /* ignore */ }
  }

  // On mount: if already authenticated, go to workspace
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((session: { authenticated?: boolean; admin?: { id: string } | null } | null) => {
        if (session?.authenticated && session?.admin?.id) {
          window.location.assign("/app");
        }
      })
      .catch(() => { /* ignore */ });

    return () => {
      if (popupTimerRef.current) clearInterval(popupTimerRef.current);
    };
  }, []);

  function startGoogleSignUp() {
    const returnTo = `/signup?plan=${planKey}`;
    const url = `/api/auth/google?popup=1&returnTo=${encodeURIComponent(returnTo)}&forceSelect=1`;
    const popup = window.open(url, "google-oauth-signup", "width=520,height=680");

    if (!popup) {
      window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}&forceSelect=1`);
      return;
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type !== "google-oauth-success") return;
      window.removeEventListener("message", onMessage);
      if (popupTimerRef.current) clearInterval(popupTimerRef.current);
      void prefillFromSession();
    }
    window.addEventListener("message", onMessage);

    popupTimerRef.current = setInterval(() => {
      if (popup.closed) {
        if (popupTimerRef.current) clearInterval(popupTimerRef.current);
        window.removeEventListener("message", onMessage);
        void prefillFromSession();
      }
    }, 500);
  }

  const watchedUnitCount = form.watch("unitCount");
  const tier =
    isSelfManaged && watchedUnitCount && watchedUnitCount >= 1
      ? getSelfManagedTier(watchedUnitCount)
      : null;

  async function handleSubmit(values: FormValues) {
    if (isEnterprise) {
      window.location.href = "mailto:sales@yourcondomanager.org";
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name: values.fullName,
        email: values.email,
        organizationName: values.organizationName,
        associationType: values.associationType,
        plan: planKey,
        ...(isSelfManaged && values.unitCount ? { unitCount: values.unitCount } : {}),
      };

      const res = await fetch("/api/public/signup/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        setErrorMsg(
          "An account with this email already exists. Sign in instead.",
        );
        return;
      }

      if (res.status === 503) {
        setErrorMsg(
          "Signup is temporarily unavailable. Please try again later.",
        );
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setErrorMsg(body.message ?? "Something went wrong. Please try again.");
        return;
      }

      const data = await res.json() as { checkoutUrl?: string };
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setErrorMsg("Unexpected response from server. Please try again.");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left — plan summary */}
      <div className="hidden lg:block">
        <PlanPanel planKey={planKey} />
      </div>

      {/* Right — form */}
      <div className="bg-surface-container-lowest flex items-center justify-center px-6 py-14 sm:px-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <a href="/" className="font-headline text-xl font-semibold italic tracking-tight text-primary hover:opacity-80 transition-opacity">
              Your Condo Manager
            </a>
          </div>

          {/* Heading */}
          <div className="mb-8">
            {isEnterprise ? (
              <>
                <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">
                  Talk to our team
                </h1>
                <p className="text-sm font-body text-on-surface/60">
                  Tell us about your portfolio and we'll craft a solution for you.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">
                  Start your 14-day free trial
                </h1>
                <p className="text-sm font-body text-on-surface/60">
                  No credit card required to start.
                </p>
              </>
            )}
          </div>

          {/* Google sign-up */}
          {!isEnterprise && (
            <>
              <button
                type="button"
                onClick={startGoogleSignUp}
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-label font-medium text-on-surface hover:bg-muted/50 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {googleAuthed ? "Signed in with Google" : "Continue with Google"}
                {googleAuthed && <Check className="h-4 w-4 text-green-600 ml-auto" />}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-label text-on-surface/40">or continue with email</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Full Name */}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-label text-sm font-medium text-on-surface">
                      Full Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jane Smith"
                        autoComplete="name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Work Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-label text-sm font-medium text-on-surface">
                      Work Email
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="email"
                          placeholder="jane@yourcompany.com"
                          autoComplete="email"
                          readOnly={googleAuthed}
                          className={cn(googleAuthed && "bg-muted/50 text-on-surface/70 pr-10")}
                          {...field}
                        />
                        {googleAuthed && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-label text-green-600 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Organization Name */}
              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-label text-sm font-medium text-on-surface">
                      Organization Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Riverside Property Management"
                        autoComplete="organization"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Association Type — self-managed only */}
              {isSelfManaged && (
                <FormField
                  control={form.control}
                  name="associationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-label text-sm font-medium text-on-surface">
                        Association Type
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select association type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ASSOCIATION_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Unit Count — self-managed only */}
              {isSelfManaged && (
                <FormField
                  control={form.control}
                  name="unitCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-label text-sm font-medium text-on-surface">
                        Number of Units
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g. 48"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                      {tier && (
                        <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-primary/8 px-3 py-2">
                          <span className="text-xs font-label font-semibold text-primary">
                            {tier.label}
                          </span>
                          <span className="text-xs font-body text-on-surface/60">·</span>
                          <span className="text-xs font-label font-bold text-primary">
                            {tier.price}
                          </span>
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              )}

              {/* Error message */}
              {errorMsg && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <p className="text-sm font-body text-destructive">{errorMsg}</p>
                  {errorMsg.includes("already exists") && (
                    <a
                      href="/app"
                      className="text-sm font-body font-semibold text-primary underline-offset-2 hover:underline mt-1 inline-block"
                    >
                      Go to sign in
                    </a>
                  )}
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className={cn("w-full py-6 gap-2 font-label font-semibold text-base")}
                  disabled={isSubmitting}
                  variant={isEnterprise ? "outline" : "default"}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
                        aria-hidden="true"
                      />
                      Processing…
                    </>
                  ) : isEnterprise ? (
                    "Contact Sales"
                  ) : (
                    <>
                      Continue to Checkout
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>

          {/* Sign in link */}
          <p className="mt-6 text-center text-sm font-body text-on-surface/50">
            Already have an account?{" "}
            <a
              href="/app"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
