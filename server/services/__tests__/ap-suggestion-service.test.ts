/**
 * AP-suggestion engine unit tests (founder-os#9477, W2).
 *
 * The suggestion logic is pure + exported, so the whole match→code→confidence
 * path is proven deterministically with no DB:
 *   - vendor name matching is robust to legal suffixes + token reorder;
 *   - GL coding prefers vendor history, then trade/memo keywords, then a
 *     lowest-confidence fallback (a suggestion ALWAYS exists to surface);
 *   - the confidence band derives from the score at the documented thresholds;
 *   - the human "reasoning" names why the vendor + GL code were chosen
 *     (acceptance criterion 4).
 */
import { describe, expect, it } from "vitest";
import {
  normalizeVendorName,
  vendorNameSimilarity,
  suggestVendorMatch,
  suggestGlCode,
  confidenceBand,
  buildApSuggestion,
  CONFIDENCE_THRESHOLDS,
  AP_INVOICE_CODING_ACTION_TYPE,
  type VendorCandidate,
  type GlAccountCandidate,
} from "../ap-suggestion-service";
import { levelForActionType } from "../agent-action-service";

const VENDORS: VendorCandidate[] = [
  { id: "v-plumb", name: "ABC Plumbing, Inc.", trade: "plumbing" },
  { id: "v-land", name: "Elm Landscaping LLC", trade: "landscaping" },
  { id: "v-elec", name: "Bright Spark Electric", trade: "electrical" },
];

const GL: GlAccountCandidate[] = [
  { id: "gl-rm", accountCode: "5200", name: "Repairs & Maintenance", accountType: "expense" },
  { id: "gl-land", accountCode: "5300", name: "Landscaping & Grounds", accountType: "expense" },
  { id: "gl-util", accountCode: "5400", name: "Utilities", accountType: "expense" },
  { id: "gl-misc", accountCode: "5900", name: "Uncategorized Expense", accountType: "expense" },
  { id: "gl-cash", accountCode: "1010", name: "Operating Cash", accountType: "asset" },
];

describe("normalizeVendorName — strips legal-suffix noise", () => {
  it("lowercases and removes suffixes/punctuation", () => {
    expect(normalizeVendorName("ABC Plumbing, Inc.")).toBe("abc plumbing");
    expect(normalizeVendorName("Elm Landscaping LLC")).toBe("elm landscaping");
    expect(normalizeVendorName("The Bright Spark Electric Co.")).toBe("bright spark electric");
  });
});

describe("vendorNameSimilarity", () => {
  it("scores an exact (normalized) match as 1", () => {
    expect(vendorNameSimilarity("ABC Plumbing Inc", "ABC Plumbing, Inc.")).toBe(1);
  });
  it("scores a close spelling high", () => {
    expect(vendorNameSimilarity("ABC Plumbng Inc", "ABC Plumbing")).toBeGreaterThan(0.6);
  });
  it("handles reordered tokens via token overlap", () => {
    expect(vendorNameSimilarity("Landscaping by Elm", "Elm Landscaping LLC")).toBeGreaterThan(0.6);
  });
  it("scores an unrelated name low", () => {
    expect(vendorNameSimilarity("ZZ Roofing", "Elm Landscaping")).toBeLessThan(0.34);
  });
  it("empty inputs → 0", () => {
    expect(vendorNameSimilarity("", "ABC")).toBe(0);
  });
});

describe("suggestVendorMatch", () => {
  it("returns the best candidate above the floor", () => {
    const m = suggestVendorMatch("ABC Plumbing Incorporated", VENDORS);
    expect(m?.vendorId).toBe("v-plumb");
    expect(m?.trade).toBe("plumbing");
    expect(m!.score).toBeGreaterThan(0.7);
  });
  it("returns null when nothing clears the floor", () => {
    expect(suggestVendorMatch("Totally Unknown Vendor XYZ", VENDORS)).toBeNull();
  });
});

describe("confidenceBand — documented thresholds", () => {
  it("bands by threshold", () => {
    expect(confidenceBand(CONFIDENCE_THRESHOLDS.high)).toBe("high");
    expect(confidenceBand(0.9)).toBe("high");
    expect(confidenceBand(CONFIDENCE_THRESHOLDS.medium)).toBe("medium");
    expect(confidenceBand(0.7)).toBe("medium");
    expect(confidenceBand(0.4)).toBe("low");
    expect(confidenceBand(NaN)).toBe("low");
  });
});

