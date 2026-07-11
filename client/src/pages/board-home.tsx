// founder-os#9487 — Board mode home.
//
// The volunteer board's landing surface: a warm plain-English welcome and the
// five most common actions as big tap targets that launch guided wizards. This
// is intentionally NOT the manager dashboard (KPIs, portfolio health, GL) — a
// board member wants "what can I do" not "here are your metrics".

import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useActiveAssociation } from "@/hooks/use-active-association";
import { BOARD_ACTIONS } from "@/components/board-mode/board-actions";

export default function BoardHomePage() {
  const { activeAssociationName } = useActiveAssociation();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6" data-testid="board-home">
      <header className="space-y-1.5">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          {activeAssociationName ? `${activeAssociationName}` : "Your board"}
        </h1>
        <p className="text-muted-foreground">What would you like to do? Pick an action and we'll walk you through it.</p>
      </header>

      <section aria-label="Common actions">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Common tasks</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BOARD_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.id} href={action.href} data-testid={`board-action-${action.id}`}>
                <Card className="group flex h-full cursor-pointer flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-headline text-lg font-bold leading-tight">{action.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">
                    Start <ArrowRight className="h-4 w-4" />
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Need the full manager tools? Use <span className="font-medium">Show advanced view</span> in the sidebar or switch to Manager view in Settings.
      </p>
    </div>
  );
}
