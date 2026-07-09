// founder-os#9487 — Board vs Manager mode selector.
//
// Shown once at signup (the first workspace load before a mode is chosen) as a
// full-screen gate, and re-usable from Settings so a user who holds both roles
// can switch. Picking a card persists the choice via `chooseMode` and marks the
// selector as answered so it never blocks again unless the user reopens it.

import { Link } from "wouter";
import { ClipboardList, Building2, Check, type LucideIcon } from "lucide-react";
import { chooseMode, useViewMode, type ViewMode } from "@/context/view-mode";

type ModeOption = {
  mode: ViewMode;
  title: string;
  tagline: string;
  bullets: string[];
  icon: LucideIcon;
};

const OPTIONS: ModeOption[] = [
  {
    mode: "board",
    title: "I'm on a volunteer board",
    tagline: "Simple, plain-English tools for board members.",
    bullets: [
      "Guided step-by-step for common tasks",
      "No accounting jargon",
      "Just the essentials",
    ],
    icon: ClipboardList,
  },
  {
    mode: "manager",
    title: "I'm a property manager",
    tagline: "The full toolkit for trained managers.",
    bullets: [
      "Every financial & operations surface",
      "Multiple communities",
      "Advanced reporting",
    ],
    icon: Building2,
  },
];

export function ModeSelector({ onChosen }: { onChosen?: (mode: ViewMode) => void }) {
  const { mode: current } = useViewMode();

  function pick(mode: ViewMode) {
    chooseMode(mode);
    onChosen?.(mode);
  }

  return (
    <div className="w-full max-w-3xl space-y-6" data-testid="mode-selector">
      <div className="space-y-2 text-center">
        <h1 className="font-headline text-3xl font-bold tracking-tight">How will you use Your Condo Manager?</h1>
        <p className="text-sm text-muted-foreground">Pick the view that fits you. You can change this anytime in Settings.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = current === opt.mode;
          return (
            <button
              key={opt.mode}
              onClick={() => pick(opt.mode)}
              data-testid={`mode-option-${opt.mode}`}
              className={`group flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all hover:shadow-md ${
                selected ? "border-primary bg-primary/[0.03]" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-headline text-lg font-bold">{opt.title}</h2>
                <p className="text-sm text-muted-foreground">{opt.tagline}</p>
              </div>
              <ul className="mt-1 space-y-1.5">
                {opt.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
              <span className="mt-2 text-sm font-semibold text-primary group-hover:underline">Choose this →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Full-screen first-run gate wrapper (rendered before the app when no mode chosen). */
export function ModeSelectorGate() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <ModeSelector />
    </div>
  );
}

/** Inline settings variant with a confirmation affordance. */
export function ModeSelectorInline() {
  const { mode } = useViewMode();
  return (
    <div className="space-y-4">
      <ModeSelector />
      <p className="text-center text-xs text-muted-foreground">
        Current view: <span className="font-semibold capitalize">{mode}</span>{" "}
        <Link href="/app/board-home" className="font-medium text-primary underline hover:no-underline">
          Go to my board
        </Link>
      </p>
    </div>
  );
}
