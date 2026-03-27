import { ArrowRight, Menu, X } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

type PrivacyPolicyPageProps = {
  hasWorkspaceAccess: boolean;
  onStartGoogleSignIn: () => void;
};

export default function PrivacyPolicyPage({
  hasWorkspaceAccess,
  onStartGoogleSignIn,
}: PrivacyPolicyPageProps) {
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
              Privacy Policy
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:font-serif prose-headings:font-bold">
            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                Introduction
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Your Condo Manager ("Company," "we," "us," or "our") operates the Your Condo Manager platform (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our application.
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Service. By accessing and using Your Condo Manager, you acknowledge that you have read, understood, and agree to be bound by all the provisions of this Privacy Policy.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                1. Information We Collect
              </h2>

              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                1.1 Information You Provide Directly
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We collect information you voluntarily provide when you create an account, register with us, make a purchase, or contact us:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li>Account information (name, email address, phone number, password)</li>
                <li>Property and association details (address, unit numbers, resident count)</li>
                <li>Financial information (bank account details, payment method, billing address)</li>
                <li>Profile information (profile picture, bio, preferences)</li>
                <li>Communication data (messages, support tickets, feedback)</li>
                <li>Resident and owner information shared through the platform</li>
              </ul>

              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                1.2 Information Collected Automatically
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                When you access our Service, we automatically collect certain information:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li>Log data (IP address, browser type, pages visited, time and date of access)</li>
                <li>Device information (device type, operating system, device identifiers)</li>
                <li>Usage data (features used, interactions, session duration)</li>
                <li>Location data (city, region, country based on IP address)</li>
                <li>Cookies and similar technologies</li>
              </ul>

              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                1.3 Information from Third Parties
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We may receive information about you from third-party services including:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
                <li>Payment processors and financial institutions</li>
                <li>Authentication providers (Google, email verification services)</li>
                <li>Analytics providers</li>
                <li>Other users who upload your information to our platform</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                2. How We Use Your Information
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We use the information we collect for various purposes:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2">
                <li>Providing, maintaining, and improving our Service</li>
                <li>Processing transactions and sending related information</li>
                <li>Sending technical notices, security alerts, and support messages</li>
                <li>Responding to your comments, questions, and requests</li>
                <li>Personalizing your experience and delivering relevant content</li>
                <li>Monitoring and analyzing trends, usage, and activities</li>
                <li>Detecting and preventing fraudulent transactions and other illegal activity</li>
                <li>Enforcing our Terms of Service and other agreements</li>
                <li>Conducting marketing and promotional activities</li>
                <li>Complying with legal obligations</li>
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                3. Data Security
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We implement comprehensive security measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li>Bank-grade encryption (TLS 1.2 and above) for all data in transit</li>
                <li>Advanced encryption for sensitive data at rest</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>SOC 2 Type II compliance</li>
                <li>Restricted access controls and authentication mechanisms</li>
                <li>Secure password requirements and account recovery procedures</li>
                <li>Regular security training for our team members</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300">
                Despite our security measures, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security of your information. You assume all responsibility and risk for your use of our Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                4. Sharing Your Information
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We may share your information in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li><strong>With board members and managers:</strong> Information necessary to perform property management functions</li>
                <li><strong>With residents:</strong> Information relevant to their account and community engagement</li>
                <li><strong>With service providers:</strong> Third parties who assist us in operating our Service (payment processors, hosting providers, analytics services)</li>
                <li><strong>For legal reasons:</strong> When required by law, court order, or regulatory authority</li>
                <li><strong>Business transfers:</strong> In the event of merger, acquisition, or sale of assets</li>
                <li><strong>With your consent:</strong> For any other purpose with your explicit permission</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300">
                We require all third-party service providers to maintain the confidentiality and security of your personal information.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                5. Your Privacy Rights
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Depending on your location, you may have certain rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li><strong>Right to Access:</strong> You can request a copy of your personal data</li>
                <li><strong>Right to Correction:</strong> You can request correction of inaccurate information</li>
                <li><strong>Right to Deletion:</strong> You can request deletion of your personal data ("right to be forgotten")</li>
                <li><strong>Right to Portability:</strong> You can request your data in a portable format</li>
                <li><strong>Right to Opt-Out:</strong> You can opt out of marketing communications</li>
                <li><strong>Right to Restrict Processing:</strong> You can restrict how we use your data</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300">
                To exercise these rights, please contact us at <a href="mailto:privacy@yourcondomanager.org" className="text-primary hover:underline">privacy@yourcondomanager.org</a> with your request. We will respond within 30 days.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                6. Cookies and Tracking Technologies
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We use cookies and similar tracking technologies to enhance your experience:
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                <li><strong>Essential Cookies:</strong> Required for authentication and security</li>
                <li><strong>Performance Cookies:</strong> Help us understand how users interact with our Service</li>
                <li><strong>Marketing Cookies:</strong> Used for advertising and promotional purposes</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                You can control cookie preferences through your browser settings. Note that disabling cookies may affect the functionality of our Service.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                7. Data Retention
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                We retain your personal information for as long as necessary to provide our Service and fulfill the purposes outlined in this Privacy Policy. When information is no longer needed, we securely delete or anonymize it. However, we may retain certain information as required by law or for legitimate business purposes.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                8. Children's Privacy
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                Our Service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information and terminate the child's account.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                9. International Data Transfers
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Your information may be transferred to, stored in, and processed in countries other than your country of residence. These countries may have data protection laws that differ from your country. By using our Service, you consent to such transfers and the processing of your information in these jurisdictions.
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                We implement appropriate safeguards, including standard contractual clauses, to protect your information during international transfers.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                10. Third-Party Links
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                Our Service may contain links to third-party websites and applications. This Privacy Policy applies only to our Service. We are not responsible for the privacy practices of third-party websites. We encourage you to review the privacy policies of any third-party services before providing your information.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                11. GDPR and CCPA Compliance
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                <strong>GDPR Compliance:</strong> If you are a resident of the European Union, you have additional rights under the GDPR. We comply with all GDPR requirements and are committed to protecting your personal data.
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>CCPA Compliance:</strong> If you are a California resident, you have rights under the California Consumer Privacy Act. You have the right to know, delete, and opt-out of the sale of your personal information.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                12. Changes to This Privacy Policy
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of any significant changes by posting the updated Privacy Policy on our website with a new "Last updated" date.
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                Your continued use of our Service following the posting of revised Privacy Policy means that you accept and agree to the changes.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100 mb-4">
                13. Contact Us
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg mb-4">
                <p className="text-slate-900 dark:text-slate-100 font-semibold mb-3">Your Condo Manager Privacy Team</p>
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  <strong>Email:</strong> <a href="mailto:privacy@yourcondomanager.org" className="text-primary hover:underline">privacy@yourcondomanager.org</a>
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
          <a
            href="/privacy-policy"
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
          <button
            onClick={() => {
              localStorage.removeItem("cookie-consent");
              window.location.reload();
            }}
            className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-1 cursor-pointer"
          >
            Cookie Settings
          </button>
        </div>
      </footer>
    </div>
  );
}
