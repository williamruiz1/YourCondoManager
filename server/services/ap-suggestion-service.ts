/**
 * AP / vendor-invoice suggestion service — read an inbound vendor invoice,
 * SUGGEST a vendor match + GL coding (with a confidence band), and file the
 * suggestion as an L3 (financial) action so a human ALWAYS approves before any
 * coding actuates (founder-os#9477, W2 — anchors the track record that gates W4
 * full-autonomous AP).
 *
 * Design (mirrors the W1 agent-action-service split): the SUGGESTION LOGIC is a
 * set of PURE, exported functions over candidate lists (vendors, GL accounts,
 * per-vendor history) — deterministic and DB-free, so the whole match→code→
 * confidence path is unit-tested with no database. The DB-composing entrypoint
 * (`suggestAndQueueApInvoice`) loads the candidates for the association, runs the
 * pure engine, and files the result through the W1 permission gate as
 * `financial.ap_invoice_coding` (L3). It NEVER posts a ledger entry itself — it
 * only queues the coding SUGGESTION; actuation is a separate human-approved step.
 *
 * Nothing here auto-executes: the returned action is `queued` at L3, and W1's
 * `evaluateGate` refuses to execute an L3 action without a recorded human
 * approval. That mandatory human gate is the whole point (research #833 [472]
 * §5.2, §1.4 — financial → mandatory human gate).
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  vendors as vendorsTable,
  glAccounts as glAccountsTable,
  glEntries as glEntriesTable,
  type AgentAction,
} from "@shared/schema";
import { fileAction, AgentActionError } from "./agent-action-service";

// The L3 action-type the coding suggestion files under. Kept in sync with the
// server-authoritative ladder in agent-action-service.ts (which maps it to L3).
export const AP_INVOICE_CODING_ACTION_TYPE = "financial.ap_invoice_coding";

/** A confidence band label, derived from a numeric 0..1 score. */
export type ConfidenceBand = "high" | "medium" | "low";

/** Band thresholds — a single source of truth for how a score reads to a human. */
export const CONFIDENCE_THRESHOLDS = { high: 0.85, medium: 0.6 } as const;

