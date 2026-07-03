// Policy markdown → on-brand HTML renderer.
//
// Background (#1783 follow-on): the public policy routes (/privacy, /security)
// serve canonical markdown from docs/policies/*.md. The original handlers sent
// the markdown verbatim as `text/plain`, which is correct for auditors and
// partner-questionnaire tooling that consume markdown directly — but a human
// opening yourcondomanager.org/privacy in a browser saw RAW markdown (literal
// `#`, `**bold**`, `|table pipes|`). This module is the "Phase 1 follow-on"
// the original code comment anticipated: it renders the same canonical markdown
// into a polished, on-brand, readable HTML page for browsers, while machine
// clients keep getting raw markdown via content negotiation (see wantsHtml()).
//
// We render on the SERVER (these are plain Express routes, not React routes),
// so we use `marked` (zero-dependency, GFM tables) rather than a React markdown
// component. The markdown files are the single source of truth for the legal
// content — we do not duplicate the policy text here.

import { marked } from "marked";
import type { Request } from "express";

// On-brand styling per the YCM brand v2 system (client/src/index.css):
//   Deep Teal  #014D4A  — primary / headings / links
//   Teal Accent #15A39C / #2DBDB0 — accents, rules, table header
//   Type: 'Inter Tight' / 'Inter' (brand-identity-spec §4)
// Self-contained <style> (no Tailwind on this server-rendered route); fonts
// loaded from Google Fonts with a system fallback so the page is readable even
// if the font CDN is blocked.
const BRAND = {
  primary: "#014D4A",
  accent: "#15A39C",
  accentLight: "#2DBDB0",
  ink: "#0F2E2C",
  body: "#334155", // slate-700
  muted: "#64748b", // slate-500
  border: "#e2e8f0", // slate-200
  surface: "#f8fafc", // slate-50
  tableHeadBg: "#014D4A",
};

// Configure marked once: GitHub-flavored markdown (tables, etc.), with line
// breaks treated as in standard markdown (gfm default).
marked.setOptions({ gfm: true, breaks: false });

/**
 * Decide whether to render HTML (browser) or serve raw markdown (machine).
 *
 * Raw markdown is the DEFAULT (preserves the auditor / partner-questionnaire /
 * curl use-case from #1783). We render HTML only when the client EXPLICITLY
 * prefers it:
 *   • ?format=html, OR
 *   • the Accept header actually lists `text/html` (what every browser sends).
 *
 * Important: we intentionally do NOT use req.accepts(["html","text"]) here —
 * for a bare `Accept: *\/*` (curl) or a missing Accept header, Express's
 * negotiation returns the FIRST listed type ("html"), which would wrongly hand
 * raw-markdown consumers an HTML page. Requiring an explicit `text/html` token
 * keeps machine clients on raw markdown and only browsers on the rendered page.
 *
 * `?format=md` / `?format=markdown` / `?raw` always force raw markdown.
 */
export function wantsHtml(req: Request): boolean {
  const fmt = String(req.query.format ?? "").toLowerCase();
  if (fmt === "md" || fmt === "markdown" || req.query.raw !== undefined) return false;
  if (fmt === "html") return true;
  const accept = String(req.headers.accept ?? "").toLowerCase();
  return accept.includes("text/html");
}

