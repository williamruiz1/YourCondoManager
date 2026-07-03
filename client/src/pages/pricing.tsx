// PRICING PAGE — v3 (Property-Manager track per-door rebuild)
// Spec: ~/code/founder-os/wiki/products/ycm/pricing-model-v3.md §2 (locked 2026-05-15 voice session)
//       + declining-tier amendment (William-ratified 2026-06-21).
// Two-track layout: Property Managers (default) + Self-Managed Communities.
// PM track = DECLINING per-door rate by tier (volume discount): $4.50 (Starter) /
//   $4.25 (Growth) / $4.00 (Scale) — the per-door rate FALLS as the portfolio grows.
//   Tiers gate FEATURES + set the per-door rate + the monthly minimum.
// SM track = DECLINING per-UNIT rate by community tier (William-ratified 2026-06-21):
//   Small $129/mo FLAT floor (1–40) · Mid $3.75/unit (41–100) · Large $3.50/unit
//   (101–250) · Enterprise Concierge custom (251+). The $129 Small floor is the
//   only minimum; Mid/Large entry bills already exceed it. Calculator computes
//   the flat $129 (Small) or units × per-unit rate (Mid/Large).
// Per-tier monthly minimums apply; calculator computes max(doors × tierRate, tier minimum).
// Terminology: "communities" not "complexes" (spec §7).
// Annual toggle = ~10% discount. Display only — no Stripe / billing wiring (separate PR owns that).

