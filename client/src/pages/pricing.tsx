// ⚠️ PRICING PAGE — BLOCKED
// This page must not be updated or linked in outreach until payment
// processing (ACH, autopay, bank reconciliation) is live.
// Canonical pricing: docs/strategy/pricing-and-positioning.md
// Restructure task is queued — do not execute until unblocked.

import {
  ArrowRight,
  Check,
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
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";

type PricingPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

// Track 1 primary — self-managed board features
const selfManagedFeatures = [
  "Owner Portal with payment history",
  "Automated dues & assessment collection",
  "Maintenance request tracking",
  "Document management & board packages",
  "Governance meeting & compliance tools",
];

const propertyManagerFeatures = [
  "Manage 5–10 Associations",
  "Multi-Portfolio Dashboard",
  "Vendor Marketplace Access",
  "Advanced Asset Management",
  "Bulk Reporting & Exports",
];

const enterpriseFeatures = [
  "10+ Associations",
  "Dedicated Success Manager",
  "White-label Resident App",
  "API & Custom Integrations",
];

type ComparisonCell = string | boolean;

const comparisonRows: { capability: string; values: [ComparisonCell, ComparisonCell, ComparisonCell] }[] = [
  { capability: "Associations",         values: ["1",                      "5–10",                    "11+"] },
  // PRICING STALE — see docs/strategy/pricing-and-positioning.md
  { capability: "Unit Pricing",         values: ["$30 / $50 per month",    "Standardized",            "Customized"] },
  { capability: "Multi-Portfolio View", values: [false,                    true,                      true] },
  { capability: "Resident App",         values: ["Standard",               "Standard",                "White-label available"] },
  { capability: "API Access",           values: [false,                    false,                     true] },
  { capability: "Support",              values: ["Help Center",            "Priority Email / Chat",   "Dedicated Account Manager"] },
];

export default function PricingPage({ hasWorkspaceAccess, onStartGoogleSignIn }: PricingPageProps) {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">

      {/* ── NAVIGATION ── */}
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-serif italic">Your Condo Manager</span>
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-slate-600 dark:text-slate-400 font-medium hover:text-blue-600 transition-colors duration-300"
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
              className="text-blue-700 dark:text-blue-400 font-bold border-b-2 border-blue-700 dark:border-blue-400 pb-1"
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
                <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-5 py-2 rounded font-semibold scale-95 active:opacity-80 transition-all" onClick={() => setLocation("/signup?plan=self-managed")}>
                  Start Free Trial
                </button>
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
                  <button className="px-4 py-2 text-slate-600 font-medium hover:text-primary transition-colors" onClick={onStartGoogleSignIn}>Sign In</button>
                  <button className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-2 rounded font-semibold active:opacity-80 transition-all" onClick={() => setLocation("/signup?plan=self-managed")}>Start Free Trial</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="pt-16 pb-24">

        {/* ── HERO ── */}
        <header className="max-w-4xl mx-auto text-center px-6 pt-20 pb-20">
          <Badge
            variant="secondary"
            className="rounded-full text-xs font-bold tracking-widest uppercase mb-6"
          >
            Simple, Transparent Pricing
          </Badge>
          <h1 className="font-serif text-5xl md:text-[4.25rem] leading-[1.06] tracking-tight text-foreground mb-6">
            Run your association{" "}
            <br />
            <em className="not-italic text-primary">without a property manager.</em>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Flat monthly pricing per association. No per-unit fees, no contracts, no surprises.
            Built for self-managed boards who want a real system — not another spreadsheet.
          </p>
        </header>

        {/* ── PRICING CARDS ── */}
        <section className="max-w-7xl mx-auto px-6 mb-28">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

            {/* Self-Managed — FEATURED (Track 1 primary) */}
            <div className="relative bg-card border-2 border-primary/40 rounded-2xl p-10 flex flex-col shadow-xl scale-[1.03] z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="rounded-full text-[10px] font-bold tracking-[0.18em] uppercase px-4 py-1.5">
                  Most Popular
                </Badge>
              </div>
              <div className="mb-8 pt-2">
                <h3 className="font-serif text-2xl text-foreground mb-1.5">Self-Managed</h3>
                <p className="text-muted-foreground text-sm">For self-managed Boards &amp; Condo Associations.</p>
              </div>
              <div className="mb-3">
                <div className="flex items-baseline gap-1">
                  {/* PRICING STALE — see docs/strategy/pricing-and-positioning.md */}
                  <span className="font-serif text-5xl font-bold text-primary">$30</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <div className="mb-7 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {/* PRICING STALE — see docs/strategy/pricing-and-positioning.md */}
                  Under 30 units: <span className="font-semibold text-foreground">$30/mo</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {/* PRICING STALE — see docs/strategy/pricing-and-positioning.md */}
                  30 units or more: <span className="font-semibold text-foreground">$50/mo</span>
                </p>
                <p className="text-xs text-muted-foreground pt-1">Per association. No per-unit fees.</p>
              </div>
              <ul className="space-y-3.5 mb-10 flex-grow">
                {selfManagedFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-foreground text-sm">
                    <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full py-6 gap-2" onClick={() => setLocation("/signup?plan=self-managed")}>
                Start 14-Day Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Property Manager */}
            <div className="bg-card border border-border/70 rounded-2xl p-10 flex flex-col shadow-sm hover:-translate-y-1 transition-transform duration-300">
              <div className="mb-8">
                <h3 className="font-serif text-2xl text-foreground mb-1.5">Property Manager</h3>
                <p className="text-muted-foreground text-sm">For growing management firms.</p>
              </div>
              <div className="mb-7">
                <div className="flex items-baseline gap-1">
                  {/* PRICING STALE — see docs/strategy/pricing-and-positioning.md */}
                  <span className="font-serif text-5xl font-bold text-primary">$450</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3.5 mb-10 flex-grow">
                {propertyManagerFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-muted-foreground text-sm">
                    <CheckCircle2 className="h-4.5 w-4.5 h-[18px] w-[18px] text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full py-6" onClick={() => setLocation("/signup?plan=property-manager")}>
                Start Free Trial
              </Button>
            </div>

            {/* PRICING STALE — "Enterprise" tier name superseded. See docs/strategy/pricing-and-positioning.md */}
            <div className="bg-card border border-border/70 rounded-2xl p-10 flex flex-col shadow-sm hover:-translate-y-1 transition-transform duration-300">
              <div className="mb-8">
                <h3 className="font-serif text-2xl text-foreground mb-1.5">Enterprise</h3>
                <p className="text-muted-foreground text-sm">Bespoke solutions for large portfolios.</p>
              </div>
              <div className="mb-7">
                <span className="font-serif text-5xl font-bold text-primary">Custom</span>
              </div>
              <ul className="space-y-3.5 mb-10 flex-grow">
                {enterpriseFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-muted-foreground text-sm">
                    <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full py-6" asChild>
                <a href="mailto:sales@yourcondomanager.org">Contact Sales</a>
              </Button>
            </div>
          </div>
        </section>

        {/* ── COMPARISON TABLE ── */}
        <section className="max-w-6xl mx-auto px-6 mb-28">
          <h2 className="font-serif text-4xl text-center mb-14 tracking-tight text-foreground">
            Plan Comparison
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border/60 shadow-sm">
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead>
                <tr className="bg-muted/60 border-b border-border/60">
                  <th className="p-6 font-serif text-xl text-foreground">Capability</th>
                  <th className="p-6 text-xs font-bold tracking-widest text-primary uppercase">
                    Self-Managed
                  </th>
                  <th className="p-6 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Property Manager
                  </th>
                  <th className="p-6 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 bg-card">
                {comparisonRows.map((row) => (
                  <tr key={row.capability} className="hover:bg-muted/30 transition-colors">
                    <td className="p-6 text-sm font-semibold text-foreground">{row.capability}</td>
                    {row.values.map((val, i) => (
                      <td key={i} className={cn("p-6 text-sm", i === 0 ? "text-foreground" : "text-muted-foreground")}>
                        {val === true ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : val === false ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          val
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── TRUST BENTO ── */}
        <section className="max-w-7xl mx-auto px-6 mb-28">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-6 md:h-[520px]">

            {/* Security — large, spans 2 rows × 2 cols */}
            <div className="sm:col-span-2 md:col-span-2 md:row-span-2 relative overflow-hidden rounded-2xl bg-card border border-border/70 p-10 flex flex-col justify-end shadow-sm">
              {/* Abstract architectural background */}
              <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(217_91%_42%/0.06)_0%,transparent_55%)]" />
              <div className="absolute top-6 right-6 w-52 h-52 rounded-full border border-primary/10" />
              <div className="absolute top-16 right-16 w-36 h-36 rounded-full border border-primary/8" />
              <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full border border-primary/10" />
              <div className="relative z-10">
                <h3 className="font-serif text-4xl text-foreground mb-4">Unrivaled Security.</h3>
                <p className="text-muted-foreground leading-relaxed mb-8">
                  Your association data is protected by bank-grade encryption and regional compliance
                  standards. We take the burden of trust off your shoulders.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="py-1 px-4 bg-muted/80 backdrop-blur-sm rounded-full text-xs font-bold tracking-widest uppercase text-foreground">
                    GDPR Ready
                  </span>
                  <span className="py-1 px-4 bg-muted/80 backdrop-blur-sm rounded-full text-xs font-bold tracking-widest uppercase text-foreground">
                    SOC 2 Type II
                  </span>
                </div>
              </div>
            </div>

            {/* Uptime — spans 2 cols */}
            <div className="sm:col-span-2 md:col-span-2 rounded-2xl bg-primary text-primary-foreground p-10 flex items-center gap-8 shadow-sm">
              <div className="shrink-0 bg-white/10 w-16 h-16 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-serif text-3xl mb-1.5">99.9% Uptime</h4>
                <p className="text-primary-foreground/80 leading-relaxed">
                  Our infrastructure is built on distributed cloud systems, ensuring your portal is
                  always live for residents.
                </p>
              </div>
            </div>

            {/* Setup */}
            <div className="rounded-2xl bg-muted/60 border border-border/60 p-8 flex flex-col justify-between shadow-sm">
              <h4 className="font-serif text-2xl text-foreground leading-snug">
                Setup in <br />Minutes
              </h4>
              <Zap className="h-10 w-10 text-primary" />
            </div>

            {/* Integrate */}
            <div className="rounded-2xl bg-muted/60 border border-border/60 p-8 flex flex-col justify-between shadow-sm">
              <h4 className="font-serif text-2xl text-foreground leading-snug">
                Integrate <br />Anywhere
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
                  Ready to stop managing on spreadsheets?
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Your Condo Manager gives self-managed boards a real system of record — dues collection,
                  owner portal, maintenance tracking, and governance tools in one place.
                  No property manager required.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {hasWorkspaceAccess ? (
                  <Button size="lg" asChild>
                    <Link href="/app">
                      Open Workspace <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="lg" onClick={() => setLocation("/signup?plan=self-managed")}>
                      Start 14-Day Free Trial
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <a href="mailto:sales@yourcondomanager.org">Schedule a Demo</a>
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
