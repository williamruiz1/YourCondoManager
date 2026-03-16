import { ArrowRight, BadgeCheck, Building2, FileText, LockKeyhole, MessageSquare, Wallet, Workflow } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LandingPageProps = {
  hasWorkspaceAccess: boolean;
  onOpenAdminAuth: () => void;
  onStartGoogleSignIn: () => void;
};

const pillars = [
  {
    title: "From scattered tools to one command center",
    description: "Replace spreadsheets, inbox threads, and disconnected software with one live system for the portfolio.",
    icon: Workflow,
  },
  {
    title: "Modern finance and records",
    description: "Run billing, ledger, budgets, utilities, documents, and ownership records in a clean operational flow.",
    icon: Wallet,
  },
  {
    title: "Faster resident and board service",
    description: "Move communications, portal access, and operational updates into the same place the work already happens.",
    icon: MessageSquare,
  },
];

const highlights = [
  {
    title: "Built around the property",
    summary: "Units, owners, occupancy, board records, and documents stay connected instead of living in separate systems.",
    icon: Building2,
  },
  {
    title: "Clear portfolio visibility",
    summary: "Leadership gets a portfolio-wide view with the ability to move straight into operational detail.",
    icon: BadgeCheck,
  },
  {
    title: "Modern access",
    summary: "Google sign-in handles day-to-day entry, with admin auth available for setup and operational recovery.",
    icon: LockKeyhole,
  },
];

export default function LandingPage({ hasWorkspaceAccess, onOpenAdminAuth, onStartGoogleSignIn }: LandingPageProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,83,45,0.12),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)))]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-8 md:px-10 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">CondoManager</div>
              <div className="text-sm text-muted-foreground">Operating system for condo portfolios</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onOpenAdminAuth} data-testid="button-landing-admin-auth">
              Admin Auth
            </Button>
            <Button
              variant="default"
              onClick={onStartGoogleSignIn}
              data-testid="button-landing-google-signin"
            >
              Sign in with Google
            </Button>
            <Button asChild data-testid="button-landing-open-workspace">
              <Link href="/app">
                Open Workspace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
              Property management modernized
            </Badge>
            <div className="max-w-3xl space-y-4">
              <h1 className="font-serif text-5xl leading-none tracking-tight text-foreground sm:text-6xl">
                Modern property management for associations that have outgrown patchwork operations.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                CondoManager turns association operations into a connected system for portfolio oversight, financial control,
                board governance, resident service, and day-to-day property execution.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {pillars.map((pillar) => (
                <Card key={pillar.title} className="border-border/70 bg-card/90 shadow-sm backdrop-blur">
                  <CardHeader className="space-y-3">
                    <pillar.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{pillar.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{pillar.description}</CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="border-border/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.86),_rgba(244,247,245,0.96))] shadow-xl">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge className="rounded-full">Platform snapshot</Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Modern operations stack
                </div>
              </div>
              <CardTitle className="text-2xl">What modernization looks like in practice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {highlights.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2 font-medium">
                    <item.icon className="h-4 w-4 text-primary" />
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
