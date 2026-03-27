import { ArrowRight, Menu, X } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

type TermsOfServicePageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

export default function TermsOfServicePage({
  hasWorkspaceAccess,
  onStartGoogleSignIn,
}: TermsOfServicePageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* ── NAVIGATION ── */}
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm dark:shadow-none">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-12 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-serif italic">
              Your Condo Manager
            </span>
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
                <button
                  className="text-slate-600 font-medium hover:text-primary transition-colors"
                  onClick={onStartGoogleSignIn}
                >
                  Sign In
                </button>
                <button
                  className="bg-gradient-to-r from-primary to-primary/90 text-white px-5 py-2 rounded font-semibold scale-95 active:opacity-80 transition-all"
                  onClick={onStartGoogleSignIn}
                >
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
                  <button
                    className="px-4 py-2 text-slate-600 font-medium hover:text-primary transition-colors"
                    onClick={onStartGoogleSignIn}
                  >
                    Sign In
                  </button>
                  <button
                    className="bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-2 rounded font-semibold active:opacity-80 transition-all"
                    onClick={onStartGoogleSignIn}
                  >
                    Open Workspace
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6 md:px-10">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-6xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:font-serif prose-headings:font-bold">
            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                Agreement to Terms
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                These Terms of Service ("Terms," "Agreement") constitute a legal agreement between you ("User," "you," "your") and Your Condo Manager ("Company," "we," "us," "our"). By accessing and using the Your Condo Manager platform (the "Service"), you acknowledge that you have read, understood, and agree to be bound by all terms and conditions outlined in this Agreement. If you do not agree with any part of these Terms, you must immediately stop using the Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                1. Use License
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Your Condo Manager grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for lawful purposes only. You agree not to:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
                <li>Reproduce, duplicate, copy, sell, resell, or exploit the Service</li>
                <li>Access the Service through unauthorized means or automated methods</li>
                <li>Use the Service to transmit viruses, malware, or harmful code</li>
                <li>Reverse engineer, decompile, or attempt to derive the source code</li>
                <li>Use the Service for illegal activities or to violate any laws</li>
                <li>Harass, threaten, defame, or abuse other users</li>
                <li>Interfere with or disrupt the integrity of the Service</li>
                <li>Collect or track personal information about other users without consent</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                2. User Accounts
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                To use Your Condo Manager, you may be required to create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li>Providing accurate, complete, and current information during registration</li>
                <li>Maintaining the confidentiality of your password and account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Immediately notifying us of any unauthorized access or breach</li>
                <li>Complying with all applicable laws while using the Service</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300">
                Your Condo Manager reserves the right to suspend or terminate your account if you violate these Terms or engage in unauthorized activity.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                3. Intellectual Property Rights
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                All content, features, and functionality of the Service—including but not limited to text, graphics, logos, images, software, and documentation—are the exclusive property of Your Condo Manager or its content providers and are protected by copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                You retain all rights to any content you submit to the Service. However, by submitting content, you grant Your Condo Manager a worldwide, royalty-free, perpetual license to use, reproduce, modify, and distribute your content for purposes of providing and improving the Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                4. User Content
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                You are responsible for all content you upload, submit, or transmit through the Service ("User Content"). You represent and warrant that:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li>You own or have the necessary rights to the content you submit</li>
                <li>The content does not infringe on any third-party rights</li>
                <li>The content is accurate, complete, and not misleading</li>
                <li>The content does not contain viruses, malware, or harmful code</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300">
                Your Condo Manager reserves the right to remove, modify, or refuse any User Content that violates these Terms or applicable laws, without liability.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                5. Payment Terms
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                For paid services:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li>Fees are displayed before you commit to a purchase</li>
                <li>You authorize us to charge your payment method for subscription fees</li>
                <li>Billing occurs on the date specified in your subscription plan</li>
                <li>You are responsible for all applicable taxes</li>
                <li>Refunds are subject to our refund policy</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300">
                You can cancel your subscription at any time. Cancellation takes effect at the end of your current billing cycle. No refunds are provided for partial billing periods unless required by law.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                6. Limitation of Liability
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                To the fullest extent permitted by law:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
                <li>Your Condo Manager is provided "as is" without warranties of any kind</li>
                <li>We do not warrant that the Service will be uninterrupted, error-free, or secure</li>
                <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
                <li>Our total liability shall not exceed the amount you paid for the Service in the past 12 months</li>
                <li>Some jurisdictions do not allow limitations of liability; these restrictions may not apply to you</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                7. Indemnification
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                You agree to indemnify and hold harmless Your Condo Manager and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising from:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your infringement of any intellectual property or other rights</li>
                <li>Your User Content or actions on the platform</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                8. Modifications to Service
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Your Condo Manager reserves the right to:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
                <li>Modify, update, or discontinue the Service at any time</li>
                <li>Change features, functionality, or pricing with notice</li>
                <li>Perform maintenance that may temporarily disrupt the Service</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mt-4">
                We will provide reasonable notice of material changes when possible. Your continued use of the Service following modifications constitutes acceptance of those changes.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                9. Third-Party Links and Services
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                The Service may contain links to third-party websites and services. Your Condo Manager does not endorse, control, or assume responsibility for third-party content, policies, or practices. Your use of third-party services is governed by their own terms and conditions. We are not liable for any damage or loss caused by your use of third-party services.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                10. Termination
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Either party may terminate this Agreement at any time. Your Condo Manager may terminate or suspend your access immediately if you:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li>Violate these Terms</li>
                <li>Engage in illegal activity</li>
                <li>Abuse or harass other users</li>
                <li>Breach security measures</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300">
                Upon termination, your right to use the Service immediately ceases. We may delete your account data after a retention period as outlined in our Privacy Policy.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                11. Disclaimer of Warranties
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                The Service is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. Your Condo Manager disclaims all warranties including:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
                <li>Warranties of merchantability or fitness for a particular purpose</li>
                <li>Warranties of non-infringement</li>
                <li>Warranties of accuracy or completeness</li>
                <li>Warranties that the Service will be error-free or uninterrupted</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                12. Governing Law
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                These Terms are governed by and construed in accordance with the laws of the United States, without regard to its conflict of laws principles. You agree to submit to the exclusive jurisdiction of the federal and state courts located in the United States for any disputes arising from these Terms or your use of the Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                13. Severability
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                If any provision of these Terms is found to be invalid or unenforceable, that provision shall be severed, and the remaining provisions shall remain in full force and effect.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                14. Entire Agreement
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                These Terms, together with our Privacy Policy and any other legal notices published by Your Condo Manager, constitute the entire agreement between you and Your Condo Manager regarding the Service and supersede all prior agreements and understandings.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                15. Amendments
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Your Condo Manager may update these Terms at any time. We will provide notice of material changes by posting the updated Terms on our website with a new "Last updated" date. Your continued use of the Service after changes constitutes your acceptance of the modified Terms.
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                It is your responsibility to review these Terms periodically for updates. If you do not agree to any modifications, you must discontinue using the Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                16. Contact Us
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                If you have questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg mb-4">
                <p className="text-slate-900 dark:text-slate-100 font-semibold mb-3">Your Condo Manager Legal Team</p>
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  <strong>Email:</strong> <a href="mailto:legal@yourcondomanager.org" className="text-primary hover:underline">legal@yourcondomanager.org</a>
                </p>
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  <strong>Support:</strong> <a href="mailto:support@yourcondomanager.org" className="text-primary hover:underline">support@yourcondomanager.org</a>
                </p>
                <p className="text-slate-700 dark:text-slate-300">
                  <strong>Address:</strong> Your Condo Manager Inc., Property Management Software, United States
                </p>
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                We will respond to your inquiry within 10 business days.
              </p>
            </section>
          </div>
        </div>
      </main>

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
          <Link href="/privacy-policy">
            <a
              className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
            >
              Privacy Policy
            </a>
          </Link>
          <Link href="/terms-of-service">
            <a
              className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
            >
              Terms of Service
            </a>
          </Link>
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
