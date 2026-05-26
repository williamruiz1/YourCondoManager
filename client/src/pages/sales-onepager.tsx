// SALES ONE-PAGER — founder-os#1025
// Public web mirror of the printable sales sheet. Same copy as the PDF: both
// surfaces parse docs/sales/onepager.md through @/lib/onepager-content so edits
// never drift. The "Download PDF" button serves the Playwright-rendered
// client/public/sales/onepager.pdf (built via `tsx script/build-onepager-pdf.ts`).
// Brand v1 (v16-05) scoped via `.ycm-marketing` per founder-os#1024.
import { Link } from "wouter";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Download,
  Mail,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { SiteFooter } from "@/components/site-footer";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  parseOnepager,
  type Inline,
  type Section,
} from "@/lib/onepager-content";
// Single source of truth — the same markdown the PDF is rendered from.
import rawOnepager from "../../../docs/sales/onepager.md?raw";

const PDF_HREF = "/sales/onepager.pdf";

const onepager = parseOnepager(rawOnepager);

type SalesOnepagerPageProps = {
  hasWorkspaceAccess?: boolean;
  onStartGoogleSignIn?: () => void;
};

function InlineText({ tokens }: { tokens: Inline[] }) {
  return (
    <>
      {tokens.map((tok, i) =>
        tok.bold ? (
          <strong key={i} className="font-semibold text-ycm-navy">
            {tok.text}
          </strong>
        ) : (
          <span key={i}>{tok.text}</span>
        ),
      )}
    </>
  );
}

function getSection(id: string): Section | undefined {
  return onepager.sections.find((s) => s.id === id);
}

