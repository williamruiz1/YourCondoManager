import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileArchive,
  FileText,
  Lock,
  Menu,
  MessageSquare,
  Shield,
  Users,
  Vote,
  Wrench,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LandingPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

type Persona = "manager" | "board" | "resident";

const personaContent = {
  manager: {
    badge: "For property management companies",
    headline: "Run your entire portfolio from one command center.",
    subhead:
      "CondoManager gives property managers a single platform for every association — billing, owners, maintenance, governance, and reporting — without the spreadsheets.",
    features: [
      {
        icon: BarChart3,
        title: "Portfolio-wide visibility",
        description:
          "See every association's financial health, open work orders, and compliance status at a glance. Drill into any property in one click.",
      },
      {
        icon: DollarSign,
        title: "Automated billing & ledger",
        description:
          "Run assessments, late fees, utility billing, and recurring charges across all properties. Keep every ledger clean and audit-ready.",
      },
      {
        icon: FileText,
        title: "Board-ready reporting",
        description:
          "Generate financial reports, board packages, and meeting minutes without exporting to a third tool.",
      },
      {
        icon: Users,
        title: "Role-based team access",
        description:
          "Invite your whole team with scoped permissions per association — no shared passwords, no access sprawl.",
      },
    ],
    ctaPrimary: "Get started — it's free",
    ctaSecondary: "Schedule a demo",
    proof: [
      "Manage dozens of associations from one login",
      "Role-based access for your whole team",
      "No per-association setup headaches",
      "Consistent workflow across every property",
    ],
  },
  board: {
    badge: "For self-managed condo boards",
    headline: "Give your board the tools to govern with confidence.",
    subhead:
      "CondoManager gives volunteer boards everything needed to handle finances, governance, residents, and maintenance — without expensive management fees or complicated software.",
    features: [
      {
        icon: DollarSign,
        title: "Clear, simple finances",
        description:
          "Collect assessments, track expenses, manage budgets, and produce statements your board and owners can actually understand.",
      },
      {
        icon: ClipboardCheck,
        title: "Governance made easy",
        description:
          "Store governing documents, track board decisions, manage meeting minutes, and stay compliant — all in one place.",
      },
      {
        icon: Users,
        title: "Owner & resident portal",
        description:
          "Give owners a portal to view their account, pay dues, and access documents without calling a board member.",
      },
      {
        icon: Wrench,
        title: "Maintenance tracking",
        description:
          "Log work orders, track vendor activity, and build maintenance schedules so nothing falls through the cracks.",
      },
    ],
    ctaPrimary: "Start managing your association",
    ctaSecondary: "See what's included",
    proof: [
      "No property management experience required",
      "Designed for board volunteers, not accountants",
      "Residents stay informed automatically",
      "All your records in one secure place",
    ],
  },
  resident: {
    badge: "For residents & homeowners",
    headline: "Stay connected and in control of your home.",
    subhead:
      "Access your account, pay dues online, track maintenance requests, and stay informed about your community — all without making a phone call.",
    features: [
      {
        icon: DollarSign,
        title: "Pay dues online",
        description:
          "View your account balance, pay assessments, and download statements from any device, any time.",
      },
      {
        icon: Wrench,
        title: "Submit & track requests",
        description:
          "Create maintenance requests and follow their status in real time — no chasing the board down.",
      },
      {
        icon: FileArchive,
        title: "Community documents",
        description:
          "Access bylaws, meeting minutes, rules, and notices whenever you need them, all in one place.",
      },
      {
        icon: MessageSquare,
        title: "Stay informed",
        description:
          "Receive announcements, board updates, and community news delivered straight to you.",
      },
    ],
    ctaPrimary: "Access your portal",
    ctaSecondary: "Learn more",
    proof: [
      "Pay dues anytime, from any device",
      "No more chasing the board for information",
      "Your full account history always accessible",
      "Stay in the loop on community updates",
    ],
  },
};

const bentoFeatures = [
  {
    icon: DollarSign,
    title: "Automated Dues",
    description:
      "Run assessments, collect payments, and track balances automatically. No manual reconciliation required.",
    featured: false,
  },
  {
    icon: Wrench,
    title: "Maintenance Hub",
    description:
      "Work orders, vendor management, and maintenance schedules unified in one place.",
    featured: false,
  },
  {
    icon: FileArchive,
    title: "Smart Archives",
    description:
      "Store and retrieve every document — from governing docs to meeting minutes — instantly.",
    featured: false,
  },
  {
    icon: MessageSquare,
    title: "Mass Communications",
    description:
      "Send announcements, notices, and updates to all residents or targeted groups.",
    featured: false,
  },
  {
    icon: BarChart3,
    title: "Real-time Financial Reporting",
    description:
      "Live dashboards, income statements, balance sheets, and budget vs. actual reports. Always audit-ready, always current.",
    featured: true,
  },
  {
    icon: Vote,
    title: "Digital Voting",
    description:
      "Run board elections and community votes digitally with a complete, immutable audit trail.",
    featured: false,
  },
  {
    icon: Calendar,
    title: "Amenity Booking",
    description:
      "Let residents book shared spaces online. Automated confirmations, no paper sign-up sheets.",
    featured: false,
  },
];

