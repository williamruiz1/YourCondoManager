import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  FileArchive,
  FileText,
  Menu,
  MessageSquare,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";
import DemoRequestModal from "@/components/demo-request-modal";
import { useStrings } from "@/i18n/use-strings";

type LandingPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

type Persona = "manager" | "board" | "resident";

export default function LandingPage({ hasWorkspaceAccess, onStartGoogleSignIn }: LandingPageProps) {
  // Default to "board" — Track 1 outreach targets self-managed volunteer boards.
  // Property Manager (Track 2) is secondary and can self-select via the toggle.
  const [persona, setPersona] = useState<Persona>("board");
  const [animating, setAnimating] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const { t } = useStrings();

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

  // Persona content — copy lives in the i18n registry; icons stay co-located.
  const personaContent = {
    manager: {
      badge: t("landing.persona.manager.badge"),
      headline: t("landing.persona.manager.headline"),
      subhead: t("landing.persona.manager.subhead"),
      features: [
        {
          icon: BarChart3,
          title: t("landing.persona.manager.feature.visibility.title"),
          description: t("landing.persona.manager.feature.visibility.body"),
        },
        {
          icon: DollarSign,
          title: t("landing.persona.manager.feature.billing.title"),
          description: t("landing.persona.manager.feature.billing.body"),
        },
        {
          icon: FileText,
          title: t("landing.persona.manager.feature.reporting.title"),
          description: t("landing.persona.manager.feature.reporting.body"),
        },
        {
          icon: Users,
          title: t("landing.persona.manager.feature.team.title"),
          description: t("landing.persona.manager.feature.team.body"),
        },
      ],
      ctaPrimary: t("landing.persona.manager.ctaPrimary"),
      ctaSecondary: t("landing.persona.manager.ctaSecondary"),
      proof: [
        t("landing.persona.manager.proof.1"),
        t("landing.persona.manager.proof.2"),
        t("landing.persona.manager.proof.3"),
        t("landing.persona.manager.proof.4"),
      ],
    },
    board: {
      badge: t("landing.persona.board.badge"),
      headline: t("landing.persona.board.headline"),
      subhead: t("landing.persona.board.subhead"),
      features: [
        {
          icon: DollarSign,
          title: t("landing.persona.board.feature.finances.title"),
          description: t("landing.persona.board.feature.finances.body"),
        },
        {
          icon: ClipboardCheck,
          title: t("landing.persona.board.feature.governance.title"),
          description: t("landing.persona.board.feature.governance.body"),
        },
        {
          icon: Users,
          title: t("landing.persona.board.feature.portal.title"),
          description: t("landing.persona.board.feature.portal.body"),
        },
        {
          icon: Wrench,
          title: t("landing.persona.board.feature.maintenance.title"),
          description: t("landing.persona.board.feature.maintenance.body"),
        },
      ],
      ctaPrimary: t("landing.persona.board.ctaPrimary"),
      ctaSecondary: t("landing.persona.board.ctaSecondary"),
      proof: [
        t("landing.persona.board.proof.1"),
        t("landing.persona.board.proof.2"),
        t("landing.persona.board.proof.3"),
        t("landing.persona.board.proof.4"),
      ],
    },
    resident: {
      badge: t("landing.persona.resident.badge"),
      headline: t("landing.persona.resident.headline"),
      subhead: t("landing.persona.resident.subhead"),
      features: [
        {
          icon: DollarSign,
          title: t("landing.persona.resident.feature.pay.title"),
          description: t("landing.persona.resident.feature.pay.body"),
        },
        {
          icon: Wrench,
          title: t("landing.persona.resident.feature.requests.title"),
          description: t("landing.persona.resident.feature.requests.body"),
        },
        {
          icon: FileArchive,
          title: t("landing.persona.resident.feature.documents.title"),
          description: t("landing.persona.resident.feature.documents.body"),
        },
        {
          icon: MessageSquare,
          title: t("landing.persona.resident.feature.informed.title"),
          description: t("landing.persona.resident.feature.informed.body"),
        },
      ],
      ctaPrimary: t("landing.persona.resident.ctaPrimary"),
      ctaSecondary: t("landing.persona.resident.ctaSecondary"),
      proof: [
        t("landing.persona.resident.proof.1"),
        t("landing.persona.resident.proof.2"),
        t("landing.persona.resident.proof.3"),
        t("landing.persona.resident.proof.4"),
      ],
    },
  } as const;

  const personaLabels: Record<Persona, string> = {
    manager: t("marketing.persona.manager"),
    board: t("marketing.persona.board"),
    resident: t("marketing.persona.resident"),
  };

  const content = personaContent[persona];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">

      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-primary focus:px-4 focus:py-2 focus:rounded focus:shadow-md focus:font-bold"
      >
        {t("marketing.skipToContent")}
      </a>

      {/* ── NAVIGATION ── */}
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-serif italic">{t("marketing.brand")}</span>
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-6" aria-label={t("marketing.nav.label")}>
            <Link
              href="/"
              aria-current="page"
              className="text-blue-700 dark:text-blue-400 font-bold border-b-2 border-blue-700 dark:border-blue-400 pb-1"
            >
              {t("marketing.nav.platform")}
            </Link>
            <Link
              href="/solutions"
              className="text-slate-600 dark:text-slate-400 font-medium hover:text-blue-600 transition-colors duration-300"
            >
              {t("marketing.nav.solutions")}
            </Link>
            <Link
              href="/pricing"
              className="text-slate-600 dark:text-slate-400 font-medium hover:text-blue-600 transition-colors duration-300"
            >
              {t("marketing.nav.pricing")}
            </Link>
          </nav>

          {/* CTAs — desktop */}
          <div className="hidden md:flex items-center gap-4">
            {hasWorkspaceAccess ? (
              <Button asChild>
                <Link href="/app">
                  {t("marketing.cta.openWorkspace")} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <button className="text-slate-600 font-medium hover:text-primary transition-colors" onClick={onStartGoogleSignIn}>
                  {t("marketing.cta.signIn")}
                </button>
                <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-5 py-2 rounded font-semibold scale-95 active:opacity-80 transition-all" onClick={onStartGoogleSignIn}>
                  {t("marketing.cta.openWorkspace")}
                </button>
              </>
            )}
          </div>

          {/* Hamburger — mobile */}
          <button
            className="md:hidden p-2 -mr-1 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={t("marketing.nav.toggleMenu")}
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
              {t("marketing.nav.platform")}
            </Link>
            <Link
              href="/solutions"
              className="block px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t("marketing.nav.solutions")}
            </Link>
            <Link
              href="/pricing"
              className="block px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t("marketing.nav.pricing")}
            </Link>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              {hasWorkspaceAccess ? (
                <Button asChild>
                  <Link href="/app">
                    {t("marketing.cta.openWorkspace")} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <button className="px-4 py-2 text-slate-600 font-medium hover:text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded" onClick={onStartGoogleSignIn}>{t("marketing.cta.signIn")}</button>
                  <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-2 rounded font-semibold active:opacity-80 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={onStartGoogleSignIn}>{t("marketing.cta.openWorkspace")}</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Wave 31 a11y: skip-link target promoted to main landmark for marketing brochure. */}
      <main id="main-content" tabIndex={-1}>
      {/* ── HERO ── */}
      <section className="relative px-8 py-12 md:py-20 max-w-7xl mx-auto overflow-hidden pt-24 md:pt-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="z-10">
            <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold tracking-widest uppercase mb-4">{t("landing.hero.eyebrow")}</span>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold leading-tight text-on-surface mb-6">
              {t("landing.hero.headlineLead")} <span className="text-primary italic">{t("landing.hero.headlineEmphasis")}</span>
            </h1>
            <p className="text-on-surface-variant text-lg md:text-xl max-w-xl mb-8 leading-relaxed">
              {t("landing.hero.subhead")}
            </p>
            <div className="flex flex-wrap gap-4">
              {hasWorkspaceAccess ? (
                <Button size="lg" asChild>
                  <Link href="/app">
                    {t("marketing.cta.openWorkspace")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <button className="bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={onStartGoogleSignIn} data-testid="button-landing-google-signin">
                    {t("landing.hero.cta.primary")}
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                  </button>
                  <button className="px-8 py-4 text-primary font-bold hover:bg-surface-container transition-colors rounded-lg" onClick={() => setDemoModalOpen(true)}>
                    {t("landing.hero.cta.secondary")}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="relative lg:block hidden">
            <div className="absolute -inset-4 bg-primary-container/5 rounded-xl blur-3xl"></div>
            <div className="relative bg-surface-container-lowest rounded-xl overflow-hidden shadow-lg border border-outline-variant/20">
              <img className="w-full h-[400px] object-cover opacity-90" alt={t("landing.hero.image.alt")} src="https://lh3.googleusercontent.com/aida-public/AB6AXuDORRxFHQEQQgLB-LIhVTxXwSjX3PFwaeqJK47VYkPcV7-8kExURnYNhcett0B3XsY4Furz0oLDNIL-hv5Gb-CtAJH4O1AQTQEiZegVanQLHzPcE9R5gOcmtSizhcBoPPEw0nyDF5-NDpn_MBo8VnLFFGCe_W0Hr6ohoNeQqB_gs0bschoj3OyC0Ky9FESgTtEANJ0OMhmC_OsDwF8NH4wwFLcjU8Nvh5tQ7evgrRtIJUHxITX__w9M_c4mPyGx2b123CkVsDXtk84" />
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="space-y-0 pb-0">

        {/* ── PERSONA TOGGLE ── */}
        <section className="bg-surface-container py-8 border-y border-outline-variant/10">
          <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-center gap-6">
            <span id="persona-toggle-label" className="font-label text-sm font-bold text-on-surface-variant uppercase tracking-widest">{t("landing.persona.toggleLabel")}</span>
            <div role="group" aria-labelledby="persona-toggle-label" className="flex p-1 bg-surface-container-high rounded-lg border border-outline-variant/20">
              {(["board", "manager", "resident"] as Persona[]).map((p) => (
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
              <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest mb-6">{t("landing.persona.whyPrefix")} {personaLabels[persona].toLowerCase()}:</p>
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
            <h2 className="font-headline text-3xl md:text-4xl font-bold text-on-surface">{t("landing.bento.heading")}</h2>
            <p className="text-on-surface-variant mt-2">{t("landing.bento.subhead")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>account_balance_wallet</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">{t("landing.bento.dues.title")}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t("landing.bento.dues.body")}</p>
            </div>

            {/* Card 2 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>engineering</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">{t("landing.bento.maintenance.title")}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t("landing.bento.maintenance.body")}</p>
            </div>

            {/* Card 3 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>description</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">{t("landing.bento.archives.title")}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t("landing.bento.archives.body")}</p>
            </div>

            {/* Card 4 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>campaign</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">{t("landing.bento.comms.title")}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t("landing.bento.comms.body")}</p>
            </div>

            {/* Card 5 - Span 2 */}
            <div className="md:col-span-2 bg-gradient-to-br from-primary to-primary-container p-8 rounded-xl shadow-lg text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="font-headline text-2xl font-bold mb-4">{t("landing.bento.reporting.title")}</h3>
                <p className="max-w-md mb-6 text-on-primary-container">{t("landing.bento.reporting.body")}</p>
                <button className="bg-white text-primary px-6 py-2 rounded font-bold text-sm hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => setDemoModalOpen(true)}>{t("landing.bento.reporting.cta")}</button>
              </div>
              <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl opacity-10 group-hover:scale-110 transition-transform" aria-hidden="true">monitoring</span>
            </div>

            {/* Card 6 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>how_to_reg</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">{t("landing.bento.voting.title")}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t("landing.bento.voting.body")}</p>
            </div>

            {/* Card 7 */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/20 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="w-10 h-10 bg-primary/5 text-primary rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                <span className="material-symbols-outlined" style={{"fontVariationSettings": "'FILL' 1"}}>calendar_month</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-2">{t("landing.bento.inspections.title")}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t("landing.bento.inspections.body")}</p>
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
                <h2 id="compliance-heading" className="font-headline text-2xl font-bold mb-2">{t("landing.compliance.audit.title")}</h2>
                <p className="text-on-surface-variant leading-relaxed">{t("landing.compliance.audit.body")}</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm" aria-hidden="true">
                <span className="material-symbols-outlined text-primary">encrypted</span>
              </div>
              <div>
                <h3 className="font-headline text-2xl font-bold mb-2">{t("landing.compliance.access.title")}</h3>
                <p className="text-on-surface-variant leading-relaxed">{t("landing.compliance.access.body")}</p>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full max-w-md">
            {/* Decorative security-log mock — timestamps + entries are illustrative
                and stay inline (not user-actionable copy). */}
            <div className="bg-white p-4 rounded-xl shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b pb-4 border-surface-container">
                <span className="font-bold text-sm">{t("landing.compliance.log.label")}</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">{t("landing.compliance.log.statusActive")}</span>
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
            <img className="w-full h-full object-cover" alt="" aria-hidden="true" loading="lazy" decoding="async" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGylkVvJ6DR43ZSa3V5HhWYa4Tm_rV6NrxTJw7NwAHUssjyQI9IHIa5AtnSzWE4jalnOoKDh2PG82f2JXxDelDB9MraXOmdzj6Z3kAjShgD8G4Es537T5X_SqzvnFFjqgxLddQCR-aIR_-rTSWLC6Y3zAUVcdNFriTJRpEGXHl7xP0TnLB24YApCP8hIhS8U343a-5Q7cuVa-poEXGGv13F2V9xRt-XbskyOJKdcVLCJ7MbSGzlViwO5Y20scclZcr2JFpv6FYuvA" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-headline text-4xl md:text-5xl text-white font-bold mb-6">{t("landing.finalCta.title")}</h2>
            <p className="text-slate-300 text-lg mb-10">{t("landing.finalCta.body")}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {hasWorkspaceAccess ? (
                <Button
                  size="lg"
                  asChild
                  className="bg-white text-slate-900 hover:bg-white/90"
                >
                  <Link href="/pricing">
                    {t("landing.finalCta.viewPricing")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <button className="bg-white text-slate-900 px-8 py-4 rounded-lg font-bold hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={onStartGoogleSignIn} data-testid="button-landing-open-workspace">
                    {t("landing.finalCta.startTrial")}
                  </button>
                  <button className="border border-white/30 text-white px-8 py-4 rounded-lg font-bold hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => setDemoModalOpen(true)}>
                    {t("landing.finalCta.speakExpert")}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
      </main>

      <SiteFooter />

      <DemoRequestModal isOpen={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </div>
  );
}
