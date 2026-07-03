import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
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

import { resolveSignupPlan, type SignupTrack } from "@shared/signup-plan-keys";

// ── Plan data ─────────────────────────────────────────────────────────────────

// The three signup TRACKS. The left-panel price is the track's starting/headline
// price; the live displayed price is refined from the selected PM tier (slug) or
// the entered SM unit count. NOTE the "$30" stale per-complex value is GONE — the
// self-managed track now starts at the real Small Community floor ($129/mo).
const PLANS: Record<
  SignupTrack,
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
    // Self-managed declining per-unit (William-ratified 2026-06-21): Small $129
    // flat (1–40) · Mid $3.75/unit (41–100) · Large $3.50/unit (101–250).
    price: "From $129/mo",
    tagline: "For self-managed Communities & Condo Associations",
    features: [
      "Single Association Portal",
      "Maintenance Request Tool",
      "Automated Dues Collection",
      "Owner Portal",
      "Document Management",
    ],
    trial: "21-day free trial",
  },
  "property-manager": {
    name: "Property Manager",
    // PM declining per-door: Starter $4.50/door ($500 min) · Growth $4.25 · Scale $4.00.
    price: "From $4.50/door",
    tagline: "For growing management firms",
    features: [
      "Multi-Portfolio Dashboard",
      "Portfolio rollup reporting",
      "White-label / co-brand",
      "AI compliance assistant",
      "Priority support",
    ],
    trial: "21-day free trial",
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    tagline: "Bespoke solutions for large portfolios",
    features: [
      "Dedicated Success Manager",
      "White-label Resident App",
      "API & Custom Integrations",
      "On-site training & migration",
    ],
    trial: "Contact us for a custom trial",
  },
};

// Canonical self-managed tiers (declining per-unit; William-ratified 2026-06-21).
// These match the live pricing page + plan_catalog seed exactly. The "$30/$50"
// per-complex values that leaked into signup are gone.
const SELF_MANAGED_TIERS = [
  { label: "Small Community (1–40 units)", min: 1, max: 40, price: "$129/mo flat" },
  { label: "Mid Community (41–100 units)", min: 41, max: 100, price: "$3.75/unit/mo" },
  { label: "Large Community (101–250 units)", min: 101, max: 250, price: "$3.50/unit/mo" },
  { label: "Enterprise Concierge (250+ units)", min: 251, max: Infinity, price: "Custom — contact sales" },
];

function getSelfManagedTier(unitCount: number) {
  return SELF_MANAGED_TIERS.find(
    (t) => unitCount >= t.min && unitCount <= t.max,
  );
}

// Property-manager tier headline price, keyed by the resolved plan_catalog key
// the signup slug pins to (declining per-door). Drives the left-panel price for
// the PM track so the slug-specific tier shows its real rate (never "$30").
const PM_TIER_PRICE: Record<string, string> = {
  pm_starter: "$4.50/door · $500/mo min",
  pm_growth: "$4.25/door · $2,125/mo min",
  pm_scale: "$4.00/door · $8,000/mo min",
};

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

function PlanPanel({ track, resolvedPrice }: { track: SignupTrack; resolvedPrice?: string }) {
  const plan = PLANS[track];

  return (
    <div className="bg-ycm-sky text-white flex flex-col justify-between px-10 py-12 min-h-full">
      {/* Logo */}
      <div>
        <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <BrandMark className="h-12 w-12" />
          <span className="font-headline text-2xl font-semibold italic tracking-tight">
            Your Condo Manager
          </span>
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
        <p className="font-headline text-3xl opacity-90 mb-8">{resolvedPrice ?? plan.price}</p>

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
          {plan.trial.includes("21-day") && (
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
  const rawPlan = params.get("plan");
  // Canonical resolver (shared with the server). An unrecognized slug routes to
  // self-managed, NEVER the stale PM $30 fallback. `planKey` pins the PM tier
  // (Starter / Growth / Scale) for the slug-specific price.
  const { track, planKey: resolvedPlanKey } = resolveSignupPlan(rawPlan);

  const isEnterprise = track === "enterprise";
  const isSelfManaged = track === "self-managed";
  // The plan value submitted to the server — preserve the original tier-specific
  // slug so the server resolves the same PM tier the user clicked.
  const submittedPlan = rawPlan ?? "self-managed";

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
    const returnTo = `/signup?plan=${submittedPlan}`;
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

  // The left-panel headline price. For self-managed, refine to the entered
  // unit count's tier; for PM, show the slug-pinned tier's per-door rate; else
  // the track's starting price. Guarantees the panel never shows a stale "$30".
  const resolvedPanelPrice = isSelfManaged
    ? tier?.price
    : (resolvedPlanKey ? PM_TIER_PRICE[resolvedPlanKey] : undefined);

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
        plan: submittedPlan,
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
        <PlanPanel track={track} resolvedPrice={resolvedPanelPrice} />
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
                  Start your 21-day free trial
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