export default function SalesOnepagerPage(_props: SalesOnepagerPageProps) {
  const meta = onepager.meta;
  const problem = getSection("the-problem");
  const solution = getSection("the-solution");
  const pricing = getSection("pricing");
  const why = getSection("why-connecticut-delaware-boards");
  const cta = getSection("let-s-talk");

  useDocumentTitle("Sales One-Pager");

  const mailto = `mailto:${meta.contact_email ?? "contact@yourcondomanager.org"}`;

  return (
    <div className="ycm-marketing min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ycm-navy focus:text-ycm-cool-white focus:rounded focus:font-semibold"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <BrandMark className="h-10 w-10" forceTheme="light" />
            <span className="font-serif text-xl font-semibold italic tracking-tight text-ycm-navy">
              Your Condo Manager
            </span>
          </Link>
          <a
            href={PDF_HREF}
            download
            className="inline-flex items-center gap-2 rounded-md bg-ycm-teal px-4 py-2 text-sm font-semibold text-ycm-navy transition-colors hover:bg-ycm-teal/90"
            data-testid="download-pdf-header"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download PDF
          </a>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* Hero */}
        <section className="bg-gradient-to-br from-ycm-navy to-ycm-sky text-ycm-cool-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:py-16">
            <BrandMark
              className="h-20 w-20 shrink-0 md:h-24 md:w-24"
              forceTheme="dark"
              decorative
            />
            <div className="flex-1">
              {meta.eyebrow && (
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-ycm-teal">
                  {meta.eyebrow}
                </p>
              )}
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                {meta.title ?? "Your Condo Manager"}
              </h1>
              {meta.tagline && (
                <p className="mt-3 max-w-xl text-lg text-[#d7e2f1]">
                  {meta.tagline}
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={PDF_HREF}
                  download
                  className="inline-flex items-center gap-2 rounded-md bg-ycm-teal px-5 py-2.5 text-sm font-semibold text-ycm-navy transition-colors hover:bg-ycm-teal/90"
                  data-testid="download-pdf-hero"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download the one-pager (PDF)
                </a>
                <a
                  href={mailto}
                  className="inline-flex items-center gap-2 rounded-md border border-ycm-cool-white/40 px-5 py-2.5 text-sm font-semibold text-ycm-cool-white transition-colors hover:bg-ycm-cool-white/10"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Talk to us
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-12 px-6 py-12">
          {/* Problem */}
          {problem && (
            <section aria-labelledby="problem-heading">
              <h2
                id="problem-heading"
                className="mb-3 border-b-2 border-ycm-teal pb-2 text-sm font-extrabold uppercase tracking-[0.08em] text-ycm-navy"
              >
                {problem.title}
              </h2>
              {problem.paragraphs.map((p, i) => (
                <p key={i} className="mb-3 max-w-3xl text-slate-600">
                  <InlineText tokens={p} />
                </p>
              ))}
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {problem.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ycm-teal"
                      aria-hidden="true"
                    />
                    <span>
                      {b.lead && (
                        <strong className="font-semibold text-ycm-navy">{b.lead} </strong>
                      )}
                      <InlineText tokens={b.rest} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Solution */}
          {solution && (
            <section aria-labelledby="solution-heading">
              <h2
                id="solution-heading"
                className="mb-3 border-b-2 border-ycm-teal pb-2 text-sm font-extrabold uppercase tracking-[0.08em] text-ycm-navy"
              >
                {solution.title}
              </h2>
              {solution.paragraphs.map((p, i) => (
                <p key={i} className="mb-4 max-w-3xl text-slate-600">
                  <InlineText tokens={p} />
                </p>
              ))}
              <ul className="grid gap-4 sm:grid-cols-2">
                {solution.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="rounded-lg border-l-4 border-ycm-teal bg-ycm-cool-white p-4"
                  >
                    {b.lead && (
                      <p className="flex items-center gap-2 font-semibold text-ycm-navy">
                        <CheckCircle2 className="h-4 w-4 text-ycm-teal" aria-hidden="true" />
                        {b.lead}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-600">
                      <InlineText tokens={b.rest} />
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Pricing + Why (two-up) */}
          <div className="grid gap-8 md:grid-cols-2">
            {pricing && (
              <section
                aria-labelledby="pricing-heading"
                className="rounded-xl bg-ycm-cream p-6"
              >
                <h2
                  id="pricing-heading"
                  className="mb-3 border-b-2 border-ycm-teal pb-2 text-sm font-extrabold uppercase tracking-[0.08em] text-ycm-navy"
                >
                  {pricing.title}
                </h2>
                {pricing.paragraphs.map((p, i) => (
                  <p key={i} className="text-slate-700">
                    <InlineText tokens={p} />
                  </p>
                ))}
              </section>
            )}
            {why && (
              <section aria-labelledby="why-heading">
                <h2
                  id="why-heading"
                  className="mb-3 border-b-2 border-ycm-teal pb-2 text-sm font-extrabold uppercase tracking-[0.08em] text-ycm-navy"
                >
                  {why.title}
                </h2>
                <ul className="space-y-2">
                  {why.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ycm-teal"
                        aria-hidden="true"
                      />
                      <span>
                        {b.lead && (
                          <strong className="font-semibold text-ycm-navy">{b.lead} </strong>
                        )}
                        <InlineText tokens={b.rest} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* CTA */}
          {cta && (
            <section
              aria-labelledby="cta-heading"
              className="flex flex-col items-start justify-between gap-6 rounded-xl bg-ycm-navy p-8 text-ycm-cool-white md:flex-row md:items-center"
            >
              <div className="max-w-xl">
                <h2
                  id="cta-heading"
                  className="mb-2 text-lg font-extrabold text-ycm-cool-white"
                >
                  {cta.title}
                </h2>
                {cta.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm text-[#c8d4e6]">
                    <InlineText tokens={p} />
                  </p>
                ))}
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto">
                <a
                  href={mailto}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-ycm-teal px-5 py-2.5 text-sm font-semibold text-ycm-navy transition-colors hover:bg-ycm-teal/90"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {meta.contact_email ?? "contact@yourcondomanager.org"}
                </a>
                {meta.calendly_url && (
                  <a
                    href={meta.calendly_url}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-ycm-cool-white/40 px-5 py-2.5 text-sm font-semibold text-ycm-cool-white transition-colors hover:bg-ycm-cool-white/10"
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    {meta.calendly_label ?? "Book an intro"}
                  </a>
                )}
                <a
                  href={PDF_HREF}
                  download
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-ycm-teal hover:underline"
                  data-testid="download-pdf-cta"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download as PDF
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
