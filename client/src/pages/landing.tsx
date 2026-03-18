import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  LockKeyhole,
  MessageSquare,
  Scale,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LandingPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

type Audience = "manager" | "self-managed";

const audienceContent = {
  manager: {
    badge: "For property management companies",
    headline: "Run your entire condo portfolio from one place.",
    subheadline:
      "CondoManager gives property managers a single command center for every association — billing, owners, maintenance, governance, and reporting — without the spreadsheets.",
    features: [
      {
        icon: BarChart3,
        title: "Portfolio-wide visibility",
        description:
          "See every association's financial health, open work orders, and compliance status at a glance. Drill into any property in one click.",
      },
      {
        icon: Wallet,
        title: "Automated billing & ledger",
        description:
          "Run assessments, late fees, utility billing, and recurring charges across all properties. Keep every ledger clean and audit-ready.",
      },
      {
        icon: Workflow,
        title: "Operational efficiency",
        description:
          "Centralize vendors, work orders, maintenance schedules, and owner communications so your team spends less time on admin.",
      },
      {
        icon: FileText,
        title: "Board-ready reporting",
        description:
          "Generate financial reports, board packages, and meeting minutes without exporting to a third tool.",
      },
    ],
    ctaPrimary: "Get started — it's free",
    ctaSecondary: "See it in action",
    ctaPanelLabel: "Start managing your portfolio",
    proof: [
      "Manage dozens of associations from one login",
      "Role-based access for your whole team",
      "No per-association setup headaches",
      "Consistent workflow across every property",
    ],
  },
  "self-managed": {
    badge: "For self-managed condo associations",
    headline: "Run your association like a pro — without hiring one.",
    subheadline:
      "CondoManager gives volunteer boards the tools to handle finances, governance, residents, and maintenance without expensive management fees or complicated software.",
    features: [
      {
        icon: DollarSign,
        title: "Clear, simple finances",
        description:
          "Collect assessments, track expenses, manage budgets, and produce financial statements your board and owners can actually understand.",
      },
      {
        icon: Scale,
        title: "Governance made easy",
        description:
          "Store governing documents, track board decisions, manage meeting minutes, and stay compliant — all in one place.",
      },
      {
        icon: Users,
        title: "Owner & resident portal",
        description:
          "Give owners a portal to view their account, pay dues, submit requests, and access documents without calling a board member.",
      },
      {
        icon: ClipboardList,
        title: "Maintenance tracking",
        description:
          "Log work orders, track vendor activity, and build maintenance schedules so nothing falls through the cracks.",
      },
    ],
    ctaPrimary: "Start managing your association",
    ctaSecondary: "See what's included",
    ctaPanelLabel: "Set up your association today",
    proof: [
      "No property management experience required",
      "Designed for board volunteers, not accountants",
      "Residents stay informed automatically",
      "All your records in one secure place",
    ],
  },
};

const sharedCapabilities = [
  {
    icon: Building2,
    title: "Built around the property",
    summary:
      "Units, owners, occupancy, board records, and documents stay connected instead of living in separate systems.",
  },
  {
    icon: BadgeCheck,
    title: "Always audit-ready",
    summary:
      "Every transaction, document, and communication is logged so you're always prepared for owners, auditors, or boards.",
  },
  {
    icon: LockKeyhole,
    title: "Secure, role-based access",
    summary:
      "Google sign-in with role-based permissions scoped by association and function — no shared passwords.",
  },
  {
    icon: MessageSquare,
    title: "Resident communications",
    summary:
      "Send announcements, manage feedback, and keep residents informed from the same place you run operations.",
  },
];

