import { useEffect, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

const LOADING_STEPS = [
  "Creating your account",
  "Setting up your association",
  "Configuring your workspace",
];

type PageState =
  | { status: "loading" }
  | { status: "success"; email: string; billingUrl?: string }
  | { status: "error"; message: string };

function AnimatedSteps({ activeStep }: { activeStep: number }) {
  return (
    <ul className="mt-8 space-y-3 text-left max-w-xs mx-auto">
      {LOADING_STEPS.map((step, idx) => {
        const done = idx < activeStep;
        const active = idx === activeStep;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-3 text-sm font-body transition-opacity duration-500",
              done ? "opacity-100" : active ? "opacity-100" : "opacity-30",
            )}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            ) : (
              <span
                className={cn(
                  "h-4 w-4 rounded-full border-2 border-primary flex-shrink-0",
                  active && "border-t-transparent animate-spin",
                )}
                aria-hidden="true"
              />
            )}
            <span className={cn(done && "text-on-surface", active && "font-semibold text-on-surface")}>
              {step}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function PlanSignupSuccessPage() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") ?? "";

  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // Animate through steps while fetching
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    stepTimers.push(setTimeout(() => setActiveStep(1), 600));
    stepTimers.push(setTimeout(() => setActiveStep(2), 1400));

    async function complete() {
      if (!sessionId) {
        setPageState({
          status: "error",
          message: "Missing session ID. Please contact support if this persists.",
        });
        return;
      }

      try {
        const res = await fetch(
          `/api/public/signup/complete?session_id=${encodeURIComponent(sessionId)}`,
          { credentials: "include" },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          setPageState({
            status: "error",
            message: body.message ?? `Request failed (${res.status}). Please contact support.`,
          });
          return;
        }

        const data = await res.json() as {
          email?: string;
          billingUrl?: string;
        };

        // Ensure we spend at least a moment on the last step for UX
        setTimeout(() => {
          setPageState({
            status: "success",
            email: data.email ?? "",
            billingUrl: data.billingUrl,
          });
        }, 600);
      } catch {
        setPageState({
          status: "error",
          message: "Network error. Please refresh the page or contact support.",
        });
      }
    }

    complete();

    return () => stepTimers.forEach(clearTimeout);
  }, [sessionId]);

  // ── Loading state ────────────────────────────────────────────────────────────
  if (pageState.status === "loading") {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex flex-col px-6">
        <div className="py-6 px-2">
          <a href="/" className="font-headline text-xl font-semibold italic tracking-tight text-primary hover:opacity-80 transition-opacity">
            Your Condo Manager
          </a>
        </div>
        <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm w-full">
          <div
            className="mx-auto mb-6 h-14 w-14 rounded-full border-4 border-primary border-t-transparent animate-spin"
            aria-label="Loading"
          />
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Setting up your workspace…
          </h1>
          <p className="mt-2 text-sm font-body text-on-surface/60">
            This usually takes just a few seconds.
          </p>
          <AnimatedSteps activeStep={activeStep} />
        </div>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (pageState.status === "error") {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex flex-col px-6">
        <div className="py-6 px-2">
          <a href="/" className="font-headline text-xl font-semibold italic tracking-tight text-primary hover:opacity-80 transition-opacity">
            Your Condo Manager
          </a>
        </div>
        <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm w-full">
          <AlertCircle className="mx-auto mb-5 h-14 w-14 text-destructive" aria-hidden="true" />
          <h1 className="font-headline text-2xl font-bold text-on-surface mb-3">
            Something went wrong
          </h1>
          <p className="text-sm font-body text-on-surface/60 mb-8">{pageState.message}</p>
          <Button variant="outline" asChild>
            <Link href="/pricing">Back to pricing</Link>
          </Button>
        </div>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-container-lowest flex flex-col px-6">
      <div className="py-6 px-2">
        <a href="/" className="font-headline text-xl font-semibold italic tracking-tight text-primary hover:opacity-80 transition-opacity">
          Your Condo Manager
        </a>
      </div>
      <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md w-full">
        {/* Big checkmark */}
        <span
          className="material-symbols-outlined text-[80px] text-primary leading-none"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          task_alt
        </span>

        <h1 className="font-headline text-4xl font-bold text-on-surface mt-4 mb-4">
          Your workspace is ready!
        </h1>

        <p className="text-base font-body text-on-surface/60 mb-10 leading-relaxed">
          {pageState.email ? (
            <>
              We've sent a login link to{" "}
              <span className="font-semibold text-on-surface">{pageState.email}</span>. Check
              your inbox to access your workspace.
            </>
          ) : (
            "Check your email inbox for a login link to access your workspace."
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild className="gap-2">
            <Link href="/app">
              Go to Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          {pageState.billingUrl && (
            <Button size="lg" variant="outline" asChild>
              <a href={pageState.billingUrl} target="_blank" rel="noopener noreferrer">
                Manage Billing
              </a>
            </Button>
          )}
        </div>

        <p className="mt-10 text-xs font-body text-on-surface/40">
          Secured by Stripe · End-to-end encrypted
        </p>
      </div>
      </div>
    </div>
  );
}
