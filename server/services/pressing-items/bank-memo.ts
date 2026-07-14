/**
 * Bank-memo humanizer (YCM pressing-items plain-English fix, 2026-07-14).
 *
 * Raw bank-feed transaction descriptors — especially ACH transfers — arrive
 * as a dense addenda-record dump, e.g.:
 *
 *   "ORIG CO NAME:ASCEND X ORIG ID:1060377390 DESC DATE: CO ENTRY
 *    DESCR:TRANSFER SEC:WEB TRACE#:211170202748729 EED:260519
 *    IND ID:LUZ MIRANDA IND NAME:Luz Miranda TRN: 1392748729TC"
 *
 * That string was previously used VERBATIM as the pressing-item title
 * ("this all means nothing" — William, 2026-07-14 screenshot feedback).
 * This module extracts the one thing a treasurer actually needs — WHO the
 * counterparty is — and builds a plain-English title. The raw string is
 * never discarded; callers should keep it (`pressingItems.rawDetail`) for
 * an auditor who wants to see exactly what the bank sent.
 */

// Known ACH/NACHA addenda-record field tags, longest-first so a compound tag
// (e.g. "TRANSFER TRN") is matched before its shorter substring ("TRN").
const ACH_FIELD_TAGS = [
  "ORIG CO NAME",
  "CO ENTRY DESCR",
  "TRANSFER TRN",
  "ORIG ID",
  "DESC DATE",
  "IND NAME",
  "IND ID",
  "TRACE#",
  "SEC",
  "EED",
  "TRN",
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TAG_PATTERN = ACH_FIELD_TAGS
  .slice()
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join("|");
const TAG_RE = new RegExp(`(${TAG_PATTERN}):\\s*`, "g");

/** True when the raw memo carries at least 2 recognized ACH addenda tags. */
export function isAchStyleMemo(raw: string): boolean {
  const hits = new Set<string>();
  for (const m of raw.matchAll(TAG_RE)) hits.add(m[1]);
  return hits.size >= 2;
}

/**
 * Splits a raw ACH-style memo into its tagged fields. Each field's value
 * runs from just after its own `TAG:` to the start of the next recognized
 * tag (or end of string) — robust to tags appearing in any order.
 */
export function parseAchFields(raw: string): Record<string, string> {
  const matches = [...raw.matchAll(TAG_RE)];
  const fields: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const tag = matches[i][1];
    const valueStart = (matches[i].index ?? 0) + matches[i][0].length;
    const valueEnd = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    const value = raw.slice(valueStart, valueEnd).trim();
    if (value) fields[tag] = value;
  }
  return fields;
}

function titleCaseName(s: string): string {
  // ACH addenda names are frequently ALL CAPS ("LUZ MIRANDA"). Title-case
  // for display; leave already-mixed-case values (a real merchant name)
  // untouched so we don't mangle e.g. "McDonald's".
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Extracts the best available counterparty display name from a raw bank
 * memo. Preference order: the individual's name (the actual human on an
 * incoming/outgoing ACH), then the originating company, then the generic
 * entry description, then a Plaid-style merchant name, then the raw string
 * itself (cleaned up) as a last resort.
 */
export function extractCounterparty(raw: string, merchantName: string | null): string {
  if (isAchStyleMemo(raw)) {
    const fields = parseAchFields(raw);
    const candidate = fields["IND NAME"] || fields["ORIG CO NAME"] || fields["CO ENTRY DESCR"];
    if (candidate) return titleCaseName(candidate);
  }

  if (merchantName && merchantName.trim()) return merchantName.trim();

  // Non-ACH fallback: strip common processor/network prefixes and trailing
  // reference-number noise, then title-case if it reads as all-caps.
  const cleaned = raw
    .replace(/^(ACH|POS|DEBIT|CREDIT|CHECK|ZELLE|VENMO|PAYPAL)\s+(FROM|TO|PMT|PAYMENT|TRANSFER|PURCHASE)?\s*/i, "")
    .replace(/\s*(DES|ID|TRACE|CONF|REF)[:#]\s*\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return titleCaseName(cleaned || raw.trim());
}

function formatShortDate(isoDate: string): string {
  // isoDate is YYYY-MM-DD (drizzle `date` column). Avoid timezone shift by
  // parsing components directly rather than `new Date(isoDate)`.
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface HumanizeTxnTitleInput {
  amountCents: number;
  date: string;
  name: string;
  merchantName: string | null;
}

/**
 * Builds a plain-English pressing-item title for an unmatched bank
 * transaction. Per this codebase's Plaid-normalized sign convention
 * (see auto-matcher.ts `isCredit`): amountCents < 0 = credit (money IN),
 * amountCents > 0 = debit (money OUT).
 */
export function humanizeUnidentifiedTxnTitle(tx: HumanizeTxnTitleInput): string {
  const counterparty = extractCounterparty(tx.name, tx.merchantName);
  const dollarAmount = (Math.abs(tx.amountCents) / 100).toFixed(2);
  const dateLabel = formatShortDate(tx.date);
  const isIncoming = tx.amountCents < 0;

  const action = isIncoming ? `Incoming transfer from ${counterparty}` : `Payment to ${counterparty}`;
  return `${action} — $${dollarAmount} (${dateLabel}) — needs matching`;
}
