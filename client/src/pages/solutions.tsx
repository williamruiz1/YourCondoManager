import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SolutionsPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

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
  const [isDark, setIsDark] = useState(false);
  const [scrollDepth, setScrollDepth] = useState(0);

  // Track page view and scroll depth
  useEffect(() => {
    trackEvent("page_view", {
      page_path: "/solutions",
      page_title: "Solutions - CondoManager",
    });

    const handleScroll = () => {
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
    <div className={cn("min-h-screen", isDark ? "dark bg-slate-950" : "bg-surface-bright")}>
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="absolute top-0 left-0 z-[100] px-4 py-2 bg-primary text-white -translate-y-full focus:translate-y-0 transition-transform rounded-br"
      >
        Skip to main content
      </a>

      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl editorial-shadow" role="navigation" aria-label="Main navigation">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
          <Link href="/">
            <a className="text-2xl font-serif italic text-primary dark:text-slate-100 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-950 rounded px-2 py-1">
              CondoManager
            </a>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/">
              <a className="text-on-surface-variant dark:text-slate-400 font-medium hover:text-primary dark:hover:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
                Platform
              </a>
            </Link>
            <Link href="/solutions">
              <a className="text-primary dark:text-blue-400 font-semibold border-b-2 border-primary dark:border-blue-400 pb-1 focus:outline-none focus:ring-2 focus:ring-primary rounded px-2" aria-current="page">
                Solutions
              </a>
            </Link>
            <Link href="/pricing">
              <a className="text-on-surface-variant dark:text-slate-400 font-medium hover:text-primary dark:hover:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1">
                Pricing
              </a>
            </Link>
          </div>
          <div className="flex items-center gap-6">
            <button
              className="hidden lg:block text-on-surface-variant dark:text-slate-400 font-medium hover:text-primary dark:hover:text-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-primary rounded px-3 py-2"
              aria-label="Login to your account"
            >
              Login
            </button>
            <button
              onClick={() => handleCTAClick("request_demo", "nav_header")}
              className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2.5 rounded shadow-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-slate-950"
              aria-label="Request a demo of CondoManager"
            >
              Request Demo
              <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
            </button>
          </div>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 h-[1px] w-full" aria-hidden="true"></div>
      </nav>

      <main className="pt-32 pb-24" id="main-content">
        {/* Hero Section */}
        <header className="max-w-screen-2xl mx-auto px-8 mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
            <div className="lg:col-span-7">
              <span className="text-xs uppercase tracking-[0.3em] font-bold text-primary mb-6 block">
                Our Solutions
              </span>
              <h1 className="font-headline text-6xl md:text-8xl leading-[1.1] text-on-surface dark:text-slate-100 mb-8">
                The Infrastructure of <br />
                <i className="font-light">Modern Excellence.</i>
              </h1>
              <p className="text-xl text-on-surface-variant dark:text-slate-400 max-w-xl leading-relaxed">
                CondoManager provides the architectural framework for high-performance property
                ecosystems—from independent boards to global management firms.
              </p>
            </div>
            <div className="lg:col-span-5 hidden lg:block text-right pb-4">
              <div className="inline-flex items-center gap-4 text-sm font-medium text-outline">
                <span className="w-12 h-[1px] bg-outline-variant"></span>
                SCROLL TO EXPLORE
              </div>
            </div>
          </div>
        </header>

        {/* Section 1: Self-Managed Associations */}
        <section className="mb-48">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="bg-surface-container-low dark:bg-slate-900 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
              <div className="p-12 lg:p-24 flex flex-col justify-center">
                <div className="mb-12">
                  <span className="material-symbols-outlined text-4xl text-primary mb-4">
                    account_balance
                  </span>
                  <h2 className="font-headline text-5xl text-on-surface dark:text-slate-100 mb-6">
                    Self-Managed <br />
                    Associations
                  </h2>
                  <p className="text-on-surface-variant dark:text-slate-400 text-lg leading-relaxed mb-8">
                    Empower your board with professional-grade tools designed for simplicity and
                    total transparency. We remove the friction of community governance.
                  </p>
                </div>
                <div className="space-y-8" role="list">
                  {[
                    {
                      icon: "payments",
                      title: "Dues Collection",
                      description: "Automated, secure digital payments with real-time delinquency tracking.",
                    },
                    {
                      icon: "handyman",
                      title: "Maintenance Hubs",
                      description: "Centralized ticketing for common areas and private unit requests.",
                    },
                    {
                      icon: "how_to_reg",
                      title: "Digital Voting",
                      description: "Legally-compliant proxy voting and secure community polls.",
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-6 group" role="listitem">
                      <div
                        className="w-12 h-12 rounded-full bg-surface-container-highest dark:bg-slate-800 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary dark:group-hover:bg-primary dark:group-hover:text-white transition-all flex-shrink-0"
                        aria-label={item.title}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
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
                  alt="Modern architectural glass building facade representing professional infrastructure"
                  className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80"
                  src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Property Management Companies (Bento Grid Style) */}
        <section className="mb-48 bg-surface-container-lowest dark:bg-slate-950 py-32 border-y border-surface-container dark:border-slate-800">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="text-center mb-20">
              <span className="text-xs uppercase tracking-[0.3em] font-bold text-primary mb-4 block">
                Enterprise Scale
              </span>
              <h2 className="font-headline text-5xl md:text-6xl text-on-surface dark:text-slate-100 mb-6">
                Property Management <br />
                Companies
              </h2>
              <p className="text-on-surface-variant dark:text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
                Sophisticated multi-entity management for firms that demand precision, scalability,
                and institutional-grade reporting.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[600px]">
              {/* Centralized Reporting - Large Card */}
              <div className="md:col-span-8 bg-surface-container dark:bg-slate-900 rounded-xl p-12 flex flex-col justify-between overflow-hidden relative group">
                <div className="relative z-10">
                  <span className="material-symbols-outlined text-4xl text-primary mb-6">
                    analytics
                  </span>
                  <h3 className="font-headline text-4xl text-on-surface dark:text-slate-100 mb-4">
                    Centralized Reporting
                  </h3>
                  <p className="text-on-surface-variant dark:text-slate-400 text-lg max-w-md">
                    Aggregate financial data across your entire portfolio. Generate board-ready
                    reports in seconds with customizable KPIs.
                  </p>
                </div>
                <img
                  alt="Financial dashboard with charts and data visualization"
                  className="absolute bottom-[-10%] right-[-10%] w-3/4 opacity-10 group-hover:scale-105 transition-transform duration-700"
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80"
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
              </div>

              {/* Multi-Entity Accounting - Primary Blue */}
              <div className="md:col-span-4 bg-primary dark:bg-blue-900 text-on-primary dark:text-white rounded-xl p-12 flex flex-col justify-between">
                <div>
                  <span className="material-symbols-outlined text-4xl mb-6">account_tree</span>
                  <h3 className="font-headline text-3xl mb-4">
                    Multi-Entity <br />
                    Accounting
                  </h3>
                  <p className="text-on-primary/80 dark:text-blue-100">
                    Robust GL, automated bank recs, and segmented financial tracking for every
                    association under management.
                  </p>
                </div>
                <button
                  onClick={() => handleCTAClick("learn_security", "enterprise_section")}
                  className="mt-8 flex items-center gap-2 font-bold group hover:gap-3 transition-all focus:outline-none focus:ring-2 focus:ring-white rounded px-2"
                >
                  Learn about Security
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform" aria-hidden="true">
                    arrow_forward
                  </span>
                </button>
              </div>

              {/* Vendor Management */}
              <div className="md:col-span-4 bg-surface-container dark:bg-slate-900 rounded-xl p-12 flex flex-col justify-center border-t-4 border-primary">
                <h4 className="font-bold text-xl text-on-surface dark:text-slate-100 mb-3">
                  Vendor Management
                </h4>
                <p className="text-on-surface-variant dark:text-slate-400">
                  Streamline procurement and work orders with integrated compliance tracking and
                  automated COI monitoring.
                </p>
              </div>

              {/* Automated Communications */}
              <div className="md:col-span-8 bg-surface-container dark:bg-slate-900 rounded-xl p-12 flex items-center gap-12 overflow-hidden">
                <div className="flex-1">
                  <h4 className="font-bold text-xl text-on-surface dark:text-slate-100 mb-3">
                    Automated Communications
                  </h4>
                  <p className="text-on-surface-variant dark:text-slate-400">
                    Broadcast notifications via SMS, email, and app push across all properties
                    simultaneously.
                  </p>
                </div>
                <div className="hidden lg:flex gap-4">
                  <div className="w-16 h-16 rounded-lg bg-surface-container-highest dark:bg-slate-800 animate-pulse"></div>
                  <div className="w-16 h-16 rounded-lg bg-surface-container-highest dark:bg-slate-800 animate-pulse delay-75"></div>
                  <div className="w-16 h-16 rounded-lg bg-surface-container-highest dark:bg-slate-800 animate-pulse delay-150"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Resident Engagement */}
        <section className="max-w-screen-2xl mx-auto px-8 mb-48">
          <div className="flex flex-col lg:flex-row gap-24 items-center">
            <div className="lg:w-1/2 order-2 lg:order-1">
              <div className="relative">
                <div className="aspect-[4/5] bg-surface-container-high dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
                  <img
                    alt="Resident viewing amenity booking on mobile application"
                    className="w-full h-full object-cover"
                    src="https://images.unsplash.com/photo-1512941691920-25bda36dc643?w=400&q=80"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                {/* Floating Glass UI Card */}
                <div className="absolute -bottom-12 -right-12 p-8 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-xl editorial-shadow max-w-xs border border-white/20 dark:border-slate-700/20 hidden md:block">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-secondary-container dark:bg-blue-800 flex items-center justify-center text-primary dark:text-blue-400">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                    </div>
                    <span className="text-sm font-bold uppercase tracking-wider text-on-surface dark:text-slate-100">
                      Upcoming Booking
                    </span>
                  </div>
                  <p className="text-sm font-medium text-on-surface dark:text-slate-100 mb-1">
                    Rooftop Lounge
                  </p>
                  <p className="text-xs text-on-surface-variant dark:text-slate-400">Today at 7:00 PM</p>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 order-1 lg:order-2">
              <span className="text-xs uppercase tracking-[0.3em] font-bold text-primary mb-6 block">
                Resident Experience
              </span>
              <h2 className="font-headline text-5xl text-on-surface dark:text-slate-100 mb-8">
                The Modern Resident Journey
              </h2>
              <p className="text-lg text-on-surface-variant dark:text-slate-400 leading-relaxed mb-12">
                Property management is no longer just about maintenance; it's about hospitality.
                Provide your residents with a high-touch digital experience that enhances their
                lifestyle.
              </p>
              <div className="space-y-12">
                {[
                  {
                    num: "01",
                    title: "Amenity Booking",
                    description:
                      "Real-time scheduling for pools, gyms, and party rooms with integrated guest management.",
                  },
                  {
                    num: "02",
                    title: "One-Touch Payments",
                    description:
                      "A seamless mobile-first wallet for recurring dues, guest parking, and on-demand services.",
                  },
                  {
                    num: "03",
                    title: "Community Bulletin",
                    description:
                      "A curated digital space for local announcements, community classifieds, and verified social groups.",
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
                Ready to elevate your estate?
              </h2>
              <p className="text-xl text-on-primary/70 dark:text-blue-100 mb-12 max-w-xl mx-auto">
                Join the leading properties that have standardized their operations on CondoManager.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <button
                  onClick={() => handleCTAClick("request_demo", "cta_footer")}
                  className="bg-white dark:bg-slate-100 text-primary dark:text-blue-900 px-10 py-4 rounded font-bold text-lg hover:bg-slate-50 dark:hover:bg-slate-200 transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary dark:focus:ring-offset-blue-900"
                  aria-label="Request a demo of CondoManager solutions"
                >
                  Request a Demo
                </button>
                <button
                  onClick={() => handleCTAClick("view_pricing", "cta_footer")}
                  className="border border-white/30 dark:border-blue-400/30 text-white dark:text-blue-100 px-10 py-4 rounded font-bold text-lg hover:bg-white/10 dark:hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary dark:focus:ring-offset-blue-900"
                  aria-label="View CondoManager pricing"
                >
                  View Pricing
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 dark:bg-slate-900 w-full border-t border-slate-200 dark:border-slate-800" role="contentinfo">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-12 py-16 w-full max-w-screen-2xl mx-auto">
          <div className="space-y-6">
            <div className="text-xl font-serif text-slate-900 dark:text-slate-100">CondoManager</div>
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
                © 2024 CondoManager. The Modern Estate Excellence.
              </p>
            </div>
          </div>
        </div>
        <div className="px-12 py-6 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-wrap gap-8">
          <a
            href="#"
            className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
          >
            Terms of Service
          </a>
          <a
            href="#"
            className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
          >
            Cookie Settings
          </a>
        </div>
      </footer>
    </div>
  );
}
