import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Menu,
  Network,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PricingPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

const selfManagedFeatures = [
  "Single Association Portal",
  "Maintenance Request Tool",
  "Automated Dues Collection",
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
  { capability: "Unit Increments",      values: ["Starter / Growth / Community", "Standardized",    "Customized"] },
  { capability: "Multi-Portfolio View", values: [false,                    true,                      true] },
  { capability: "Resident App",         values: ["Standard",               "Standard",                "White-label available"] },
  { capability: "API Access",           values: [false,                    false,                     true] },
  { capability: "Support",              values: ["Help Center",            "Priority Email / Chat",   "Dedicated Account Manager"] },
];

export default function PricingPage({ hasWorkspaceAccess, onStartGoogleSignIn }: PricingPageProps) {
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
      <header
        className={cn(
          "sticky top-0 z-50 transition-all duration-200",
          scrolled
            ? "bg-background/90 backdrop-blur-md border-b border-border/60 shadow-sm"
            : "bg-background/80 backdrop-blur-md border-b border-border/40"
        )}
      >
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 h-16 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm tracking-tight">CondoManager</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            <Link
              href="/"
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Platform
            </Link>
            <button className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
              Solutions
            </button>
            <Link
              href="/pricing"
              className="px-3 py-1.5 text-sm font-semibold text-primary border-b-2 border-primary rounded-none"
            >
              Pricing
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {hasWorkspaceAccess ? (
              <Button asChild>
                <Link href="/app">
                  Open Workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onStartGoogleSignIn}>Sign in</Button>
                <Button size="sm" onClick={onStartGoogleSignIn}>Get started free</Button>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 -mr-1 rounded-lg hover:bg-accent transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-md px-6 py-4 space-y-1">
            <Link
              href="/"
              className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
            >
              Platform
            </Link>
            <button className="w-full text-left px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
              Solutions
            </button>
            <Link
              href="/pricing"
              className="block px-3 py-2.5 text-sm font-semibold text-primary rounded-lg"
            >
              Pricing
            </Link>
            <div className="pt-3 border-t border-border/60 flex flex-col gap-2">
              {hasWorkspaceAccess ? (
                <Button asChild>
                  <Link href="/app">Open Workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
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

      <main className="pb-24">

        {/* ── HERO ── */}
        <header className="max-w-4xl mx-auto text-center px-6 pt-20 pb-20">
          <Badge
            variant="secondary"
            className="rounded-full text-xs font-bold tracking-widest uppercase mb-6"
          >
            Pricing Structure
          </Badge>
          <h1 className="font-serif text-5xl md:text-[4.25rem] leading-[1.06] tracking-tight text-foreground mb-6">
            Investment in{" "}
            <br />
            <em className="not-italic text-primary">Operational Excellence.</em>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Simple, transparent tiers designed for modern estate architecture. Whether you're a
            single board or a regional manager.
          </p>
        </header>

        {/* ── PRICING CARDS ── */}
        <section className="max-w-7xl mx-auto px-6 mb-28">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

            {/* Self-Managed */}
            <div className="bg-card border border-border/70 rounded-2xl p-10 flex flex-col shadow-sm hover:-translate-y-1 transition-transform duration-300">
              <div className="mb-8">
                <h3 className="font-serif text-2xl text-foreground mb-1.5">Self-Managed</h3>
                <p className="text-muted-foreground text-sm">For independent Boards &amp; HOAs.</p>
              </div>
              <div className="mb-7">
                <span className="text-sm text-muted-foreground">Starting at</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-serif text-5xl font-bold text-primary">$99</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-7">
                Tiered by unit count: 1–25, 26–75, and 76+
              </p>
              <ul className="space-y-3.5 mb-10 flex-grow">
                {selfManagedFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-muted-foreground text-sm">
                    <CheckCircle2 className="h-4.5 w-4.5 h-[18px] w-[18px] text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full py-6" onClick={onStartGoogleSignIn}>
                Start Self-Managing
              </Button>
            </div>

            {/* Property Manager — featured */}
            <div className="relative bg-card border-2 border-primary/40 rounded-2xl p-10 flex flex-col shadow-xl scale-[1.03] z-10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="rounded-full text-[10px] font-bold tracking-[0.18em] uppercase px-4 py-1.5">
                  Professional Manager
                </Badge>
              </div>
              <div className="mb-8 pt-2">
                <h3 className="font-serif text-2xl text-foreground mb-1.5">Property Manager</h3>
                <p className="text-muted-foreground text-sm">For growing management firms.</p>
              </div>
              <div className="mb-7">
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-5xl font-bold text-primary">$449</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3.5 mb-10 flex-grow">
                {propertyManagerFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-foreground text-sm">
                    <CheckCircle2 className="h-[18px] w-[18px] text-primary shrink-0" />
                    <span className={f === propertyManagerFeatures[0] ? "font-semibold" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full py-6 gap-2" onClick={onStartGoogleSignIn}>
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Enterprise */}
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
              <Button variant="outline" className="w-full py-6" onClick={onStartGoogleSignIn}>
                Contact Sales
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
                  <th className="p-6 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Self-Managed
                  </th>
                  <th className="p-6 text-xs font-bold tracking-widest text-primary uppercase">
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
                      <td key={i} className={cn("p-6 text-sm", i === 1 ? "text-foreground" : "text-muted-foreground")}>
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
                  Your estate data is protected by bank-grade encryption and regional compliance
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
                  Ready to elevate your management?
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Join over 1,500 property managers who have transitioned to the modern estate
                  architecture.
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
                    <Button size="lg" onClick={onStartGoogleSignIn}>
                      Start 14-Day Free Trial
                    </Button>
                    <Button size="lg" variant="outline" onClick={onStartGoogleSignIn}>
                      Schedule a Demo
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 py-14 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2.5 justify-center md:justify-start mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <span className="text-sm font-semibold text-foreground">CondoManager</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} CondoManager. The Modern Estate Architecture.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {["Terms", "Privacy", "Support", "LinkedIn", "Twitter"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground hover:-translate-y-px transition-all duration-200"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