import {
  ArrowRight,
  CheckCircle2,
  Menu,
  Network,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";
import { BrandMark } from "@/components/brand-mark";
import { useStrings } from "@/i18n/use-strings";

type PricingPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

// Pricing tiers (canonical per spec). Annual price is monthly × 12 × 0.9.
type Track = "property-managers" | "self-managed";

// PM track is a DECLINING per-door rate by tier (volume discount; ratified
// 2026-06-21): $4.50 (Starter) / $4.25 (Growth) / $4.00 (Scale). The per-door
// rate falls as the portfolio grows. Tiers gate FEATURES + set the rate + the
// monthly minimum. Each tier carries a door range + per-door rate + minimum.

interface PMTier {
  name: string;
  range: string; // door range, customer-facing
  minDoors: number; // inclusive lower bound of door range
  maxDoors: number | null; // inclusive upper bound; null = unbounded (Enterprise)
  perDoor: number | null; // per-door rate ($/door/mo) for this tier; null = custom (Enterprise)
  monthlyMinimum: number; // per-tier minimum monthly commit ($)
  custom?: boolean; // Enterprise = custom / "from $X"
  features: string[];
  ctaLabel: string;
  ctaPlan: string | null; // null = contact sales
  highlighted?: boolean;
}

// SM track is a DECLINING per-UNIT rate by community tier (William-ratified
// 2026-06-21): Small $129/mo FLAT floor · Mid $3.75/unit · Large $3.50/unit ·
// Enterprise custom. The per-unit rate FALLS as the community grows. The $129
// Small floor is the only minimum; at each tier's entry the per-unit bill
// naturally exceeds the floor (41×$3.75=$153.75; 101×$3.50=$353.50).
interface SMTier {
  name: string;
  units: string; // unit range, customer-facing
  minUnits: number; // inclusive lower bound of unit range
  maxUnits: number | null; // inclusive upper bound; null = unbounded (Enterprise)
  /** Flat monthly $ for the flat tier (Small); null for per-unit / custom. */
  flatMonthly: number | null;
  /** Per-unit $/unit/mo for per-unit tiers (Mid/Large); null for flat / custom. */
  perUnit: number | null;
  custom?: boolean; // Enterprise = custom / negotiable
  features: string[];
  ctaLabel: string;
  ctaPlan: string | null;
  highlighted?: boolean;
}

const PM_TIERS: PMTier[] = [
  {
    name: "PM Starter",
    range: "Up to 500 doors",
    minDoors: 0,
    maxDoors: 500,
    perDoor: 4.5,
    monthlyMinimum: 500,
    features: [
      "$4.50 per door / month",
      "$500/mo minimum",
      "Core platform, per community",
      "Owner portal + online payments",
      "Accounting + general ledger",
      "Document vault + audit trail",
      "AI compliance basics",
    ],
    ctaLabel: "Start free trial",
    ctaPlan: "property-manager-starter",
  },
  {
    name: "PM Growth",
    range: "501–2,000 doors",
    minDoors: 501,
    maxDoors: 2000,
    perDoor: 4.25,
    monthlyMinimum: 2125,
    features: [
      "$4.25 per door / month",
      "$2,125/mo minimum",
      "Everything in Starter, plus:",
      "Portfolio rollup dashboard",
      "White-label / co-brand",
      "Full AI compliance assistant",
      "Priority support",
      "Multi-HOA admin role",
    ],
    ctaLabel: "Start free trial",
    ctaPlan: "property-manager-growth",
    highlighted: true,
  },
  {
    name: "PM Scale",
    range: "2,001–5,000 doors",
    minDoors: 2001,
    maxDoors: 5000,
    perDoor: 4.0,
    monthlyMinimum: 8000,
    features: [
      "$4.00 per door / month",
      "$8,000/mo minimum",
      "Everything in Growth, plus:",
      "Full API access",
      "Dedicated customer success manager",
      "99.95% uptime SLA",
      "Advanced compliance reporting",
      "Custom roles & permissions",
      "Predictive AI analytics",
    ],
    ctaLabel: "Start free trial",
    ctaPlan: "property-manager-scale",
  },
  {
    name: "PM Enterprise Concierge",
    range: "5,000+ doors",
    minDoors: 5001,
    maxDoors: null,
    perDoor: null,
    monthlyMinimum: 18000,
    custom: true,
    features: [
      "Custom — from $4/door + concierge",
      "From $18,000/mo",
      "Everything in Scale, plus:",
      "Custom integrations",
      "White-glove migration",
      "On-site training",
      "Quarterly business reviews",
      "Concierge support",
    ],
    ctaLabel: "Contact sales",
    ctaPlan: null,
  },
];

const SM_TIERS: SMTier[] = [
  {
    name: "Small Community",
    units: "1–40 units",
    minUnits: 1,
    maxUnits: 40,
    flatMonthly: 129,
    perUnit: null,
    features: [
      "$129 / month flat",
      "Owner self-service portal",
      "Dues + assessments tracking",
      "Maintenance request flow",
      "Document library",
    ],
    ctaLabel: "Start free trial",
    // The signup flow normalizes to the base "self-managed" key (per
    // plan-signup.tsx); per-tier slugs would fall back to PM. Route SM cards to
    // the recognized self-managed signup; the tier is re-derived from unit count.
    ctaPlan: "self-managed",
  },
  {
    name: "Mid Community",
    units: "41–100 units",
    minUnits: 41,
    maxUnits: 100,
    flatMonthly: null,
    perUnit: 3.75,
    features: [
      "$3.75 per unit / month",
      "Everything in Small",
      "Governance + voting tools",
      "Vendor approval workflows",
      "Email + Slack notifications",
    ],
    ctaLabel: "Start free trial",
    ctaPlan: "self-managed",
    highlighted: true,
  },
  {
    name: "Large Community",
    units: "101–250 units",
    minUnits: 101,
    maxUnits: 250,
    flatMonthly: null,
    perUnit: 3.5,
    features: [
      "$3.50 per unit / month",
      "Everything in Mid",
      "Reserve study integration",
      "Compliance + audit logs",
      "Priority chat support",
    ],
    ctaLabel: "Start free trial",
    ctaPlan: "self-managed",
  },
  {
    name: "Enterprise Concierge",
    units: "250+ units",
    minUnits: 251,
    maxUnits: null,
    flatMonthly: null,
    perUnit: null,
    custom: true,
    features: [
      "Custom / negotiable pricing",
      "Everything in Large",
      "Dedicated success manager",
      "White-label + API + SSO",
      "Custom integrations",
    ],
    ctaLabel: "Contact sales",
    ctaPlan: null,
  },
];

// Spec: 10% discount when annual is on. Annual displays as $/yr.
function annualPrice(monthly: number): number {
  return Math.round(monthly * 12 * 0.9);
}

// ── PM CALCULATOR (spec §2 + §8 + declining-tier amendment 2026-06-21) ──
// DECLINING per-door rate by tier ($4.50 / $4.25 / $4.00); the per-tier minimum
// is the floor. Monthly = max(doors × tierRate, tier minimum). The door count
// determines which tier the PM lands in (tiers gate features + rate + minimum).
function pmTierForDoors(doors: number): PMTier {
  return (
    PM_TIERS.find(
      (t) => doors >= t.minDoors && (t.maxDoors === null || doors <= t.maxDoors),
    ) ?? PM_TIERS[0]
  );
}

interface PMQuote {
  tier: PMTier;
  perDoor: number; // resolved tier's per-door rate ($/door/mo); 0 for custom
  rawMonthly: number; // doors × tier rate (before minimum)
  monthly: number; // max(raw, tier minimum)
  minimumApplied: boolean;
  isCustom: boolean;
}

function pmQuote(doors: number): PMQuote {
  const tier = pmTierForDoors(doors);
  const perDoor = tier.perDoor ?? 0;
  const rawMonthly = doors * perDoor;
  const monthly = Math.max(rawMonthly, tier.monthlyMinimum);
  return {
    tier,
    perDoor,
    rawMonthly,
    monthly,
    minimumApplied: rawMonthly < tier.monthlyMinimum,
    isCustom: !!tier.custom,
  };
}

// ── SM CALCULATOR (declining per-unit; William-ratified 2026-06-21) ──
// Small = flat $129 floor (1–40); Mid = units × $3.75 (41–100);
// Large = units × $3.50 (101–250); Enterprise = custom (251+).
// The $129 Small floor is the only minimum — Mid/Large entry bills already
// exceed it (41×$3.75=$153.75; 101×$3.50=$353.50).
function smTierForUnits(units: number): SMTier {
  return (
    SM_TIERS.find(
      (t) => units >= t.minUnits && (t.maxUnits === null || units <= t.maxUnits),
    ) ?? SM_TIERS[0]
  );
}

interface SMQuote {
  tier: SMTier;
  /** units × perUnit for per-unit tiers; the flat $ for Small; 0 for custom. */
  monthly: number;
  isCustom: boolean;
  isFlat: boolean;
}

function smQuote(units: number): SMQuote {
  const tier = smTierForUnits(Math.max(1, units));
  if (tier.custom) {
    return { tier, monthly: 0, isCustom: true, isFlat: false };
  }
  if (tier.flatMonthly !== null) {
    return { tier, monthly: tier.flatMonthly, isCustom: false, isFlat: true };
  }
  // Per-unit tier (Mid / Large).
  const raw = Math.max(1, units) * (tier.perUnit ?? 0);
  return { tier, monthly: Math.round(raw * 100) / 100, isCustom: false, isFlat: false };
}

const SALES_EMAIL = "yourcondomanagement@gmail.com";

export default function PricingPage({ hasWorkspaceAccess, onStartGoogleSignIn }: PricingPageProps) {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTrack, setActiveTrack] = useState<Track>("property-managers");
  const [annual, setAnnual] = useState(false);
  // PM calculator inputs (doors drives pricing; communities is contextual only).
  const [pmDoors, setPmDoors] = useState<number>(1500);
  const [pmCommunities, setPmCommunities] = useState<number>(8);
  // SM calculator input (units drives the declining per-unit pricing).
  const [smUnits, setSmUnits] = useState<number>(75);
  const { t } = useStrings();

  const quote = pmQuote(Math.max(0, pmDoors || 0));
  const quoteMonthly = annual ? annualPrice(quote.monthly) : quote.monthly;
  const period = annual ? "yr" : "mo";

  // SM quote (declining per-unit). Annual applies the same ~10% display discount.
  const smq = smQuote(Math.max(1, smUnits || 1));
  const smQuoteMonthly = annual ? annualPrice(smq.monthly) : smq.monthly;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Wave 31 a11y: skip-link for keyboard users on the marketing brochure. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded focus:font-semibold"
      >
        {t("marketing.skipToContent")}
      </a>

      {/* ── NAVIGATION ── */}
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 h-16 flex items-center justify-between gap-6">
          <Link href="/" className="shrink-0 flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-serif italic">{t("marketing.brand")}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6" aria-label={t("marketing.nav.label")}>
            <Link
              href="/"
              className="text-slate-600 dark:text-slate-400 font-medium hover:text-blue-600 transition-colors duration-300"
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
              className="text-blue-700 dark:text-blue-400 font-bold border-b-2 border-blue-700 dark:border-blue-400 pb-1"
            >
              {t("marketing.nav.pricing")}
            </Link>
          </nav>

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
                <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-5 py-2 rounded font-semibold scale-95 active:opacity-80 transition-all" onClick={() => setLocation("/signup?plan=self-managed")}>
                  {t("marketing.cta.startFreeTrial")}
                </button>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 -mr-1 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={t("marketing.nav.toggleMenu")}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

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
                  <button className="px-4 py-2 text-slate-600 font-medium hover:text-primary transition-colors" onClick={onStartGoogleSignIn}>{t("marketing.cta.signIn")}</button>
                  <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-2 rounded font-semibold active:opacity-80 transition-all" onClick={() => setLocation("/signup?plan=self-managed")}>{t("marketing.cta.startFreeTrial")}</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="pt-16 pb-24">

        {/* ── HERO ── */}
        <header className="max-w-4xl mx-auto text-center px-6 pt-20 pb-12">
          <Badge
            variant="secondary"
            className="rounded-full text-xs font-bold tracking-widest uppercase mb-6"
          >
            Pricing
          </Badge>
          <h1 className="font-serif text-5xl md:text-[4.25rem] leading-[1.06] tracking-tight text-foreground mb-6">
            Pricing built for{" "}
            <em className="not-italic text-primary">how you operate</em>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Whether you manage a portfolio of properties or run a self-managed community, you only pay for what you actually use. No per-seat licensing.
          </p>
        </header>

        {/* ── TRACK TABS + ANNUAL TOGGLE ── */}
        <section className="max-w-7xl mx-auto px-6 mb-12">
          <div className="flex flex-col items-center gap-6">
            {/* Tabs (Property Managers default per spec) */}
            <div role="tablist" aria-label="Pricing audience" className="inline-flex rounded-full border border-border bg-muted/40 p-1 shadow-sm">
              <button
                role="tab"
                aria-selected={activeTrack === "property-managers"}
                aria-controls="track-pm-panel"
                onClick={() => setActiveTrack("property-managers")}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-semibold transition-all",
                  activeTrack === "property-managers"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-foreground/70 hover:text-foreground"
                )}
              >
                Property Managers
              </button>
              <button
                role="tab"
                aria-selected={activeTrack === "self-managed"}
                aria-controls="track-sm-panel"
                onClick={() => setActiveTrack("self-managed")}
                className={cn(
                  "px-6 py-2.5 rounded-full text-sm font-semibold transition-all",
                  activeTrack === "self-managed"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-foreground/70 hover:text-foreground"
                )}
              >
                Self-Managed Communities
              </button>
            </div>

            {/* Annual toggle */}
            <div className="flex items-center gap-3">
              <span className={cn("text-sm font-medium", !annual && "text-foreground", annual && "text-muted-foreground")}>Monthly</span>
              <Switch
                checked={annual}
                onCheckedChange={setAnnual}
                aria-label="Toggle annual billing (saves ~10%)"
              />
              <span className={cn("text-sm font-medium", annual && "text-foreground", !annual && "text-muted-foreground")}>
                Annual <span className="ml-1 text-xs text-primary font-bold">SAVE 10%</span>
              </span>
            </div>
          </div>
        </section>

        {/* ── PROPERTY MANAGERS TRACK ── */}
        {activeTrack === "property-managers" && (
          <section
            id="track-pm-panel"
            role="tabpanel"
            aria-labelledby="track-pm-tab"
            className="max-w-7xl mx-auto px-6 mb-12"
          >
            <div className="text-center mb-8 max-w-3xl mx-auto">
              <p className="text-base text-foreground/80">
                <strong className="text-primary">From $4 per door / month — your rate drops as you grow.</strong>{" "}
                $4.50 to start, $4.25 at Growth, $4.00 at Scale. Bigger portfolios earn a lower per-door rate.
              </p>
              <p className="mt-2 text-sm text-muted-foreground italic">
                That's roughly a fifth of what you charge the association — clean premium positioning between
                AppFolio Plus and Max. Run your whole portfolio from one command center.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
              {PM_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    "relative bg-card rounded-2xl p-6 flex flex-col shadow-sm",
                    tier.highlighted ? "border-2 border-primary/40 shadow-xl lg:scale-[1.03] z-10" : "border border-border/70"
                  )}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="rounded-full text-[10px] font-bold tracking-[0.18em] uppercase px-4 py-1.5 whitespace-nowrap">
                        Most chosen
                      </Badge>
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="font-serif text-xl text-foreground mb-1">{tier.name}</h3>
                    <p className="text-sm text-muted-foreground">{tier.range}</p>
                  </div>
                  <div className="mb-5">
                    {!tier.custom ? (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-serif text-4xl font-bold text-primary">${(tier.perDoor ?? 0).toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground">/door/mo</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {annual
                            ? `$${annualPrice(tier.monthlyMinimum).toLocaleString()}/yr minimum`
                            : `$${tier.monthlyMinimum.toLocaleString()}/mo minimum`}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-serif text-3xl font-bold text-primary">Custom</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {annual
                            ? `From $${annualPrice(tier.monthlyMinimum).toLocaleString()}/yr`
                            : `From $${tier.monthlyMinimum.toLocaleString()}/mo`}
                        </p>
                      </>
                    )}
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-grow">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {tier.ctaPlan ? (
                    <Button
                      className="w-full py-5 gap-2"
                      variant={tier.highlighted ? "default" : "outline"}
                      onClick={() => setLocation(`/signup?plan=${tier.ctaPlan}`)}
                    >
                      {tier.ctaLabel} <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button asChild className="w-full py-5" variant="outline">
                      <a href={`mailto:${SALES_EMAIL}?subject=YCM Enterprise inquiry (Property Managers track)`}>{tier.ctaLabel}</a>
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* ── PM CALCULATOR ── */}
            <div className="mt-14 max-w-4xl mx-auto">
              <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="bg-primary/5 border-b border-border/60 px-8 py-5">
                  <h3 className="font-serif text-2xl text-foreground">What will you pay?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your per-door rate drops as you grow — $4.50 / $4.25 / $4.00. Your tier-minimum is the floor.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-8 p-8">
                  {/* Inputs */}
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="pm-doors" className="block text-sm font-semibold text-foreground mb-1.5">
                        Doors under management
                      </label>
                      <input
                        id="pm-doors"
                        type="number"
                        min={0}
                        step={50}
                        value={pmDoors}
                        onChange={(e) => setPmDoors(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        aria-describedby="pm-doors-help"
                      />
                      <p id="pm-doors-help" className="mt-1.5 text-xs text-muted-foreground">
                        Total units across every community you manage.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="pm-communities" className="block text-sm font-semibold text-foreground mb-1.5">
                        Communities <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <input
                        id="pm-communities"
                        type="number"
                        min={0}
                        step={1}
                        value={pmCommunities}
                        onChange={(e) => setPmCommunities(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        aria-describedby="pm-communities-help"
                      />
                      <p id="pm-communities-help" className="mt-1.5 text-xs text-muted-foreground">
                        How many associations are in your portfolio. Doesn't change the per-door rate.
                      </p>
                    </div>
                  </div>

                  {/* Result */}
                  <div className="rounded-xl bg-primary text-primary-foreground p-7 flex flex-col justify-center">
                    <p className="text-xs font-bold tracking-[0.18em] uppercase text-primary-foreground/70 mb-2">
                      Your plan: {quote.tier.name}
                    </p>
                    {quote.isCustom ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="font-serif text-4xl font-bold">Custom</span>
                        </div>
                        <p className="mt-2 text-sm text-primary-foreground/80">
                          From ${(annual ? annualPrice(quote.tier.monthlyMinimum) : quote.tier.monthlyMinimum).toLocaleString()}/{period} — let's scope it together.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-serif text-5xl font-bold">${quoteMonthly.toLocaleString()}</span>
                          <span className="text-sm text-primary-foreground/80">/{period}</span>
                        </div>
                        <p className="mt-2 text-sm text-primary-foreground/80">
                          {pmDoors.toLocaleString()} doors × ${quote.perDoor.toFixed(2)}/door
                          {quote.minimumApplied
                            ? ` is below the $${quote.tier.monthlyMinimum.toLocaleString()}/mo minimum — your minimum applies.`
                            : annual
                              ? ` = $${quote.rawMonthly.toLocaleString()}/mo, billed yearly (10% off).`
                              : ` = $${quote.rawMonthly.toLocaleString()}/mo.`}
                        </p>
                        {pmCommunities > 0 && (
                          <p className="mt-2 text-xs text-primary-foreground/70">
                            Across {pmCommunities.toLocaleString()} {pmCommunities === 1 ? "community" : "communities"}.
                          </p>
                        )}
                      </>
                    )}
                    <p className="mt-4 text-xs text-primary-foreground/60">
                      Doors set your tier — and tiers unlock features, not a higher rate.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── COMPARISON vs ALTERNATIVES (spec §2.4) ── */}
            <div className="mt-14 max-w-4xl mx-auto">
              <h3 className="font-serif text-2xl text-center text-foreground mb-2">How $4–$4.50/door compares</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">Per-door platform rate vs the major management platforms.</p>
              <div className="overflow-x-auto rounded-2xl border border-border/70 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 text-foreground">
                      <th className="text-left font-semibold px-5 py-3">Platform</th>
                      <th className="text-left font-semibold px-5 py-3">Per-door rate</th>
                      <th className="text-left font-semibold px-5 py-3 hidden sm:table-cell">AI compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr className="bg-primary/5">
                      <td className="px-5 py-3 font-bold text-primary">Your Condo Manager</td>
                      <td className="px-5 py-3 font-bold text-primary">$4.50 → $4.00 / door (volume)</td>
                      <td className="px-5 py-3 hidden sm:table-cell">Built in, every tier</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 text-foreground">AppFolio Plus</td>
                      <td className="px-5 py-3 text-muted-foreground">~$3 / door</td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">Add-on, higher tiers</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 text-foreground">AppFolio Max</td>
                      <td className="px-5 py-3 text-muted-foreground">~$5 / door</td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">Add-on, higher tiers</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 text-foreground">Buildium</td>
                      <td className="px-5 py-3 text-muted-foreground">Tiered per-unit</td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">None</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 text-foreground">Vantaca</td>
                      <td className="px-5 py-3 text-muted-foreground">Enterprise quote</td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">PM workflow only</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Competitor rates are approximate and vary by contract; shown for positioning only.
              </p>
            </div>
          </section>
        )}

        {/* ── SELF-MANAGED COMMUNITIES TRACK ── */}
        {activeTrack === "self-managed" && (
          <section
            id="track-sm-panel"
            role="tabpanel"
            aria-labelledby="track-sm-tab"
            className="max-w-7xl mx-auto px-6 mb-12"
          >
            <div className="text-center mb-8 max-w-3xl mx-auto">
              <p className="text-base text-foreground/80">
                <strong className="text-primary">From $3.50 per unit / month — your rate drops as your community grows.</strong>{" "}
                Small communities start at a flat $129/mo; larger ones earn a lower per-unit rate ($3.75, then $3.50).
              </p>
              <p className="mt-2 text-sm text-muted-foreground italic">
                Self-management made simple. No property manager required. You only pay for the units you actually have.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
              {SM_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    "relative bg-card rounded-2xl p-6 flex flex-col shadow-sm",
                    tier.highlighted ? "border-2 border-primary/40 shadow-xl lg:scale-[1.03] z-10" : "border border-border/70"
                  )}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="rounded-full text-[10px] font-bold tracking-[0.18em] uppercase px-3 py-1 whitespace-nowrap">
                        Most chosen
                      </Badge>
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="font-serif text-xl text-foreground mb-1">{tier.name}</h3>
                    <p className="text-sm text-muted-foreground">{tier.units}</p>
                  </div>
                  <div className="mb-5">
                    {tier.custom ? (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-serif text-3xl font-bold text-primary">Custom</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Negotiable — let's scope it together.</p>
                      </>
                    ) : tier.flatMonthly !== null ? (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-serif text-4xl font-bold text-primary">
                            ${annual ? annualPrice(tier.flatMonthly).toLocaleString() : tier.flatMonthly}
                          </span>
                          <span className="text-sm text-muted-foreground">/{annual ? "yr" : "mo"}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Flat rate up to {tier.maxUnits} units.</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-serif text-4xl font-bold text-primary">${(tier.perUnit ?? 0).toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground">/unit/mo</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          e.g. {tier.maxUnits} units = ${((tier.perUnit ?? 0) * (tier.maxUnits ?? 0)).toLocaleString()}/mo
                        </p>
                      </>
                    )}
                  </div>
                  <ul className="space-y-2 mb-6 flex-grow">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {tier.ctaPlan ? (
                    <Button
                      className="w-full py-5 gap-2"
                      variant={tier.highlighted ? "default" : "outline"}
                      onClick={() => setLocation(`/signup?plan=${tier.ctaPlan}`)}
                    >
                      {tier.ctaLabel} <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button asChild className="w-full py-5" variant="outline">
                      <a href={`mailto:${SALES_EMAIL}?subject=YCM Enterprise Concierge inquiry (Self-Managed track)`}>{tier.ctaLabel}</a>
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* ── SM CALCULATOR (declining per-unit) ── */}
            <div className="mt-14 max-w-4xl mx-auto">
              <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
                <div className="bg-primary/5 border-b border-border/60 px-8 py-5">
                  <h3 className="font-serif text-2xl text-foreground">What will your community pay?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Small is a flat $129/mo; larger communities earn a lower per-unit rate — $3.75, then $3.50.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-8 p-8">
                  {/* Input */}
                  <div className="space-y-6 flex flex-col justify-center">
                    <div>
                      <label htmlFor="sm-units" className="block text-sm font-semibold text-foreground mb-1.5">
                        Units in your community
                      </label>
                      <input
                        id="sm-units"
                        type="number"
                        min={1}
                        step={5}
                        value={smUnits}
                        onChange={(e) => setSmUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        aria-describedby="sm-units-help"
                      />
                      <p id="sm-units-help" className="mt-1.5 text-xs text-muted-foreground">
                        The number of units (doors) in your association.
                      </p>
                    </div>
                  </div>

                  {/* Result */}
                  <div className="rounded-xl bg-primary text-primary-foreground p-7 flex flex-col justify-center">
                    <p className="text-xs font-bold tracking-[0.18em] uppercase text-primary-foreground/70 mb-2">
                      Your plan: {smq.tier.name}
                    </p>
                    {smq.isCustom ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="font-serif text-4xl font-bold">Custom</span>
                        </div>
                        <p className="mt-2 text-sm text-primary-foreground/80">
                          Over 250 units — let's scope a negotiable plan together.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-serif text-5xl font-bold">${smQuoteMonthly.toLocaleString()}</span>
                          <span className="text-sm text-primary-foreground/80">/{period}</span>
                        </div>
                        <p className="mt-2 text-sm text-primary-foreground/80">
                          {smq.isFlat
                            ? `Flat $129/mo for communities up to 40 units${annual ? ", billed yearly (10% off)." : "."}`
                            : `${smUnits.toLocaleString()} units × $${(smq.tier.perUnit ?? 0).toFixed(2)}/unit = $${smq.monthly.toLocaleString()}/mo${annual ? ", billed yearly (10% off)." : "."}`}
                        </p>
                      </>
                    )}
                    <p className="mt-4 text-xs text-primary-foreground/60">
                      Your community size sets your rate — bigger communities pay less per unit.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        <section className="max-w-4xl mx-auto px-6 mb-28">
          <h2 className="font-serif text-3xl text-center mb-10 tracking-tight text-foreground">
            Common questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-1.5">How does per-door pricing work for property managers?</h3>
              <p className="text-sm text-muted-foreground">
                Your <strong>per-door rate drops as your portfolio grows</strong> (volume discount): <strong>$4.50/door</strong> up to 500 doors (Starter), <strong>$4.25/door</strong> at 501–2,000 (Growth), and <strong>$4.00/door</strong> at 2,001–5,000 (Scale). Each tier carries a monthly minimum ($500 Starter, $2,125 Growth, $8,000 Scale); your bill is your door count × your tier's per-door rate, or the tier minimum, whichever is higher. Tiers also unlock features (portfolio rollup, white-label, API, dedicated CSM). Above 5,000 doors, Enterprise is custom (from $18,000/mo).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1.5">Which track am I?</h3>
              <p className="text-sm text-muted-foreground">
                You're a <strong>Property Manager</strong> if you're a paid management company running multiple condo or HOA portfolios on behalf of associations. You're a <strong>Self-Managed Community</strong> if you're an HOA or condo association where the board members directly run operations (no outside property manager).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1.5">Can I switch tracks later?</h3>
              <p className="text-sm text-muted-foreground">
                Yes. Most boards switch from Self-Managed to a Property Manager engagement (or vice versa) over time. Reach out to {SALES_EMAIL} and we'll migrate your data + adjust billing without losing history.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1.5">How does pricing work for self-managed communities?</h3>
              <p className="text-sm text-muted-foreground">
                Your <strong>per-unit rate drops as your community grows</strong>. <strong>Small communities</strong> (1–40 units) pay a flat <strong>$129/mo</strong>. <strong>Mid communities</strong> (41–100) pay <strong>$3.75/unit/mo</strong>, and <strong>Large communities</strong> (101–250) pay <strong>$3.50/unit/mo</strong> — so a 150-unit community is $525/mo and a 250-unit community is $875/mo. Above 250 units, Enterprise Concierge is custom / negotiable. The $129 Small flat rate is the only minimum.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1.5">What's included in the annual discount?</h3>
              <p className="text-sm text-muted-foreground">
                Roughly 10% off the equivalent monthly rate, billed yearly upfront. You keep the same feature set + support tier.
              </p>
            </div>
          </div>
        </section>

        {/* ── TRUST BENTO ── (preserved from v1) */}
        <section className="max-w-7xl mx-auto px-6 mb-28">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-6 md:h-[520px]">

            <div className="sm:col-span-2 md:col-span-2 md:row-span-2 relative overflow-hidden rounded-2xl bg-card border border-border/70 p-10 flex flex-col justify-end shadow-sm">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(217_91%_42%/0.06)_0%,transparent_55%)]" />
              <div className="absolute top-6 right-6 w-52 h-52 rounded-full border border-primary/10" />
              <div className="absolute top-16 right-16 w-36 h-36 rounded-full border border-primary/8" />
              <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full border border-primary/10" />
              <div className="relative z-10">
                <h3 className="font-serif text-4xl text-foreground mb-4">{t("pricing.trust.security.title")}</h3>
                <p className="text-muted-foreground leading-relaxed mb-8">
                  {t("pricing.trust.security.body")}
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="py-1 px-4 bg-muted/80 backdrop-blur-sm rounded-full text-xs font-bold tracking-widest uppercase text-foreground">
                    {t("pricing.trust.security.gdpr")}
                  </span>
                  <span className="py-1 px-4 bg-muted/80 backdrop-blur-sm rounded-full text-xs font-bold tracking-widest uppercase text-foreground">
                    {t("pricing.trust.security.soc2")}
                  </span>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 md:col-span-2 rounded-2xl bg-primary text-primary-foreground p-10 flex items-center gap-8 shadow-sm">
              <div className="shrink-0 bg-white/10 w-16 h-16 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-serif text-3xl mb-1.5">{t("pricing.trust.uptime.title")}</h4>
                <p className="text-primary-foreground/80 leading-relaxed">
                  {t("pricing.trust.uptime.body")}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/60 border border-border/60 p-8 flex flex-col justify-between shadow-sm">
              <h4 className="font-serif text-2xl text-foreground leading-snug">
                {t("pricing.trust.setup.title.line1")} <br />{t("pricing.trust.setup.title.line2")}
              </h4>
              <Zap className="h-10 w-10 text-primary" />
            </div>

            <div className="rounded-2xl bg-muted/60 border border-border/60 p-8 flex flex-col justify-between shadow-sm">
              <h4 className="font-serif text-2xl text-foreground leading-snug">
                {t("pricing.trust.integrate.title.line1")} <br />{t("pricing.trust.integrate.title.line2")}
              </h4>
              <Network className="h-10 w-10 text-primary" />
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="max-w-4xl mx-auto px-6 text-center">
          <div className="rounded-3xl bg-muted/50 border border-border/60 py-16 px-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_top_right,hsl(217_91%_42%/0.07),transparent)] pointer-events-none" />
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <h2 className="font-serif text-4xl tracking-tight text-foreground">
                  {t("pricing.finalCta.title")}
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {t("pricing.finalCta.body")}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {hasWorkspaceAccess ? (
                  <Button size="lg" asChild>
                    <Link href="/app">
                      {t("marketing.cta.openWorkspace")} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" onClick={() => setLocation("/signup?plan=self-managed")}>
                      {t("pricing.finalCta.startTrial")}
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <a href={`mailto:${SALES_EMAIL}?subject=YCM demo request`}>{t("pricing.finalCta.scheduleDemo")}</a>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
