import { Link } from "wouter";

export function SiteFooter() {
  return (
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
          href="/app/help-center"
          className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
        >
          Help Center
        </Link>
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
  );
}
