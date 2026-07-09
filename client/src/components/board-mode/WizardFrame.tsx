// founder-os#9487 — Board mode guided-wizard shell.
//
// A presentational frame shared by all five Board-mode wizards. It renders a
// plain-English header, a step-progress strip, the current step body in a card,
// and Back / Next (or Finish) controls. Wizards own their form state + steps and
// hand this frame the current step + navigation callbacks — so every wizard
// looks and behaves identically (guided step-by-step, never a blank form).

import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface WizardFrameProps {
  title: string;
  icon: LucideIcon;
  /** One plain-English sentence under the title telling the board what this does. */
  intro: string;
  stepTitles: string[];
  current: number;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  /** true when the current step is complete enough to advance. */
  canAdvance: boolean;
  /** true on the final (submit) step. */
  isLastStep: boolean;
  busy?: boolean;
  finishLabel?: string;
  testId?: string;
}

export function WizardFrame({
  title,
  icon: Icon,
  intro,
  stepTitles,
  current,
  children,
  onBack,
  onNext,
  canAdvance,
  isLastStep,
  busy = false,
  finishLabel = "Finish",
  testId,
}: WizardFrameProps) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6" data-testid={testId ?? "board-wizard"}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="font-headline text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
        </div>
      </div>

      {/* Plain step strip — a labeled dot per step, current highlighted. */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label="Steps">
        {stepTitles.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                  done
                    ? "bg-primary text-on-primary"
                    : active
                      ? "bg-primary/15 text-primary ring-1 ring-primary"
                      : "bg-muted text-muted-foreground"
                }`}
                data-testid={`wizard-step-dot-${i}`}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
              {i < stepTitles.length - 1 ? <span className="text-muted-foreground/40">→</span> : null}
            </li>
          );
        })}
      </ol>

      <Card>
        <CardContent className="space-y-4 pt-6">{children}</CardContent>
      </Card>

      <div className="flex items-center justify-between">
        {current === 0 ? (
          <Button asChild variant="ghost" data-testid="wizard-cancel">
            <Link href="/app/board-home">
              <ArrowLeft className="mr-1 h-4 w-4" /> Cancel
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" onClick={onBack} disabled={busy} data-testid="wizard-back">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        )}
        <Button onClick={onNext} disabled={!canAdvance || busy} data-testid="wizard-next">
          {isLastStep ? (
            <>
              {busy ? "Saving…" : finishLabel}
              {!busy && <CheckCircle2 className="ml-1 h-4 w-4" />}
            </>
          ) : (
            <>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/** A labeled review line used on every wizard's final Review step. */
export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** Shared success panel every wizard shows after a save. */
export function WizardDone({
  message,
  onAgain,
  againLabel = "Do another",
  testId,
}: {
  message: string;
  onAgain: () => void;
  againLabel?: string;
  testId?: string;
}) {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 p-8 text-center"
      data-testid={testId ?? "board-wizard-done"}
    >
      <CheckCircle2 className="h-14 w-14 text-emerald-500" aria-hidden="true" />
      <h1 className="font-headline text-2xl font-bold">Done</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" onClick={onAgain} data-testid="wizard-again">
          {againLabel}
        </Button>
        <Button asChild data-testid="wizard-home">
          <Link href="/app/board-home">Back to my board</Link>
        </Button>
      </div>
    </div>
  );
}
