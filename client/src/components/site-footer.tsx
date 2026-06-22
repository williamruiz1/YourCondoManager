import { Link } from "wouter";
import { BrandMark } from "@/components/brand-mark";

export function SiteFooter() {
  return (
    <footer className="bg-slate-50 dark:bg-slate-900 w-full border-t border-slate-200 dark:border-slate-800" role="contentinfo">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-12 py-16 w-full max-w-screen-2xl mx-auto">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <BrandMark decorative className="h-9 w-9" />
            <div className="text-xl font-serif text-slate-900 dark:text-slate-100">Your Condo Manager</div>
          </div>
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
            {["Self-Managed Communities", "Enterprise Firms", "Resident Experience", "Developer API"].map(
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
            {[
              { label: "About Us", href: "#" },
              { label: "Careers", href: "#" },
              { label: "Legal Resources", href: "#" },
              { label: "Contact Us", href: "mailto:contact@yourcondomanager.org" },
            ].map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
                >
                  {item.label}
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
                { icon: "share", label: "Share", href: "#" },
                { icon: "podcasts", label: "Podcasts", href: "#" },
                { icon: "alternate_email", label: "Email", href: "mailto:contact@yourcondomanager.org" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  aria-label={item.href.startsWith("mailto:") ? "Email us at contact@yourcondomanager.org" : `Visit us on ${item.label}`}
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
          href="/app/help-center"
          className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        >
          Help Center
        </Link>
        <Link
          href="/privacy"
          className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
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
      {/* Marginalia Partners attribution — per founder-os D72 + spec
          `the-practice/00-strategy-and-positioning/attribution-standard-spec-v1.0.md`
          §2 Variant A. v1 text-only treatment (no logo) per §4; one
          typographic step smaller than primary footer copy; deliberate
          signoff spacing above. */}
      <div className="px-12 py-6 border-t border-slate-200/50 dark:border-slate-800/50">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
          Built in partnership with{" "}
          <a
            href="https://marginaliapartners.com/case-studies/your-condo-manager"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-colors underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            Marginalia Partners
          </a>{" "}
          → marginaliapartners.com/case-studies/your-condo-manager
        </p>
      </div>
    </footer>
  );
}
