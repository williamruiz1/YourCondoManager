/**
 * Shared parser for the YCM sales one-pager (founder-os#1025).
 *
 * `docs/sales/onepager.md` is the single editable canonical source. BOTH the
 * web route (`client/src/pages/sales-onepager.tsx`) and the PDF build script
 * (`script/build-onepager-pdf.ts`) parse it through this module so copy edits
 * never drift between the two surfaces. Pure — no DOM, no `@/` imports — so the
 * Node build script can import it directly via tsx.
 */

export type Inline = { text: string; bold: boolean };
export type Bullet = {
  /** Leading bold label when the bullet is `**Label** — rest`; else null. */
  lead: string | null;
  /** Remaining inline tokens after the lead label (or the whole bullet). */
  rest: Inline[];
};
export type Section = {
  /** Slug of the heading, e.g. "the-problem". */
  id: string;
  title: string;
  paragraphs: Inline[][];
  bullets: Bullet[];
};
export type Onepager = {
  meta: Record<string, string>;
  sections: Section[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Split a line of text into bold / plain inline segments on `**...**`. */
export function parseInline(text: string): Inline[] {
  const tokens: Inline[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ text: text.slice(last, m.index), bold: false });
    }
    tokens.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    tokens.push({ text: text.slice(last), bold: false });
  }
  return tokens.length > 0 ? tokens : [{ text, bold: false }];
}

function parseBullet(raw: string): Bullet {
  // `**Label** — rest` or `**Label**: rest` → split out the lead label.
  const lead = raw.match(/^\*\*([^*]+)\*\*\s*(?:—|–|-|:)\s*(.*)$/);
  if (lead) {
    return { lead: lead[1].trim(), rest: parseInline(lead[2].trim()) };
  }
  return { lead: null, rest: parseInline(raw.trim()) };
}

/** Plain-text rendering of inline tokens (for PDF accessibility / fallbacks). */
export function inlineToText(tokens: Inline[]): string {
  return tokens.map((t) => t.text).join("");
}

export function parseOnepager(raw: string): Onepager {
  const normalized = raw.replace(/\r\n/g, "\n");

  // Frontmatter: leading `---` ... `---` block of `key: value` lines.
  const meta: Record<string, string> = {};
  let body = normalized;
  const fm = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) meta[key] = value;
    }
    body = normalized.slice(fm[0].length);
  }

  const sections: Section[] = [];
  let current: Section | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (current && paragraphBuffer.length > 0) {
      current.paragraphs.push(parseInline(paragraphBuffer.join(" ").trim()));
    }
    paragraphBuffer = [];
  };

  for (const line of body.split("\n")) {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      flushParagraph();
      if (current) sections.push(current);
      const title = heading[1].trim();
      current = { id: slugify(title), title, paragraphs: [], bullets: [] };
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (current) current.bullets.push(parseBullet(bullet[1]));
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    paragraphBuffer.push(line.trim());
  }
  flushParagraph();
  if (current) sections.push(current);

  return { meta, sections };
}