const auditLogEntries = [
  { time: "09:41", action: "Document accessed: 2024 Annual Budget.pdf", user: "M. Chen" },
  { time: "09:38", action: "Payment received: Unit 14B — $450.00", user: "System" },
  { time: "09:31", action: "Board vote recorded: Emergency repairs — 5/5", user: "R. Patel" },
  { time: "09:20", action: "New work order #447: Lobby HVAC inspection", user: "J. Torres" },
  { time: "09:12", action: "Owner portal login: Unit 7A", user: "System" },
  { time: "08:55", action: "Assessment run: Q1 dues — 48 units", user: "Admin" },
];

const personaLabels: Record<Persona, string> = {
  manager: "Property Managers",
  board: "Board Members",
  resident: "Residents",
};

export default function LandingPage({ hasWorkspaceAccess, onStartGoogleSignIn }: LandingPageProps) {
  const [persona, setPersona] = useState<Persona>("manager");
  const [animating, setAnimating] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function switchPersona(next: Persona) {
    if (next === persona) return;
    setAnimating(true);
    setTimeout(() => {
      setPersona(next);
      setAnimating(false);
    }, 160);
  }

  const content = personaContent[persona];
  const featuredCard = bentoFeatures.find((f) => f.featured)!;
  const regularCards = bentoFeatures.filter((f) => !f.featured);

  return (
    <div className="min-h-screen bg-background">

      {/* ── NAVIGATION ── */}
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-200",
          scrolled
            ? "bg-background/90 backdrop-blur-md border-b border-border/60 shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm tracking-tight">CondoManager</span>
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-0.5">
            <Link
              href="/"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Platform
            </Link>
            {["Solutions"].map((item) => (
              <button
                key={item}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
              >
                {item}
              </button>
            ))}
            <Link
              href="/pricing"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Pricing
            </Link>
          </nav>

          {/* CTAs — desktop */}
          <div className="hidden md:flex items-center gap-2">
            {hasWorkspaceAccess ? (
              <Button asChild>
                <Link href="/app">
                  Open Workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onStartGoogleSignIn}>
                  Sign in
                </Button>
                <Button size="sm" onClick={onStartGoogleSignIn}>
                  Get started free
                </Button>
              </>
            )}
          </div>

          {/* Hamburger — mobile */}
          <button
            className="md:hidden p-2 -mr-1 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-md px-6 py-4 space-y-1">
            <Link
              href="/"
              className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Platform
            </Link>
            {["Solutions"].map((item) => (
              <button
                key={item}
                className="w-full text-left px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
              >
                {item}
              </button>
            ))}
            <Link
              href="/pricing"
              className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Pricing
            </Link>
            <div className="pt-3 border-t border-border/60 flex flex-col gap-2">
              {hasWorkspaceAccess ? (
                <Button asChild>
                  <Link href="/app">
                    Open Workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={onStartGoogleSignIn}>Sign in</Button>
                  <Button onClick={onStartGoogleSignIn}>Get started free</Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_top_left,hsl(217_91%_42%/0.07),transparent)] pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-6 md:px-10 lg:px-12 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.95fr] lg:gap-16 items-center">

            {/* Left: copy */}
            <div className="space-y-8">
              <Badge
                variant="outline"
                className="rounded-full gap-1.5 px-3 py-1 text-xs border-primary/30 text-primary bg-primary/5"
              >
                <Shield className="h-3 w-3" />
                Architecture of Trust
              </Badge>

              <div className="space-y-5">
                <h1 className="font-serif text-5xl leading-[1.08] tracking-tight text-foreground sm:text-6xl lg:text-[3.25rem] xl:text-[3.75rem]">
                  Everything your association needs.{" "}
                  <span className="text-primary">Nothing it doesn't.</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                  The complete operating platform for condo associations — finances, governance,
                  residents, and operations in one connected system.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {hasWorkspaceAccess ? (
                  <Button size="lg" asChild>
                    <Link href="/app">
                      Open Workspace <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" onClick={onStartGoogleSignIn} data-testid="button-landing-google-signin">
                      Get started free <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button size="lg" variant="outline" onClick={onStartGoogleSignIn}>
                      Schedule a demo
                    </Button>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-1">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-foreground">1,500+</div>
                  <div className="text-sm text-muted-foreground">Communities managed</div>
                </div>
                <div className="hidden sm:block w-px h-8 bg-border" />
                <div>
                  <div className="text-2xl font-bold tracking-tight text-foreground">$4B+</div>
                  <div className="text-sm text-muted-foreground">In property assets</div>
                </div>
                <div className="hidden sm:block w-px h-8 bg-border" />
                <div>
                  <div className="text-2xl font-bold tracking-tight text-foreground">99.9%</div>
                  <div className="text-sm text-muted-foreground">Uptime SLA</div>
                </div>
              </div>
            </div>

            {/* Right: dashboard mockup */}
            <div className="relative">
              <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
                {/* Window chrome */}
                <div className="border-b border-border/60 bg-muted/40 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                  </div>
                  <div className="flex-1 text-center text-xs text-muted-foreground">
                    Sunset Ridge HOA — Financial Dashboard
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Stat tiles */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Collected", value: "$48,250", note: "+$2,100 MoM", positive: true },
                      { label: "Units Paid", value: "44 / 48", note: "91.7%", positive: true },
                      { label: "Outstanding", value: "$1,800", note: "4 units", positive: false },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg bg-background border border-border/60 p-2.5 space-y-0.5"
                      >
                        <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                        <div className="text-sm font-semibold text-foreground">{stat.value}</div>
                        <div
                          className={cn(
                            "text-[10px]",
                            stat.positive ? "text-green-600 dark:text-green-500" : "text-muted-foreground"
                          )}
                        >
                          {stat.note}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bar chart */}
                  <div className="rounded-lg border border-border/60 bg-background p-3 space-y-2">
                    <div className="text-xs font-medium text-foreground">Monthly collections</div>
                    <div className="flex items-end gap-1 h-14">
                      {[55, 68, 62, 76, 82, 74, 89, 92, 85, 97, 91, 100].map((h, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex-1 rounded-sm transition-all",
                            i === 11 ? "bg-primary" : "bg-primary/20"
                          )}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>Jan</span>
                      <span>Jun</span>
                      <span>Dec</span>
                    </div>
                  </div>

                  {/* Recent transactions */}
                  <div className="space-y-1.5">
                    {[
                      { unit: "4B", label: "Q1 Assessment", amount: "+$450" },
                      { unit: "12A", label: "Q1 Assessment", amount: "+$450" },
                      { unit: "7C", label: "Late fee applied", amount: "+$75" },
                    ].map((tx, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-background border border-border/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary">
                            {tx.unit}
                          </div>
                          <span className="text-muted-foreground">{tx.label}</span>
                        </div>
                        <span className="font-medium text-green-600 dark:text-green-500">{tx.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-3 hidden lg:flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span className="text-muted-foreground">
                  Audit log active ·{" "}
                  <span className="text-foreground font-medium">247 events today</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 space-y-16 pb-28">

        {/* ── PERSONA TOGGLE ── */}
        <section className="space-y-10">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Tailored for every role
            </p>
            {/* Scrollable on small screens */}
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex sm:justify-center">
              <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm gap-1 min-w-max">
                {(["manager", "board", "resident"] as Persona[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => switchPersona(p)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
                      persona === p
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {personaLabels[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "grid gap-8 lg:grid-cols-[1.25fr_0.75fr] transition-all duration-150",
              animating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            )}
          >
            {/* Left: persona content */}
            <div className="space-y-6">
              <Badge variant="outline" className="rounded-full text-xs">
                {content.badge}
              </Badge>
              <div className="space-y-3">
                <h2 className="font-serif text-4xl leading-tight tracking-tight text-foreground sm:text-[2.75rem]">
                  {content.headline}
                </h2>
                <p className="text-lg text-muted-foreground max-w-xl">{content.subhead}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {content.features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-xl border border-border/70 bg-card p-4 space-y-2 shadow-sm hover:shadow-md hover:border-border transition-all duration-200"
                  >
                    <feature.icon className="h-5 w-5 text-primary" />
                    <div className="text-sm font-semibold text-foreground">{feature.title}</div>
                    <div className="text-sm text-muted-foreground">{feature.description}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {hasWorkspaceAccess ? (
                  <Button size="lg" asChild>
                    <Link href="/pricing">
                      View pricing <ArrowRight className="ml-2 h-4 w-4" />
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

            {/* Right: proof card */}
            <div className="rounded-2xl border border-border/70 bg-card shadow-xl p-6 space-y-5 self-start">
              <div className="space-y-2">
                <Badge className="rounded-full text-xs">
                  {persona === "manager"
                    ? "Built for managers"
                    : persona === "board"
                    ? "Built for boards"
                    : "Built for residents"}
                </Badge>
                <h3 className="text-xl font-semibold text-foreground">
                  Why teams choose CondoManager
                </h3>
              </div>
              <div className="space-y-2">
                {content.proof.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-3.5"
                  >
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{point}</p>
                  </div>
                ))}
              </div>
              <div>
                {hasWorkspaceAccess ? (
                  <Button className="w-full" asChild>
                    <Link href="/pricing">
                      View pricing <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button className="w-full" onClick={onStartGoogleSignIn}>
                    {content.ctaPrimary} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── BENTO GRID ── */}
        <section className="space-y-10">
          <div className="text-center space-y-3">
            <Badge variant="secondary" className="rounded-full text-xs uppercase tracking-widest">
              Full platform
            </Badge>
            <h2 className="font-serif text-4xl tracking-tight text-foreground">
              Everything you need to run your association.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Purpose-built modules that work together — so you never lose context switching between
              tools.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Featured card — spans 2 columns */}
            <div className="sm:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/75 p-6 text-primary-foreground shadow-lg flex flex-col justify-between min-h-[200px]">
              <div className="space-y-3 relative z-10">
                <featuredCard.icon className="h-8 w-8 opacity-90" />
                <h3 className="text-xl font-semibold">{featuredCard.title}</h3>
                <p className="text-sm text-primary-foreground/80 max-w-xs leading-relaxed">
                  {featuredCard.description}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium opacity-80 relative z-10 pt-4">
                <span>Explore financial tools</span>
                <ArrowRight className="h-4 w-4" />
              </div>
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
              <div className="absolute bottom-0 right-10 w-28 h-28 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />
            </div>

            {/* Regular cards */}
            {regularCards.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-3 hover:shadow-md hover:border-border transition-all duration-200"
              >
                <feature.icon className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── COMPLIANCE & SECURITY ── */}
        <section className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left: copy */}
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge
                variant="outline"
                className="rounded-full gap-1.5 text-xs border-primary/30 text-primary bg-primary/5"
              >
                <Shield className="h-3 w-3" />
                Compliance &amp; Security
              </Badge>
              <h2 className="font-serif text-4xl leading-tight tracking-tight text-foreground">
                Audit-ready by design.
              </h2>
              <p className="text-lg text-muted-foreground">
                Every transaction, document, and action is logged with a complete audit trail — so
                you're always prepared for owners, auditors, or regulatory review.
              </p>
            </div>
            <div className="space-y-3">
              {[
                {
                  icon: ClipboardCheck,
                  title: "Audit-ready records",
                  description:
                    "Complete financial and operational history, retained securely and exportable on demand.",
                },
                {
                  icon: Lock,
                  title: "Secure, role-based access",
                  description:
                    "Google sign-in with granular permissions scoped by association and function. No shared passwords.",
                },
                {
                  icon: Shield,
                  title: "Immutable activity log",
                  description:
                    "Every login, document view, payment, and vote is time-stamped and attributed to a specific user.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm"
                >
                  <item.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: security log mockup */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-xl overflow-hidden">
            <div className="border-b border-border/60 bg-muted/40 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Security Audit Log
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </div>
            </div>
            <div className="p-4 space-y-0 font-mono text-xs">
              {auditLogEntries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0"
                >
                  <span className="text-primary/70 shrink-0 tabular-nums pt-px">{entry.time}</span>
                  <span className="text-muted-foreground flex-1 leading-relaxed">{entry.action}</span>
                  <span className="text-muted-foreground/50 shrink-0">{entry.user}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border/60 bg-muted/20">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">247 events</span> logged in the last
                24 hours
              </div>
            </div>
          </div>
        </section>

        {/* ── DARK CTA CANVAS ── */}
        <section className="rounded-3xl overflow-hidden bg-slate-900 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_top_right,hsl(217_91%_48%/0.18),transparent)] pointer-events-none" />
          <div className="relative px-8 py-16 md:py-20 text-center space-y-8">
            <div className="space-y-4">
              <Badge
                variant="outline"
                className="rounded-full border-white/20 text-white/80 bg-white/5 text-xs"
              >
                Get started today
              </Badge>
              <h2 className="font-serif text-4xl tracking-tight text-white md:text-5xl">
                Ready to modernize your operations?
              </h2>
              <p className="text-white/60 max-w-lg mx-auto text-lg">
                Get started in minutes. No setup fees, no long-term contracts — just a cleaner way
                to run your association.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {hasWorkspaceAccess ? (
                <Button
                  size="lg"
                  asChild
                  className="bg-white text-slate-900 hover:bg-white/90"
                >
                  <Link href="/pricing">
                    View pricing <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="bg-white text-slate-900 hover:bg-white/90"
                    onClick={onStartGoogleSignIn}
                    data-testid="button-landing-open-workspace"
                  >
                    Start your free trial <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 hover:text-white"
                    onClick={onStartGoogleSignIn}
                  >
                    Speak with an expert
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">CondoManager</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CondoManager. Built for associations that want to run
            better.
          </p>
        </div>
      </footer>
    </div>
  );
}