const styles = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    font-family: 'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: ${BRAND.body};
    background: #ffffff;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  .site-header {
    border-bottom: 1px solid ${BRAND.border};
    background: #ffffff;
  }
  .site-header .inner {
    max-width: 880px; margin: 0 auto; padding: 18px 24px;
    display: flex; align-items: center; gap: 12px;
  }
  .site-header img { height: 36px; width: auto; display: block; }
  .site-header .wordmark {
    font-weight: 700; font-size: 20px; letter-spacing: -0.01em; color: ${BRAND.primary};
  }
  main { max-width: 880px; margin: 0 auto; padding: 56px 24px 96px; }
  .doc h1 {
    font-size: clamp(2rem, 4vw, 2.75rem); line-height: 1.1; font-weight: 800;
    letter-spacing: -0.02em; color: ${BRAND.primary}; margin: 0 0 8px;
  }
  .doc h2 {
    font-size: 1.5rem; font-weight: 700; color: ${BRAND.ink};
    margin: 48px 0 14px; padding-bottom: 8px; border-bottom: 2px solid ${BRAND.accentLight};
    letter-spacing: -0.01em;
  }
  .doc h3 { font-size: 1.15rem; font-weight: 700; color: ${BRAND.ink}; margin: 28px 0 10px; }
  .doc h4 { font-size: 1rem; font-weight: 700; color: ${BRAND.ink}; margin: 22px 0 8px; }
  .doc p { margin: 0 0 16px; }
  .doc a { color: ${BRAND.accent}; text-decoration: underline; text-underline-offset: 2px; }
  .doc a:hover { color: ${BRAND.primary}; }
  .doc strong { color: ${BRAND.ink}; font-weight: 700; }
  .doc ul, .doc ol { margin: 0 0 16px; padding-left: 1.4em; }
  .doc li { margin: 6px 0; }
  .doc hr { border: 0; border-top: 1px solid ${BRAND.border}; margin: 40px 0; }
  .doc blockquote {
    margin: 0 0 16px; padding: 4px 18px; border-left: 4px solid ${BRAND.accentLight};
    color: ${BRAND.muted}; background: ${BRAND.surface};
  }
  .doc code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em;
    background: ${BRAND.surface}; padding: 1px 5px; border-radius: 4px;
  }
  .doc pre { background: ${BRAND.surface}; padding: 16px; border-radius: 8px; overflow-x: auto; }
  .doc pre code { background: none; padding: 0; }
  /* Tables — the privacy policy has a GFM role table that must render as a real table. */
  .doc table {
    width: 100%; border-collapse: collapse; margin: 0 0 24px; font-size: 0.95rem;
    border: 1px solid ${BRAND.border}; border-radius: 8px; overflow: hidden;
  }
  .doc thead th {
    background: ${BRAND.tableHeadBg}; color: #ffffff; text-align: left;
    padding: 12px 14px; font-weight: 600;
  }
  .doc tbody td { padding: 11px 14px; border-top: 1px solid ${BRAND.border}; vertical-align: top; }
  .doc tbody tr:nth-child(even) { background: ${BRAND.surface}; }
  .doc table code { background: rgba(21,163,156,0.10); }
  footer.site-footer {
    border-top: 1px solid ${BRAND.border}; background: ${BRAND.surface};
    color: ${BRAND.muted}; font-size: 0.8rem;
  }
  footer.site-footer .inner {
    max-width: 880px; margin: 0 auto; padding: 28px 24px; display: flex;
    flex-wrap: wrap; gap: 18px; align-items: center; justify-content: space-between;
  }
  footer.site-footer a { color: ${BRAND.muted}; text-decoration: none; }
  footer.site-footer a:hover { color: ${BRAND.primary}; }
  @media (max-width: 600px) {
    main { padding: 36px 18px 72px; }
    .doc table { font-size: 0.85rem; }
    .doc thead th, .doc tbody td { padding: 9px 10px; }
  }
`;

/**
 * Render policy markdown into a complete, on-brand HTML document.
 * `title` is used for <title> and the document <h1> falls out of the markdown.
 */
export function renderPolicyHtml(markdown: string, title: string): string {
  const bodyHtml = marked.parse(markdown) as string;
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Your Condo Manager</title>
  <meta name="description" content="${escapeHtml(title)} for Your Condo Manager (YCM)." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${styles}</style>
</head>
<body>
  <header class="site-header">
    <div class="inner">
      <a href="/" style="display:flex;align-items:center;gap:12px;text-decoration:none;">
        <img src="/brand/ycm-logo-canonical.png" alt="Your Condo Manager" onerror="this.style.display='none'" />
        <span class="wordmark">Your Condo Manager</span>
      </a>
    </div>
  </header>
  <main>
    <article class="doc">
${bodyHtml}
    </article>
  </main>
  <footer class="site-footer">
    <div class="inner">
      <span>© ${year} Your Condo Manager</span>
      <nav>
        <a href="/privacy">Privacy</a>
        &nbsp;·&nbsp;
        <a href="/terms">Terms</a>
        &nbsp;·&nbsp;
        <a href="/security">Security</a>
      </nav>
    </div>
  </footer>
</body>
</html>`;
}

// Minimal HTML escape for the <title>/<meta> attributes (the policy body is
// trusted first-party markdown rendered by marked, not user input).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