export default function LandingPage({ hasWorkspaceAccess, onStartGoogleSignIn }: LandingPageProps) {
  const [audience, setAudience] = useState<Audience>("manager");
  const content = audienceContent[audience];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,83,45,0.12),_transparent_28%),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)))]">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 lg:px-12 space-y-20">

        {/* Nav */}
        <nav className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">CondoManager</div>
              <div className="text-sm text-muted-foreground">Operating system for condo associations</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasWorkspaceAccess ? (
              <Button asChild data-testid="button-landing-open-workspace">
                <Link href="/app">
                  Open Workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button variant="default" onClick={onStartGoogleSignIn} data-testid="button-landing-google-signin">
                Sign in with Google
              </Button>
            )}
          </div>
        </nav>

        {/* Hero */}
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
            Condo association software
          </Badge>
          <h1 className="font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
            Everything your association needs. Nothing it doesn't.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you manage a portfolio of associations or run your own building, CondoManager gives you the tools
            to handle finances, governance, residents, and operations in one connected system.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!hasWorkspaceAccess && (
              <Button size="lg" onClick={onStartGoogleSignIn}>
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {hasWorkspaceAccess && (
              <Button size="lg" asChild>
                <Link href="/app">
                  Open Workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </section>

        {/* Audience toggle */}
        <section className="space-y-10">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Who are you?</p>
            <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm gap-1">
              <button
                onClick={() => setAudience("manager")}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all",
                  audience === "manager"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Property Manager
              </button>
              <button
                onClick={() => setAudience("self-managed")}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all",
                  audience === "self-managed"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Self-Managed Association
              </button>
            </div>
          </div>

          {/* Audience-specific content */}
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                {content.badge}
              </Badge>
              <div className="space-y-4">
                <h2 className="font-serif text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">
                  {content.headline}
                </h2>
                <p className="text-lg text-muted-foreground max-w-xl">
                  {content.subheadline}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {content.features.map((feature) => (
                  <Card key={feature.title} className="border-border/70 bg-card/90 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-3 pb-2">
                      <feature.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">{feature.description}</CardContent>
                  </Card>
                ))}
              </div>

              {/* Audience CTA row */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {hasWorkspaceAccess ? (
                  <Button size="lg" asChild>
                    <Link href="/app">
                      Open Workspace <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" onClick={onStartGoogleSignIn}>
                      {content.ctaPrimary} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button size="lg" variant="outline" onClick={onStartGoogleSignIn}>
                      {content.ctaSecondary}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Proof panel */}
            <Card className="border-border/70 bg-[linear-gradient(180deg,_rgba(255,255,255,0.86),_rgba(244,247,245,0.96))] shadow-xl self-start">
              <CardHeader className="space-y-4">
                <Badge className="rounded-full w-fit">
                  {audience === "manager" ? "Built for managers" : "Built for boards"}
                </Badge>
                <CardTitle className="text-2xl">Why teams choose CondoManager</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {content.proof.map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{point}</p>
                  </div>
                ))}
                <div className="pt-2">
                  {hasWorkspaceAccess ? (
                    <Button className="w-full" asChild>
                      <Link href="/app">Open Workspace <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={onStartGoogleSignIn}>
                      {content.ctaPanelLabel} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Shared capabilities */}
        <section className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-3xl tracking-tight text-foreground">
              One platform. Every association need.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              These capabilities are included for every CondoManager account, regardless of how you use it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sharedCapabilities.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur space-y-3"
              >
                <item.icon className="h-5 w-5 text-primary" />
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="rounded-3xl border border-border/70 bg-card/90 shadow-sm px-8 py-12 text-center space-y-6">
          <h2 className="font-serif text-3xl tracking-tight text-foreground">
            Ready to modernize your operations?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Get started in minutes. No setup fees, no long-term contracts — just a cleaner way to run your association.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {hasWorkspaceAccess ? (
              <Button size="lg" asChild>
                <Link href="/app">Open Workspace <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            ) : (
              <Button size="lg" onClick={onStartGoogleSignIn}>
                Sign in with Google
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </section>

        <footer className="text-center text-sm text-muted-foreground pb-8">
          © {new Date().getFullYear()} CondoManager. Built for associations that want to run better.
        </footer>
      </div>
    </main>
  );
}