/** Map a 0..1 score to a human-readable band. */
export function confidenceBand(score: number): ConfidenceBand {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (s >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

// ── Vendor-name matching (pure) ──────────────────────────────────────────────

/**
 * Normalize a vendor name for comparison: lowercase, strip common company
 * suffixes / punctuation, collapse whitespace. "ABC Plumbing, Inc." → "abc
 * plumbing". Keeps matching robust to legal-suffix noise on invoices.
 */
export function normalizeVendorName(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\b(inc|incorporated|llc|l\.?l\.?c|ltd|co|corp|corporation|company|the|and|&)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Character-bigram set for Sørensen–Dice similarity. */
function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const clean = s.replace(/\s+/g, "");
  for (let i = 0; i < clean.length - 1; i++) {
    const g = clean.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/**
 * Sørensen–Dice similarity of two normalized strings, in [0,1]. Deterministic,
 * symmetric, order-insensitive at the bigram level — a good fit for short vendor
 * names where token order can differ ("Elm Landscaping" vs "Landscaping by Elm").
 */
export function vendorNameSimilarity(a: string, b: string): number {
  const na = normalizeVendorName(a);
  const nb = normalizeVendorName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Whole-token containment boost: one name fully contains the other's tokens.
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  const tokenOverlap = shared / Math.max(ta.size, tb.size);
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let inter = 0;
  let sizeA = 0;
  let sizeB = 0;
  for (const v of ba.values()) sizeA += v;
  for (const v of bb.values()) sizeB += v;
  for (const [g, ca] of ba) {
    const cb = bb.get(g);
    if (cb) inter += Math.min(ca, cb);
  }
  const dice = sizeA + sizeB === 0 ? 0 : (2 * inter) / (sizeA + sizeB);
  // Blend the bigram similarity with token overlap so both spelling-close and
  // reordered-token matches score well; cap at 1.
  return Math.min(1, Math.max(dice, 0.5 * dice + 0.5 * tokenOverlap));
}

export interface VendorCandidate {
  id: string;
  name: string;
  trade?: string | null;
}

export interface VendorMatch {
  vendorId: string;
  vendorName: string;
  trade: string | null;
  score: number;
}

/**
 * Suggest the best vendor match for a raw invoice vendor name. Returns the
 * top-scoring candidate (or null if none clears a floor). Deterministic: ties
 * broken by candidate order (stable).
 */
export function suggestVendorMatch(
  rawVendorName: string,
  candidates: VendorCandidate[],
  floor = 0.34,
): VendorMatch | null {
  let best: VendorMatch | null = null;
  for (const c of candidates) {
    const score = vendorNameSimilarity(rawVendorName, c.name);
    if (score > (best?.score ?? -1)) {
      best = { vendorId: c.id, vendorName: c.name, trade: c.trade ?? null, score };
    }
  }
  if (!best || best.score < floor) return null;
  return best;
}

// ── GL-code suggestion (pure) ────────────────────────────────────────────────

export interface GlAccountCandidate {
  id: string;
  accountCode: string;
  name: string;
  accountType: string; // "expense" | ...
}

/** One prior posting fact: how many times this vendor coded to this GL account. */
export interface VendorGlHistoryEntry {
  glAccountId: string;
  count: number;
}

export interface GlSuggestion {
  glAccountId: string;
  accountCode: string;
  name: string;
  score: number;
  basis: "vendor-history" | "trade-keyword" | "fallback";
}

// Trade → keyword hints mapping a vendor's trade to words likely in an expense
// GL account name. Additive + conservative; unknown trades fall through to the
// invoice memo keywords / fallback.
const TRADE_KEYWORDS: Record<string, string[]> = {
  plumbing: ["repair", "maintenance", "plumb"],
  electrical: ["repair", "maintenance", "electric", "utilit"],
  landscaping: ["landscap", "grounds", "lawn", "maintenance"],
  hvac: ["hvac", "repair", "maintenance", "heat", "cooling"],
  cleaning: ["clean", "janitor", "maintenance"],
  roofing: ["roof", "repair", "maintenance"],
  pest: ["pest", "maintenance"],
  security: ["security", "maintenance"],
  legal: ["legal", "professional"],
  accounting: ["account", "professional", "audit"],
  insurance: ["insurance"],
  utility: ["utilit", "water", "electric", "gas", "sewer"],
  general: ["repair", "maintenance", "general"],
};

function tokensOf(s: string): string[] {
  return (s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Suggest a GL account for the invoice. Priority of signals:
 *   1. vendor-history  — the GL account this vendor was MOST OFTEN coded to
 *                        before (the strongest signal; scales with sample size).
 *   2. trade-keyword   — the matched vendor's trade + the invoice memo keywords
 *                        vs. expense-account names.
 *   3. fallback        — a designated "uncategorized"/first expense account, at
 *                        the lowest confidence, so a suggestion always exists to
 *                        put in front of a human (who then approves or recodes).
 * Only EXPENSE accounts are ever suggested for an AP invoice.
 */
export function suggestGlCode(params: {
  memo?: string | null;
  vendorTrade?: string | null;
  glAccounts: GlAccountCandidate[];
  vendorHistory?: VendorGlHistoryEntry[];
}): GlSuggestion | null {
  const expense = params.glAccounts.filter((g) => g.accountType === "expense");
  if (expense.length === 0) return null;
  const byId = new Map(expense.map((g) => [g.id, g]));

  // 1. Vendor history — pick the most-used expense account for this vendor.
  const hist = (params.vendorHistory ?? []).filter((h) => byId.has(h.glAccountId) && h.count > 0);
  if (hist.length > 0) {
    const top = hist.reduce((a, b) => (b.count > a.count ? b : a));
    const total = hist.reduce((s, h) => s + h.count, 0);
    const acct = byId.get(top.glAccountId)!;
    // Share of this vendor's prior codings going to the top account, damped by a
    // small-sample penalty so "1 of 1" doesn't read as certainty.
    const share = top.count / total;
    const sampleConf = 1 - 1 / (1 + top.count); // 1→0.5, 2→0.67, 4→0.8, 9→0.9
    // share AND sample gate each other multiplicatively: 100% share on ONE prior
    // invoice cannot read "high" (0.5 sample cap); consistent share over many
    // invoices does. Keeps a single data point out of the high band.
    const score = Math.min(0.98, 0.55 + 0.43 * share * sampleConf);
    return {
      glAccountId: acct.id,
      accountCode: acct.accountCode,
      name: acct.name,
      score,
      basis: "vendor-history",
    };
  }

  // 2. Trade + memo keyword match against expense-account names.
  const kw = new Set<string>();
  const trade = (params.vendorTrade ?? "").toLowerCase().trim();
  for (const w of TRADE_KEYWORDS[trade] ?? []) kw.add(w);
  for (const w of tokensOf(params.memo ?? "")) if (w.length >= 4) kw.add(w);
  if (kw.size > 0) {
    let best: { acct: GlAccountCandidate; hits: number } | null = null;
    for (const acct of expense) {
      const name = acct.name.toLowerCase();
      let hits = 0;
      for (const w of kw) if (name.includes(w)) hits++;
      if (hits > 0 && hits > (best?.hits ?? 0)) best = { acct, hits };
    }
    if (best) {
      // Keyword matches are advisory — capped in the medium band so a human still
      // reviews. More hits → a bit more confidence, never "high".
      const score = Math.min(0.8, 0.55 + 0.08 * best.hits);
      return {
        glAccountId: best.acct.id,
        accountCode: best.acct.accountCode,
        name: best.acct.name,
        score,
        basis: "trade-keyword",
      };
    }
  }

  // 3. Fallback — a designated uncategorized expense account (by name) or the
  // first expense account. Lowest confidence: a suggestion always exists to
  // surface, but it reads as "please confirm".
  const uncategorized =
    expense.find((g) => /uncategor|unclassif|suspense|misc/i.test(g.name)) ?? expense[0];
  return {
    glAccountId: uncategorized.id,
    accountCode: uncategorized.accountCode,
    name: uncategorized.name,
    score: 0.3,
    basis: "fallback",
  };
}

// ── Compose the full suggestion (pure) ───────────────────────────────────────

export interface ApInvoiceInput {
  /** The vendor name as it appears on the invoice. */
  vendorName: string;
  /** Invoice total in dollars (surfaced for the human; not used in matching). */
  amount: number;
  invoiceNumber?: string | null;
  /** Free-text line/memo used as a GL keyword signal. */
  memo?: string | null;
}

export interface ApSuggestion {
  vendorMatch: VendorMatch | null;
  glSuggestion: GlSuggestion | null;
  confidence: {
    vendor: number;
    gl: number;
    overall: number;
    band: ConfidenceBand;
  };
  reasoning: string;
  input: ApInvoiceInput;
}

function money(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number): string {
  return `${Math.round((Number.isFinite(n) ? n : 0) * 100)}%`;
}

/**
 * Build the full AP suggestion (vendor + GL + confidence + human reasoning) from
 * the invoice and the association's candidate lists. Pure and deterministic.
 * Overall confidence is the product of the vendor and GL confidences — a weak
 * link in EITHER pulls the whole suggestion down, which is the safe direction
 * (it surfaces "please look closely" rather than false certainty).
 */
export function buildApSuggestion(params: {
  input: ApInvoiceInput;
  vendors: VendorCandidate[];
  glAccounts: GlAccountCandidate[];
  vendorHistoryByVendorId?: Record<string, VendorGlHistoryEntry[]>;
}): ApSuggestion {
  const { input } = params;
  const vendorMatch = suggestVendorMatch(input.vendorName, params.vendors);
  const vendorHistory = vendorMatch
    ? params.vendorHistoryByVendorId?.[vendorMatch.vendorId]
    : undefined;
  const glSuggestion = suggestGlCode({
    memo: input.memo,
    vendorTrade: vendorMatch?.trade ?? null,
    glAccounts: params.glAccounts,
    vendorHistory,
  });

  const vendorConf = vendorMatch?.score ?? 0;
  const glConf = glSuggestion?.score ?? 0;
  const overall = vendorConf * glConf;
  const band = confidenceBand(overall);

  // ── Human-readable "why" (acceptance criterion 4). Every clause names the
  // signal it came from so a treasurer can sanity-check the suggestion. ──
  const parts: string[] = [];
  parts.push(
    `Invoice ${input.invoiceNumber ? `#${input.invoiceNumber} ` : ""}from "${input.vendorName}" for ${money(input.amount)}.`,
  );
  if (vendorMatch) {
    parts.push(
      `Vendor → "${vendorMatch.vendorName}"${vendorMatch.trade ? ` (${vendorMatch.trade})` : ""} — ${pct(vendorMatch.score)} name match.`,
    );
  } else {
    parts.push(`No existing vendor matched the name — a human should confirm or create the vendor.`);
  }
  if (glSuggestion) {
    const basisText =
      glSuggestion.basis === "vendor-history"
        ? "this vendor's prior invoices were coded there"
        : glSuggestion.basis === "trade-keyword"
          ? "the vendor trade / invoice memo matched this account"
          : "no strong signal — defaulted to an uncategorized account, please confirm";
    parts.push(
      `GL → ${glSuggestion.accountCode} "${glSuggestion.name}" (${pct(glSuggestion.score)}) because ${basisText}.`,
    );
  } else {
    parts.push(`No expense GL account available to suggest — set up the chart of accounts first.`);
  }
  parts.push(
    `Overall confidence ${band.toUpperCase()} (${pct(overall)}). Filed at L3 — a human must approve before this coding posts.`,
  );

  return {
    vendorMatch,
    glSuggestion,
    confidence: { vendor: vendorConf, gl: glConf, overall, band },
    reasoning: parts.join(" "),
    input,
  };
}

// ── DB-composing entrypoint ──────────────────────────────────────────────────

export interface SuggestAndQueueInput extends ApInvoiceInput {
  associationId: string;
  createdByAgent?: string;
}

/**
 * Deps seam so the DB flow is testable without a live database (mirrors the
 * pattern of loading candidates then delegating to the pure engine). In
 * production these default to the real Drizzle queries below.
 */
export interface ApSuggestionDeps {
  loadVendors: (associationId: string) => Promise<VendorCandidate[]>;
  loadExpenseGlAccounts: (associationId: string) => Promise<GlAccountCandidate[]>;
  loadVendorGlHistory: (associationId: string, vendorId: string) => Promise<VendorGlHistoryEntry[]>;
  file: typeof fileAction;
}

export const defaultApSuggestionDeps: ApSuggestionDeps = {
  async loadVendors(associationId) {
    const rows = await db
      .select({ id: vendorsTable.id, name: vendorsTable.name, trade: vendorsTable.trade })
      .from(vendorsTable)
      .where(eq(vendorsTable.associationId, associationId));
    return rows;
  },
  async loadExpenseGlAccounts(associationId) {
    const rows = await db
      .select({
        id: glAccountsTable.id,
        accountCode: glAccountsTable.accountCode,
        name: glAccountsTable.name,
        accountType: glAccountsTable.accountType,
      })
      .from(glAccountsTable)
      .where(and(eq(glAccountsTable.associationId, associationId), eq(glAccountsTable.accountType, "expense")));
    return rows;
  },
  async loadVendorGlHistory(associationId, vendorId) {
    // How this vendor's prior invoices were coded: count posted GL legs whose
    // source is a vendor_invoice for this vendor, grouped by account. The invoice
    // id is the gl leg's sourceId, so we join through vendor_invoices.
    const rows = await db
      .select({
        glAccountId: glEntriesTable.glAccountId,
        count: sql<number>`count(*)::int`,
      })
      .from(glEntriesTable)
      .where(
        and(
          eq(glEntriesTable.associationId, associationId),
          eq(glEntriesTable.sourceType, "vendor_invoice"),
          eq(glEntriesTable.side, "debit"),
          sql`${glEntriesTable.sourceId} IN (SELECT id FROM vendor_invoices WHERE association_id = ${associationId} AND vendor_id = ${vendorId})`,
        ),
      )
      .groupBy(glEntriesTable.glAccountId);
    return rows.map((r) => ({ glAccountId: r.glAccountId, count: Number(r.count) }));
  },
  file: fileAction,
};

/**
 * Ingest an inbound invoice → build the suggestion → file it as an L3 action on
 * the chief-of-staff queue. Returns the queued action (status "queued", level
 * "L3"). NOTHING posts here — actuation requires a human approve+execute through
 * the W1 gate. The suggestion (incl. the confidence band) rides in `payload`;
 * the human-readable "why" is the action's `reasoning`.
 */
export async function suggestAndQueueApInvoice(
  input: SuggestAndQueueInput,
  deps: ApSuggestionDeps = defaultApSuggestionDeps,
): Promise<{ action: AgentAction; suggestion: ApSuggestion }> {
  if (!input.associationId) throw new AgentActionError("associationId required", "VALIDATION");
  if (!input.vendorName || !input.vendorName.trim()) {
    throw new AgentActionError("vendorName required", "VALIDATION");
  }

  const [vendors, glAccounts] = await Promise.all([
    deps.loadVendors(input.associationId),
    deps.loadExpenseGlAccounts(input.associationId),
  ]);

  // Load history only for the matched vendor (cheap + targeted).
  const preMatch = suggestVendorMatch(input.vendorName, vendors);
  const vendorHistoryByVendorId: Record<string, VendorGlHistoryEntry[]> = {};
  if (preMatch) {
    vendorHistoryByVendorId[preMatch.vendorId] = await deps.loadVendorGlHistory(
      input.associationId,
      preMatch.vendorId,
    );
  }

  const suggestion = buildApSuggestion({
    input: {
      vendorName: input.vendorName,
      amount: input.amount,
      invoiceNumber: input.invoiceNumber ?? null,
      memo: input.memo ?? null,
    },
    vendors,
    glAccounts,
    vendorHistoryByVendorId,
  });

  // Lower confidence → higher severity (a human should look sooner at the weak
  // suggestions, not the strong ones).
  const severity =
    suggestion.confidence.band === "low" ? "high" : suggestion.confidence.band === "medium" ? "medium" : "low";

  const action = await deps.file({
    associationId: input.associationId,
    actionType: AP_INVOICE_CODING_ACTION_TYPE, // → L3, server-authoritative
    reasoning: suggestion.reasoning,
    createdByAgent: input.createdByAgent ?? "ap-invoice-suggester",
    targetEntityType: "vendor_invoice",
    targetEntityId: input.invoiceNumber ?? null,
    payload: {
      kind: "ap_invoice_coding_suggestion",
      invoice: suggestion.input,
      vendorMatch: suggestion.vendorMatch,
      glSuggestion: suggestion.glSuggestion,
      confidence: suggestion.confidence, // the band renders here (criterion 3)
    },
    severity,
  });

  return { action, suggestion };
}
