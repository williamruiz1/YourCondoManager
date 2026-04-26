import { useState, useEffect } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import DemoRequestModal from "@/components/demo-request-modal";
import { SiteFooter } from "@/components/site-footer";
import { useStrings } from "@/i18n/use-strings";

type SolutionsPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

type Persona = "manager" | "board" | "resident";

// Analytics tracking utility
const trackEvent = (eventName: string, eventData: Record<string, any> = {}) => {
  try {
    // Track event with analytics service (e.g., Google Analytics, Mixpanel)
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", eventName, {
        event_category: "solutions_page",
        ...eventData,
      });
    }
    // Also log for debugging
    console.debug("Analytics event:", eventName, eventData);
  } catch (error) {
    console.error("Analytics tracking error:", error);
  }
};


export default function SolutionsPage({
  hasWorkspaceAccess,
  onStartGoogleSignIn,
}: SolutionsPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [persona, setPersona] = useState<Persona>("board");
  const [animating, setAnimating] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const { t } = useStrings();

  const personaLabels: Record<Persona, string> = {
    manager: t("marketing.persona.manager"),
    board: t("marketing.persona.board"),
    resident: t("marketing.persona.resident"),
  };

  function switchPersona(next: Persona) {
    if (next === persona) return;
    setAnimating(true);
    setTimeout(() => {
      setPersona(next);
      setAnimating(false);
    }, 160);
  }

  // Track page view and scroll depth
  useEffect(() => {
    trackEvent("page_view", {
      page_path: "/solutions",
      page_title: "Solutions - Your Condo Manager",
    });

    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100,
      );
      if (scrollPercent > scrollDepth + 25) {
        setScrollDepth(scrollPercent);
        trackEvent("scroll_depth", {
          scroll_percent: scrollPercent,
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollDepth]);

  const handleCTAClick = (ctaType: string, location: string) => {
    trackEvent("cta_click", {
      cta_type: ctaType,
      location: location,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded focus:font-semibold"
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
              className="text-slate-600 dark:text-slate-400 font-medium hover:text-blue-600 transition-colors duration-300"
            >
              {t("marketing.nav.platform")}
            </Link>
            <Link
              href="/solutions"
              className="text-blue-700 dark:text-blue-400 font-bold border-b-2 border-blue-700 dark:border-blue-400 pb-1"
              aria-current="page"
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
              aria-current="page"
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
                  <button className="px-4 py-2 text-slate-600 font-medium hover:text-primary transition-colors" onClick={onStartGoogleSignIn}>{t("marketing.cta.signIn")}</button>
                  <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-2 rounded font-semibold active:opacity-80 transition-all" onClick={onStartGoogleSignIn}>{t("marketing.cta.openWorkspace")}</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="pt-16 pb-24">
        {/* Hero Section */}
        <header className="max-w-screen-2xl mx-auto px-8 mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
            <div className="lg:col-span-7">
              <span className="text-xs uppercase tracking-[0.3em] font-bold text-primary mb-6 block">
                {t("solutions.hero.eyebrow")}
              </span>
              <h1 className="font-headline text-6xl md:text-8xl leading-[1.1] text-on-surface dark:text-slate-100 mb-8">
                {t("solutions.hero.headlineLead")} <br />
                <i className="font-light">{t("solutions.hero.headlineEmphasis")}</i>
              </h1>
              <p className="text-xl text-on-surface-variant dark:text-slate-400 max-w-xl leading-relaxed">
                {t("solutions.hero.subhead")}
              </p>
            </div>
            <div className="lg:col-span-5 hidden lg:block text-right pb-4">
              <div className="inline-flex items-center gap-4 text-sm font-medium text-outline">
                <span className="w-12 h-[1px] bg-outline-variant"></span>
                {t("solutions.hero.scrollHint")}
              </div>
            </div>
          </div>
        </header>


        {/* ── PERSONA TOGGLE ── */}
        <section className="bg-surface-container py-8 border-y border-outline-variant/10 mb-20">
          <div className="max-w-screen-2xl mx-auto px-8 flex flex-col md:flex-row items-center justify-center gap-6">
            <span id="persona-toggle-label" className="font-label text-sm font-bold text-on-surface-variant uppercase tracking-widest">{t("solutions.persona.toggleLabel")}</span>
            <div className="flex p-1 bg-surface-container-high rounded-lg border border-outline-variant/20" role="group" aria-labelledby="persona-toggle-label">
              {(["board", "manager", "resident"] as Persona[]).map((p) => (
                <button
                  key={p}
                  onClick={() => switchPersona(p)}
                  aria-pressed={persona === p}
                  className={cn(
                    "px-6 py-2 font-bold rounded transition-all",
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

        {/* Content Sections */}
        <div aria-live="polite" aria-atomic="true">
              {/* Section 1: Self-Managed Associations */}
              {persona === "board" && (
              <section className={cn("mb-48 transition-opacity duration-160", animating && "opacity-50")}>
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="bg-surface-container-low dark:bg-slate-900 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
              <div className="p-12 lg:p-24 flex flex-col justify-center">
                <div className="mb-12">
                  <span className="material-symbols-outlined text-4xl text-primary mb-4" data-icon="account_balance" aria-hidden="true">
                    account_balance
                  </span>
                  <h2 className="font-headline text-5xl text-on-surface dark:text-slate-100 mb-6">
                    {t("solutions.board.headline.line1")} <br />
                    {t("solutions.board.headline.line2")}
                  </h2>
                  <p className="text-on-surface-variant dark:text-slate-400 text-lg leading-relaxed mb-8">
                    {t("solutions.board.body")}
                  </p>
                </div>
                <div className="space-y-8" role="list">
                  {[
                    {
                      icon: "payments",
                      title: t("solutions.board.feature.dues.title"),
                      description: t("solutions.board.feature.dues.body"),
                    },
                    {
                      icon: "handyman",
                      title: t("solutions.board.feature.maintenance.title"),
                      description: t("solutions.board.feature.maintenance.body"),
                    },
                    {
                      icon: "how_to_reg",
                      title: t("solutions.board.feature.voting.title"),
                      description: t("solutions.board.feature.voting.body"),
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-6 group" role="listitem">
                      <div
                        className="w-12 h-12 rounded-full bg-surface-container-highest dark:bg-slate-800 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary dark:group-hover:bg-primary dark:group-hover:text-white transition-all flex-shrink-0"
                        aria-label={item.title}
                      >
                        <span className="material-symbols-outlined" data-icon={item.icon} aria-hidden="true">{item.icon}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg text-on-surface dark:text-slate-100 mb-1">
                          {item.title}
                        </h4>
                        <p className="text-on-surface-variant dark:text-slate-400">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative min-h-[400px] bg-surface-container-highest dark:bg-slate-800">
                <img
                  alt={t("solutions.board.image.alt")}
                  className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80"
                  data-alt="Modern geometric glass building facade with sharp lines and blue sky reflections in a minimalist architectural style"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAg_Ua7IHKfaOBKwwQBLrhg9wu9mU7Juj1BeOI914zs1sYKgzNAqLx3HNatRpL6pvRcIlM6AZjScO0q_nBfczN4N3zQxghCxr78LUpyq8NmfhVg7j7NFIhHvkfuOGwdiRV9K8Yb2xNGNx0KnOJ3dEfyume-RV0KCSQ7WtkEsi72L-34Lv8FASaDw_SFR-qeXJdGZpk5IIHFJB7-d9lAAbzntLfLqow07Kg4mC_IMt_EbGInu1_HIBDqLmp6bphB9WVCObB6T1TUZiU"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </section>
              )}

        {/* Section 2: Property Management Companies (Bento Grid Style) */}
              {persona === "manager" && (
            <section className={cn("mb-48 bg-surface-container-lowest dark:bg-slate-950 py-32 border-y border-surface-container dark:border-slate-800 transition-opacity duration-160", animating && "opacity-50")}>
              <div className="max-w-screen-2xl mx-auto px-8">
                <div className="text-center mb-20">
                  <span className="text-xs uppercase tracking-[0.3em] font-bold text-primary mb-4 block">
                    {t("solutions.manager.eyebrow")}
                  </span>
                  <h2 className="font-headline text-5xl md:text-6xl text-on-surface dark:text-slate-100 mb-6">
                    {t("solutions.manager.headline.line1")} <br />
                    {t("solutions.manager.headline.line2")}
                  </h2>
                  <p className="text-on-surface-variant dark:text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
                    {t("solutions.manager.subhead")}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[600px]">
                  {/* Centralized Reporting - Large Card */}
                  <div className="md:col-span-8 bg-surface-container dark:bg-slate-900 rounded-xl p-12 flex flex-col justify-between overflow-hidden relative group">
                    <div className="relative z-10">
                      <span className="material-symbols-outlined text-4xl text-primary mb-6" data-icon="analytics" aria-hidden="true">
                        analytics
                      </span>
                      <h3 className="font-headline text-4xl text-on-surface dark:text-slate-100 mb-4">
                        {t("solutions.manager.reporting.title")}
                      </h3>
                      <p className="text-on-surface-variant dark:text-slate-400 text-lg max-w-md">
                        {t("solutions.manager.reporting.body")}
                      </p>
                    </div>
                    <img
                      alt={t("solutions.manager.reporting.image.alt")}
                      className="absolute bottom-[-10%] right-[-10%] w-3/4 opacity-10 group-hover:scale-105 transition-transform duration-700"
                      data-alt="Clean minimalist dashboard interface showing financial charts and data visualizations with a soft blue tint"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNNHUlctDcSELeyZdUfa2OERCX7Yk7koVYVOShkknAjFez-_Zdq3mqi_lbpwA9bybAszAcpUVBT7SOTPpwGIseEVrEM4_vCUA3fS9OgAHCDavOwlIb4rVzaytszz7hX2ZDod0rAzD4s-uu8KpYW-7IRa4cMNxCU4PBban0sQO9Uln2RzggAFLS1ee624iHpEXXBALW0BnYZ5zNsLiQrR9olI053pIQo8FBldFPj85RW5bBfc3ipaLs6-TS1xMay0mxPDicYsiEmQQ"
                      loading="lazy"
                      decoding="async"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Multi-Entity Accounting - Primary Blue */}
                  <div className="md:col-span-4 bg-primary dark:bg-blue-900 text-on-primary dark:text-white rounded-xl p-12 flex flex-col justify-between">
                    <div>
                      <span className="material-symbols-outlined text-4xl mb-6" data-icon="account_tree" aria-hidden="true">account_tree</span>
                      <h3 className="font-headline text-3xl mb-4">
                        {t("solutions.manager.accounting.title.line1")} <br />
                        {t("solutions.manager.accounting.title.line2")}
                      </h3>
                      <p className="text-on-primary/80 dark:text-blue-100">
                        {t("solutions.manager.accounting.body")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCTAClick("learn_security", "enterprise_section")}
                      className="mt-8 flex items-center gap-2 font-bold group hover:gap-3 transition-all focus:outline-none focus:ring-2 focus:ring-white rounded px-2"
                    >
                      {t("solutions.manager.accounting.cta")}
                      <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform" data-icon="arrow_forward" aria-hidden="true">
                        arrow_forward
                      </span>
                    </button>
                  </div>

                  {/* Vendor Management */}
                  <div className="md:col-span-4 bg-surface-container dark:bg-slate-900 rounded-xl p-12 flex flex-col justify-center border-t-4 border-primary">
                    <h4 className="font-bold text-xl text-on-surface dark:text-slate-100 mb-3">
                      {t("solutions.manager.vendor.title")}
                    </h4>
                    <p className="text-on-surface-variant dark:text-slate-400">
                      {t("solutions.manager.vendor.body")}
                    </p>
                  </div>

                  {/* Automated Communications */}
                  <div className="md:col-span-8 bg-surface-container dark:bg-slate-900 rounded-xl p-12 flex items-center gap-12 overflow-hidden">
                    <div className="flex-1">
                      <h4 className="font-bold text-xl text-on-surface dark:text-slate-100 mb-3">
                        {t("solutions.manager.comms.title")}
                      </h4>
                      <p className="text-on-surface-variant dark:text-slate-400">
                        {t("solutions.manager.comms.body")}
                      </p>
                    </div>
                    <div className="hidden lg:flex gap-4">
                      <div className="w-16 h-16 rounded-lg bg-surface-container-highest dark:bg-slate-800 animate-pulse motion-reduce:animate-none"></div>
                      <div className="w-16 h-16 rounded-lg bg-surface-container-highest dark:bg-slate-800 animate-pulse delay-75 motion-reduce:animate-none"></div>
                      <div className="w-16 h-16 rounded-lg bg-surface-container-highest dark:bg-slate-800 animate-pulse delay-150 motion-reduce:animate-none"></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
              )}

        {/* Section 3: Resident Engagement */}
              {persona === "resident" && (
            <section className={cn("max-w-screen-2xl mx-auto px-8 mb-48 transition-opacity duration-160", animating && "opacity-50")}>
              <div className="flex flex-col lg:flex-row gap-24 items-center">
                <div className="lg:w-1/2 order-2 lg:order-1">
                  <div className="relative">
                    <div className="aspect-[4/5] bg-surface-container-high dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
                      <img
                        alt={t("solutions.resident.image.alt")}
                        className="w-full h-full object-cover"
                        data-alt="Minimalist modern apartment interior with large windows and soft natural light focusing on a hand holding a sleek smartphone"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCk3cKps5qEBGKu9r1aVJV6MGLFKMYtjoQocB6288CtUu8BNf_dhdCKSmyl1Bl6sOliwT4C_JV8ppTRdyBid7GMbmAmuCTHNM0XkdAiKvhdhElPS317OfXLBiz-sY3OnDSa3-KCLSg9fE8WjPUxNp5nWpu-gqzLe2KVSlYmpQod4v9x4DyWeuM5Ul9bVWBxGgTtVVVbYqdqJ9bQVYG7NjkmdwAXAeI7c8RDJG4V9-_Nj8QFcP_JEi4eR6ikhkA6CXHCzXu9o_fwgA"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    {/* Floating Glass UI Card */}
                    <div className="absolute -bottom-12 -right-12 p-8 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-xl editorial-shadow max-w-xs border border-white/20 dark:border-slate-700/20 hidden md:block">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-secondary-container dark:bg-blue-800 flex items-center justify-center text-primary dark:text-blue-400">
                          <span className="material-symbols-outlined text-sm" data-icon="calendar_today" aria-hidden="true">calendar_today</span>
                        </div>
                        <span className="text-sm font-bold uppercase tracking-wider text-on-surface dark:text-slate-100">
                          {t("solutions.resident.booking.label")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-on-surface dark:text-slate-100 mb-1">
                        {t("solutions.resident.booking.title")}
                      </p>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400">{t("solutions.resident.booking.time")}</p>
                    </div>
                  </div>
                </div>
                <div className="lg:w-1/2 order-1 lg:order-2">
                  <span className="text-xs uppercase tracking-[0.3em] font-bold text-primary mb-6 block">
                    {t("solutions.resident.eyebrow")}
                  </span>
                  <h2 className="font-headline text-5xl text-on-surface dark:text-slate-100 mb-8">
                    {t("solutions.resident.headline")}
                  </h2>
                  <p className="text-lg text-on-surface-variant dark:text-slate-400 leading-relaxed mb-12">
                    {t("solutions.resident.body")}
                  </p>
                  <div className="space-y-12">
                    {[
                      {
                        num: "01",
                        title: t("solutions.resident.feature.amenity.title"),
                        description: t("solutions.resident.feature.amenity.body"),
                      },
                      {
                        num: "02",
                        title: t("solutions.resident.feature.payments.title"),
                        description: t("solutions.resident.feature.payments.body"),
                      },
                      {
                        num: "03",
                        title: t("solutions.resident.feature.bulletin.title"),
                        description: t("solutions.resident.feature.bulletin.body"),
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="flex gap-8">
                        <span className="text-4xl font-headline italic text-outline-variant dark:text-slate-600">
                          {item.num}
                        </span>
                        <div>
                          <h4 className="text-xl font-bold text-on-surface dark:text-slate-100 mb-2">
                            {item.title}
                          </h4>
                          <p className="text-on-surface-variant dark:text-slate-400">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
              )}

        {/* CTA Section */}
        <section className="max-w-screen-2xl mx-auto px-8">
          <div className="bg-primary dark:bg-blue-900 text-on-primary dark:text-white rounded-xl p-12 md:p-24 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 dark:opacity-5">
              <div
                className="absolute top-0 left-0 w-full h-full"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                  backgroundSize: "40px 40px",
                }}
              ></div>
            </div>
            <div className="relative z-10">
              <h2 className="font-headline text-5xl md:text-7xl mb-8 italic">
                {t("solutions.finalCta.title")}
              </h2>
              <p className="text-xl text-on-primary/70 dark:text-blue-100 mb-12 max-w-xl mx-auto">
                {t("solutions.finalCta.body")}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <button
                  onClick={() => {
                    handleCTAClick("request_demo", "cta_footer");
                    setDemoModalOpen(true);
                  }}
                  className="bg-white dark:bg-slate-100 text-primary dark:text-blue-900 px-10 py-4 rounded font-bold text-lg hover:bg-slate-50 dark:hover:bg-slate-200 transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary dark:focus:ring-offset-blue-900"
                  aria-label={t("solutions.finalCta.requestDemoAria")}
                >
                  {t("solutions.finalCta.requestDemo")}
                </button>
                <Link href="/pricing" onClick={() => handleCTAClick("view_pricing", "cta_footer")}>
                  <button
                    className="border border-white/30 dark:border-blue-400/30 text-white dark:text-blue-100 px-10 py-4 rounded font-bold text-lg hover:bg-white/10 dark:hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary dark:focus:ring-offset-blue-900"
                    aria-label={t("solutions.finalCta.viewPricingAria")}
                  >
                    {t("solutions.finalCta.viewPricing")}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        </div>{/* end aria-live content sections */}
      </main>

      <SiteFooter />

      <DemoRequestModal isOpen={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </div>
  );
}