describe("suggestGlCode — signal priority", () => {
  it("1) prefers vendor history (strongest signal)", () => {
    const s = suggestGlCode({
      glAccounts: GL,
      vendorTrade: "plumbing",
      vendorHistory: [
        { glAccountId: "gl-rm", count: 8 },
        { glAccountId: "gl-util", count: 1 },
      ],
    });
    expect(s?.glAccountId).toBe("gl-rm");
    expect(s?.basis).toBe("vendor-history");
    expect(s!.score).toBeGreaterThan(CONFIDENCE_THRESHOLDS.medium);
  });

  it("small-sample history is dampened (1-of-1 is not certainty)", () => {
    const s = suggestGlCode({
      glAccounts: GL,
      vendorHistory: [{ glAccountId: "gl-rm", count: 1 }],
    });
    expect(s?.basis).toBe("vendor-history");
    expect(s!.score).toBeLessThan(0.85); // never reads "high" off one data point
  });

  it("2) falls to trade/memo keywords when there is no history", () => {
    const s = suggestGlCode({
      glAccounts: GL,
      vendorTrade: "landscaping",
      memo: "Monthly lawn care and grounds upkeep",
    });
    expect(s?.glAccountId).toBe("gl-land");
    expect(s?.basis).toBe("trade-keyword");
    expect(s!.score).toBeLessThanOrEqual(0.8); // keyword matches never "high"
  });

  it("3) falls back to an uncategorized expense account at low confidence", () => {
    const s = suggestGlCode({ glAccounts: GL, vendorTrade: "unknowntrade" });
    expect(s?.glAccountId).toBe("gl-misc");
    expect(s?.basis).toBe("fallback");
    expect(confidenceBand(s!.score)).toBe("low");
  });

  it("only ever suggests EXPENSE accounts", () => {
    const onlyAsset: GlAccountCandidate[] = [GL[4]];
    expect(suggestGlCode({ glAccounts: onlyAsset })).toBeNull();
  });
});

describe("buildApSuggestion — full suggestion + reasoning", () => {
  it("high-confidence path: strong vendor match + strong history", () => {
    const out = buildApSuggestion({
      input: { vendorName: "ABC Plumbing Inc.", amount: 1250.5, invoiceNumber: "INV-77", memo: "leak repair" },
      vendors: VENDORS,
      glAccounts: GL,
      vendorHistoryByVendorId: { "v-plumb": [{ glAccountId: "gl-rm", count: 12 }] },
    });
    expect(out.vendorMatch?.vendorId).toBe("v-plumb");
    expect(out.glSuggestion?.accountCode).toBe("5200");
    expect(out.confidence.band).toBe("high");
    // reasoning names WHY (criterion 4)
    expect(out.reasoning).toContain("ABC Plumbing");
    expect(out.reasoning).toContain("5200");
    expect(out.reasoning).toContain("L3");
    expect(out.reasoning).toContain("$1,250.50");
  });

  it("overall confidence = product of vendor & GL confidence (weak link pulls down)", () => {
    const out = buildApSuggestion({
      input: { vendorName: "ABC Plumbing Inc.", amount: 100 },
      vendors: VENDORS,
      glAccounts: GL,
      // no history + no memo → GL falls to low-confidence fallback
    });
    expect(out.confidence.overall).toBeCloseTo(out.confidence.vendor * out.confidence.gl, 5);
    expect(out.confidence.band).not.toBe("high"); // fallback GL caps it below high
  });

  it("no vendor match → reasoning flags 'human should confirm', overall low", () => {
    const out = buildApSuggestion({
      input: { vendorName: "Nonexistent Vendor QQ", amount: 50 },
      vendors: VENDORS,
      glAccounts: GL,
    });
    expect(out.vendorMatch).toBeNull();
    expect(out.confidence.vendor).toBe(0);
    expect(out.confidence.overall).toBe(0);
    expect(out.confidence.band).toBe("low");
    expect(out.reasoning).toMatch(/human should confirm/i);
  });
});

describe("action-type is L3 (server-authoritative gate binds this suggestion)", () => {
  it("the AP coding action-type maps to L3", () => {
    expect(levelForActionType(AP_INVOICE_CODING_ACTION_TYPE)).toBe("L3");
  });
});
