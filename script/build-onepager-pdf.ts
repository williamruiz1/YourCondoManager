/**
 * Render the YCM sales one-pager to a single-page US-Letter PDF (founder-os#1025).
 *
 *   pnpm tsx script/build-onepager-pdf.ts   (or: npx tsx ...)
 *
 * Source of truth: docs/sales/onepager.md (parsed via the shared parser shared
 * with the web route). Output: client/public/sales/onepager.pdf — served as a
 * static asset behind the `/sales-onepager` page's "Download PDF" button.
 *
 * Uses Playwright's chromium print-to-PDF (already a repo dev dependency). The
 * template is tuned to fit one US-Letter page exactly; the script fails loudly
 * if the rendered content overflows a single page.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  parseOnepager,
  inlineToText,
  type Inline,
  type Onepager,
  type Section,
} from "../client/src/lib/onepager-content.ts";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const MD_PATH = resolve(REPO_ROOT, "docs/sales/onepager.md");
const LOGO_PATH = resolve(REPO_ROOT, "client/public/brand/ycm-logo-mark-light.svg");
const OUT_DIR = resolve(REPO_ROOT, "client/public/sales");
const OUT_PATH = resolve(OUT_DIR, "onepager.pdf");

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineHtml(tokens: Inline[]): string {
  return tokens
    .map((t) => (t.bold ? `<strong>${esc(t.text)}</strong>` : esc(t.text)))
    .join("");
}

function section(o: Onepager, id: string): Section | undefined {
  return o.sections.find((s) => s.id === id);
}

function renderBullets(s: Section | undefined, variant: "feature" | "plain"): string {
  if (!s) return "";
  return s.bullets
    .map((b) => {
      const lead = b.lead ? `<span class="lead">${esc(b.lead)}</span> ` : "";
      const rest = inlineHtml(b.rest);
      const cls = variant === "feature" ? "feature" : "plain";
      return `<li class="${cls}">${lead}${rest}</li>`;
    })
    .join("");
}

function renderParagraphs(s: Section | undefined): string {
  if (!s) return "";
  return s.paragraphs.map((p) => `<p>${inlineHtml(p)}</p>`).join("");
}

function buildHtml(o: Onepager, logoDataUri: string): string {
  const m = o.meta;
  const problem = section(o, "the-problem");
  const solution = section(o, "the-solution");
  const pricing = section(o, "pricing");
  const why = section(o, "why-connecticut-delaware-boards");
  const cta = section(o, "let-s-talk");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  :root {
    --ycm-sky: #5B7DA3;
    --ycm-teal: #2DBDB0;
    --ycm-cream: #F0E5D2;
    --ycm-cool-white: #F6F9FF;
    --ycm-navy: #0B1B3B;
    --ink: #16223d;
    --muted: #4a5874;
  }
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: var(--ink);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 8.5in;
    height: 11in;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Header band */
  .hero {
    background: linear-gradient(135deg, var(--ycm-navy) 0%, var(--ycm-sky) 100%);
    color: var(--ycm-cool-white);
    padding: 0.42in 0.6in 0.4in;
    display: flex;
    align-items: center;
    gap: 0.34in;
  }
  .hero img { width: 0.92in; height: 0.92in; flex: none; }
  .hero .eyebrow {
    font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--ycm-teal); font-weight: 700; margin: 0 0 3px;
  }
  .hero h1 { font-size: 26px; line-height: 1.05; margin: 0; font-weight: 800; letter-spacing: -0.01em; }
  .hero .tagline { font-size: 13px; margin: 6px 0 0; color: #d7e2f1; font-weight: 500; }
  /* Body */
  .body { flex: 1; padding: 0.34in 0.6in 0.2in; display: flex; flex-direction: column; gap: 0.17in; }
  h2 {
    font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--ycm-navy); margin: 0 0 6px; font-weight: 800;
    border-bottom: 2px solid var(--ycm-teal); padding-bottom: 4px;
  }
  p { font-size: 10.5px; line-height: 1.45; margin: 0 0 6px; color: var(--muted); }
  ul { margin: 0; padding: 0; list-style: none; }
  li { font-size: 10px; line-height: 1.4; color: var(--muted); }
  li.plain { position: relative; padding-left: 15px; margin: 0 0 4px; }
  li.plain::before {
    content: ""; position: absolute; left: 2px; top: 5px;
    width: 6px; height: 6px; border-radius: 50%; background: var(--ycm-teal);
  }
  .features { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
  li.feature { padding: 7px 9px; background: var(--ycm-cool-white); border-left: 3px solid var(--ycm-teal); border-radius: 3px; }
  li.feature .lead { color: var(--ycm-navy); font-weight: 700; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.34in; }
  .two-col .pricing-band {
    background: var(--ycm-cream); border-radius: 6px; padding: 10px 12px;
  }
  .two-col h2 { margin-top: 0; }
  .pricing-band p { color: var(--ink); margin-bottom: 0; }
  .pricing-band strong { color: var(--ycm-navy); font-size: 12px; }
  /* CTA footer band */
  .cta {
    margin-top: auto;
    background: var(--ycm-navy); color: var(--ycm-cool-white);
    padding: 0.26in 0.6in; display: flex; align-items: center; justify-content: space-between; gap: 0.3in;
  }
  .cta .cta-copy { max-width: 4.3in; }
  .cta h2 { color: var(--ycm-cool-white); border-color: var(--ycm-teal); margin-bottom: 5px; }
  .cta p { color: #c8d4e6; margin: 0; font-size: 10px; }
  .cta .contacts { text-align: right; font-size: 11px; line-height: 1.7; flex: none; }
  .cta .contacts a { color: var(--ycm-teal); text-decoration: none; font-weight: 600; }
  .cta .contacts .site { color: var(--ycm-cool-white); font-weight: 700; }
</style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <img src="${logoDataUri}" alt="Your Condo Manager" />
      <div>
        <p class="eyebrow">${esc(m.eyebrow ?? "")}</p>
        <h1>${esc(m.title ?? "Your Condo Manager")}</h1>
        <p class="tagline">${esc(m.tagline ?? "")}</p>
      </div>
    </header>
    <main class="body">
      <section>
        <h2>${esc(problem?.title ?? "The problem")}</h2>
        ${renderParagraphs(problem)}
        <ul>${renderBullets(problem, "plain")}</ul>
      </section>
      <section>
        <h2>${esc(solution?.title ?? "The solution")}</h2>
        ${renderParagraphs(solution)}
        <ul class="features">${renderBullets(solution, "feature")}</ul>
      </section>
      <div class="two-col">
        <section class="pricing-band">
          <h2>${esc(pricing?.title ?? "Pricing")}</h2>
          ${renderParagraphs(pricing)}
        </section>
        <section>
          <h2>${esc(why?.title ?? "Why Connecticut & Delaware boards")}</h2>
          <ul>${renderBullets(why, "plain")}</ul>
        </section>
      </div>
    </main>
    <footer class="cta">
      <div class="cta-copy">
        <h2>${esc(cta?.title ?? "Let's talk")}</h2>
        ${renderParagraphs(cta)}
      </div>
      <div class="contacts">
        <div><a href="mailto:${esc(m.contact_email ?? "")}">${esc(m.contact_email ?? "")}</a></div>
        <div><a href="${esc(m.calendly_url ?? "#")}">${esc(m.calendly_label ?? "Book an intro")}</a></div>
        <div class="site">${esc(m.website ?? "")}</div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

async function main(): Promise<void> {
  const raw = readFileSync(MD_PATH, "utf8");
  const onepager = parseOnepager(raw);

  const logoSvg = readFileSync(LOGO_PATH, "utf8");
  const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

  const html = buildHtml(onepager, logoDataUri);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    // Guard: content must fit a single US-Letter page (11in = 1056px @96dpi).
    const overflow = await page.evaluate(() => {
      const el = document.querySelector(".page") as HTMLElement | null;
      return el ? el.scrollHeight - el.clientHeight : 0;
    });
    if (overflow > 2) {
      throw new Error(
        `One-pager content overflows a single page by ${overflow}px. ` +
          `Trim copy in docs/sales/onepager.md or tighten the template.`,
      );
    }

    mkdirSync(OUT_DIR, { recursive: true });
    await page.pdf({
      path: OUT_PATH,
      format: "Letter",
      printBackground: true,
      pageRanges: "1",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await browser.close();
  }

  // Sanity: assert exactly one page in the rendered PDF.
  const bytes = readFileSync(OUT_PATH);
  const pageCount = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  const titleText = inlineToText([{ text: onepager.meta.title ?? "", bold: false }]);
  console.log(
    `[onepager] wrote ${OUT_PATH} (${(bytes.length / 1024).toFixed(1)} KB, ` +
      `${pageCount} page${pageCount === 1 ? "" : "s"}) — "${titleText}"`,
  );
  if (pageCount !== 1) {
    throw new Error(`Expected a 1-page PDF but rendered ${pageCount} pages.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
