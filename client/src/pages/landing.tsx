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
import DemoRequestModal from "@/components/demo-request-modal";

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
      "Your Condo Manager gives property managers a single platform for every association — billing, owners, maintenance, governance, and reporting — without the spreadsheets.",
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
      "Your Condo Manager gives volunteer boards everything needed to handle finances, governance, residents, and maintenance — without expensive management fees or complicated software.",
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
    title: "Board Vote Tracking",
    description:
      "Record resolutions, track votes, and monitor quorum status during board meetings with a full audit trail.",
    featured: false,
  },
  {
    icon: Calendar,
    title: "Inspections & Schedules",
    description:
      "Schedule recurring property inspections, track findings, and build maintenance schedules so nothing falls through the cracks.",
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
  const [demoModalOpen, setDemoModalOpen] = useState(false);

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
    <div className="min-h-screen bg-white dark:bg-slate-950">

      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-primary focus:px-4 focus:py-2 focus:rounded focus:shadow-md focus:font-bold"
      >
        Skip to main content
      </a>

      {/* ── NAVIGATION ── */}
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-serif italic">Your Condo Manager</span>
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            <Link
              href="/"
              aria-current="page"
              className="text-blue-700 dark:text-blue-400 font-bold border-b-2 border-blue-700 dark:border-blue-400 pb-1"
            >
              Platform
            </Link>
            <Link
              href="/solutions"
              className="text-slate-600 dark:text-slate-400 font-medium hover:text-blue-600 transition-colors duration-300"
            >
              Solutions
            </Link>
            <Link
              href="/pricing"
              className="text-slate-600 dark:text-slate-400 font-medium hover:text-blue-600 transition-colors duration-300"
            >
              Pricing
            </Link>
          </nav>

          {/* CTAs — desktop */}
          <div className="hidden md:flex items-center gap-4">
            {hasWorkspaceAccess ? (
              <Button asChild>
                <Link href="/app">
                  Open Workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <button className="text-slate-600 font-medium hover:text-primary transition-colors" onClick={onStartGoogleSignIn}>
                  Sign In
                </button>
                <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-5 py-2 rounded font-semibold scale-95 active:opacity-80 transition-all" onClick={onStartGoogleSignIn}>
                  Open Workspace
                </button>
              </>
            )}
          </div>

          {/* Hamburger — mobile */}
          <button
            className="md:hidden p-2 -mr-1 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 py-4 space-y-1">
            <Link
              href="/"
              className="block px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Platform
            </Link>
            <Link
              href="/solutions"
              className="block px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Solutions
            </Link>
            <Link
              href="/pricing"
              className="block px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Pricing
            </Link>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              {hasWorkspaceAccess ? (
                <Button asChild>
                  <Link href="/app">
                    Open Workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <button className="px-4 py-2 text-slate-600 font-medium hover:text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded" onClick={onStartGoogleSignIn}>Sign In</button>
                  <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-2 rounded font-semibold active:opacity-80 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={onStartGoogleSignIn}>Open Workspace</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section id="main-content" className="relative px-8 py-12 md:py-20 max-w-7xl mx-auto overflow-hidden pt-24 md:pt-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="z-10">
            <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold tracking-widest uppercase mb-4">Architecture of Trust</span>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-on-surface mb-6">
              Everything your association needs. <span className="text-primary italic">Nothing it doesn't.</span>
            </h1>
            <p className="text-on-surface-variant text-lg md:text-xl max-w-xl mb-8 leading-relaxed">
              The definitive platform for modern property governance. Streamline operations, empower boards, and engage residents with structural clarity.
            </p>
            <div className="flex flex-wrap gap-4">
              {hasWorkspaceAccess ? (
                <Button size="lg" asChild>
                  <Link href="/app">
                    Open Workspace <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <button className="bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={onStartGoogleSignIn} data-testid="button-landing-google-signin">
                    Get Started Free
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                  </button>
                  <button className="px-8 py-4 text-primary font-bold hover:bg-surface-container transition-colors rounded-lg" onClick={() => setDemoModalOpen(true)}>
                    Schedule Demo
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="relative lg:block hidden">
            <div className="absolute -inset-4 bg-primary-container/5 rounded-xl blur-3xl"></div>
            <div className="relative bg-surface-container-lowest rounded-xl overflow-hidden shadow-lg border border-outline-variant/20">
              <img className="w-full h-[400px] object-cover opacity-90" alt="Modern architectural glass facade reflecting a clear blue sky with sophisticated structural lines and high-end professional aesthetic" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDORRxFHQEQQgLB-LIhVTxXwSjX3PFwaeqJK47VYkPcV7-8kExURnYNhcett0B3XsY4Furz0oLDNIL-hv5Gb-CtAJH4O1AQTQEiZegVanQLHzPcE9R5gOcmtSizhcBoPPEw0nyDF5-NDpn_MBo8VnLFFGCe_W0Hr6ohoNeQqB_gs0bschoj3OyC0Ky9FESgTtEANJ0OMhmC_OsDwF8NH4wwFLcjU8Nvh5tQ7evgrRtIJUHxITX__w9M_c4mPyGx2b123CkVsDXtk84" />
              <div className="absolute bottom-6 left-6 right-6 bg-white/40 backdrop-blur-xl p-6 rounded-lg border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white" aria-hidden="true">
                    <span className="material-symbols-outlined">insights</span>
                  </div>
                  <div>
                    <p className="text-sm font-label font-bold text-on-surface">Live Dashboard</p>
                    <p className="text-xs text-on-surface-variant">Real-time financial transparency for 2024</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="space-y-0 pb-0">

        {/* ── PERSONA TOGGLE ── */}
        <section className="bg-surface-container py-8 border-y border-outline-variant/10">
          <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-center gap-6">
            <span id="persona-toggle-label" className="font-label text-sm font-bold text-on-surface-variant uppercase tracking-widest">Tailored for you:</span>
            <div role="group" aria-labelledby="persona-toggle-label" className="flex p-1 bg-surface-container-high rounded-lg border border-outline-variant/20">
              {(["manager", "board", "resident"] as Persona[]).map((p) => (
                <button
                  key={p}
                  onClick={() => switchPersona(p)}
                  aria-pressed={persona === p}
                  className={cn(
                    "px-6 py-2 font-bold rounded transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                    persona === p
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {personaLabels[p]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── PERSONA CONTENT SLIDE ── */}
        <section className="max-w-7xl mx-auto px-8 py-20">
          <div aria-live="polite" aria-atomic="true" className={cn("space-y-8 motion-safe:transition-opacity motion-safe:duration-150", animating && "motion-safe:opacity-50")}>
            <div>
              <Badge className="mb-4">{content.badge}</Badge>
              <h2 className="font-serif text-4xl md:text-5xl font-bold leading-tight text-on-surface mb-4">
                {content.headline}
              </h2>
              <p className="text-on-surface-variant text-lg md:text-xl max-w-2xl mb-8">
                {content.subhead}
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="bg-primary text-white px-8 py-3 rounded-lg font-bold hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setDemoModalOpen(true)}>
                  {content.ctaPrimary}
                </button>
                <button className="border border-primary text-primary px-8 py-3 rounded-lg font-bold hover:bg-primary/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setDemoModalOpen(true)}>
                  {content.ctaSecondary}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mt-12">
              {content.features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface mb-1">{feature.title}</h3>
                      <p className="text-sm text-on-surface-variant">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 pt-12 border-t border-outline-variant/10">
              <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-6">Why {personaLabels[persona].toLowerCase()}:</p>
              <div className="grid md:grid-cols-2 gap-4">
                {content.proof.map((item) => (
                  <div key={item} className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-on-surface">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── BENTO GRID ── */}
        <section className="max-w-7xl mx-auto px-8 py-16 space-y-10">
          <div className="mb-12">
            <h2 className="font-headline text-3xl md:text-4xl font-bold text-on-surface">Integrated Excellence</h2>
            <p className="text-on-surface-variant mt-2">Professional tools designed for the complexities of modern estates.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>account_balance_wallet</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">Automated Dues</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Collect payments and generate late notices without manual intervention.</p>
            </div>

            {/* Card 2 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>engineering</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">Maintenance Hub</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Track work orders from submission to completion. Manage vendors and schedule recurring maintenance in one place.</p>
            </div>

            {/* Card 3 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>description</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">Smart Archives</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Store and retrieve governing documents, meeting minutes, and notices — organized, accessible, and always up to date.</p>
            </div>

            {/* Card 4 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>campaign</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">Mass Comms</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Send announcements, notices, and updates to all residents or targeted groups via email — directly from the platform.</p>
            </div>

            {/* Card 5 - Span 2 */}
            <div className="md:col-span-2 bg-gradient-to-br from-primary to-primary-container p-8 rounded-xl shadow-lg text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="font-headline text-2xl font-bold mb-4">Real-time Financial Reporting</h3>
                <p className="max-w-md mb-6 text-on-primary-container">Generate balance sheets, income statements, and budget comparisons with a single click. No more waiting for end-of-month reconciliations.</p>
                <button className="bg-white text-primary px-6 py-2 rounded font-bold text-sm hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => setDemoModalOpen(true)}>Explore Analytics</button>
              </div>
              <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl opacity-10 group-hover:scale-110 transition-transform" aria-hidden="true">monitoring</span>
            </div>

            {/* Card 6 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>how_to_reg</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">Board Vote Tracking</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Record resolutions, track votes, and confirm quorum during board meetings — with a complete audit trail.</p>
            </div>

            {/* Card 7 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>calendar_month</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">Inspections & Schedules</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Schedule and track property inspections, log findings, and manage recurring maintenance across all your buildings.</p>
            </div>
          </div>
        </section>

        {/* ── COMPLIANCE & SECURITY ── */}
        <section aria-labelledby="compliance-heading" className="max-w-7xl mx-auto px-8 pb-20">
          <div className="bg-surface-container-highest/30 rounded-2xl p-8 md:p-12 flex flex-col lg:flex-row items-center gap-12 border border-outline-variant/10">
          <div className="flex-1 space-y-8">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm" aria-hidden="true">
                <span className="material-symbols-outlined text-primary">verified_user</span>
              </div>
              <div>
                <h2 id="compliance-heading" className="font-headline text-2xl font-bold mb-2">Always Audit-Ready</h2>
                <p className="text-on-surface-variant leading-relaxed">Every transaction, vote, and communication is timestamped and immutable. Your Condo Manager ensures your association meets state regulations effortlessly.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm" aria-hidden="true">
                <span className="material-symbols-outlined text-primary">encrypted</span>
              </div>
              <div>
                <h3 className="font-headline text-2xl font-bold mb-2">Secure Institutional Access</h3>
                <p className="text-on-surface-variant leading-relaxed">Bank-grade encryption and 2FA protect sensitive owner data. Granular permissions ensure board members only see what they need to.</p>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full max-w-md">
            <div className="bg-white p-4 rounded-xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b pb-4 border-surface-container">
                <span className="font-bold text-sm">Security Log</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">ACTIVE</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant italic">Aug 24, 14:02</span>
                  <span className="text-on-surface font-medium">Backup completed (Encrypted)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant italic">Aug 24, 13:45</span>
                  <span className="text-on-surface font-medium">New admin login: J. Smith</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant italic">Aug 24, 11:20</span>
                  <span className="text-on-surface font-medium">Annual Audit Trail Exported</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* ── DARK CTA CANVAS ── */}
        <section className="relative rounded-3xl overflow-hidden py-20 px-8 text-center bg-slate-900 max-w-7xl mx-auto mb-32">
          <div className="absolute inset-0 opacity-20">
            <img className="w-full h-full object-cover" alt="" aria-hidden="true" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGylkVvJ6DR43ZSa3V5HhWYa4Tm_rV6NrxTJw7NwAHUssjyQI9IHIa5AtnSzWE4jalnOoKDh2PG82f2JXxDelDB9MraXOmdzj6Z3kAjShgD8G4Es537T5X_SqzvnFFjqgxLddQCR-aIR_-rTSWLC6Y3zAUVcdNFriTJRpEGXHl7xP0TnLB24YApCP8hIhS8U343a-5Q7cuVa-poEXGGv13F2V9xRt-XbskyOJKdcVLCJ7MbSGzlViwO5Y20scclZcr2JFpv6FYuvA" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-headline text-4xl md:text-5xl text-white font-bold mb-6">Ready to elevate your association?</h2>
            <p className="text-slate-300 text-lg mb-10">The modern platform for condo and HOA associations — built to handle finances, governance, residents, and maintenance in one place.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
                  <button className="bg-white text-slate-900 px-8 py-4 rounded-lg font-bold hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={onStartGoogleSignIn} data-testid="button-landing-open-workspace">
                    Start Your Free Trial
                  </button>
                  <button className="border border-white/30 text-white px-8 py-4 rounded-lg font-bold hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => setDemoModalOpen(true)}>
                    Speak with an Expert
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-slate-50 dark:bg-slate-900 w-full border-t border-slate-200 dark:border-slate-800" role="contentinfo">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-12 py-16 w-full max-w-screen-2xl mx-auto">
          <div className="space-y-6">
            <div className="text-xl font-serif text-slate-900 dark:text-slate-100">Your Condo Manager</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
              Setting the standard for architectural excellence in property management software.
              Trusted by over 5,000 associations globally.
            </p>
          </div>
          <nav aria-label="Solutions">
            <h3 className="uppercase tracking-widest text-[10px] font-bold text-slate-900 dark:text-slate-100 mb-6">
              Solutions
            </h3>
            <ul className="space-y-4 text-sm">
              {["Self-Managed Boards", "Enterprise Firms", "Resident Experience", "Developer API"].map(
                (item, idx) => (
                  <li key={idx}>
                    <a
                      href="#"
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
                    >
                      {item}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </nav>
          <nav aria-label="Company">
            <h3 className="uppercase tracking-widest text-[10px] font-bold text-slate-900 dark:text-slate-100 mb-6">
              Company
            </h3>
            <ul className="space-y-4 text-sm">
              {["About Us", "Careers", "Legal Resources", "Contact Us"].map((item, idx) => (
                <li key={idx}>
                  <a
                    href="#"
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="uppercase tracking-widest text-[10px] font-bold text-slate-900 dark:text-slate-100 mb-6">
                Social
              </h3>
              <div className="flex gap-4">
                {[
                  { icon: "share", label: "Share" },
                  { icon: "podcasts", label: "Podcasts" },
                  { icon: "alternate_email", label: "Email" },
                ].map((item, idx) => (
                  <a
                    key={idx}
                    href="#"
                    aria-label={`Visit us on ${item.label}`}
                    className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-primary dark:hover:bg-primary hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      {item.icon}
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-8 md:mt-0">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                © {new Date().getFullYear()} Your Condo Manager. The Modern Estate Excellence.
              </p>
            </div>
          </div>
        </div>
        <div className="px-12 py-6 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-wrap gap-8">
          <Link
            href="/privacy-policy"
            className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms-of-service"
            className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
          >
            Terms of Service
          </Link>
          <a
            href="#"
            className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
          >
            Cookie Settings
          </a>
        </div>
      </footer>

      <DemoRequestModal isOpen={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </div>
  );
}
