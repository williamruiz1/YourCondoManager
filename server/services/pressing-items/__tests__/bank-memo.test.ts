/**
 * Bank-memo humanizer tests (YCM pressing-items plain-English fix,
 * 2026-07-14 — founder-os teammate dispatch, William screenshot feedback:
 * "this all means nothing").
 *
 * Covers: ACH addenda-record parsing (tag order varies), counterparty
 * extraction preference (IND NAME > ORIG CO NAME), direction detection off
 * the Plaid-normalized sign convention (negative = credit/incoming,
 * positive = debit/outgoing — see auto-matcher.ts `isCredit`), and the
 * non-ACH fallback path for plain merchant-style memos.
 */
import { describe, expect, it } from "vitest";
import {
  extractCounterparty,
  humanizeUnidentifiedTxnTitle,
  isAchStyleMemo,
  parseAchFields,
} from "../bank-memo";

const RAW_ACH_MEMO =
  "ORIG CO NAME:ASCEND X ORIG ID:1060377390 DESC DATE: CO ENTRY DESCR:TRANSFER SEC:WEB " +
  "TRACE#:211170202748729 EED:260519 IND ID:LUZ MIRANDA IND NAME:Luz Miranda TRN: 1392748729TC";

describe("isAchStyleMemo", () => {
  it("recognizes an ACH addenda dump", () => {
    expect(isAchStyleMemo(RAW_ACH_MEMO)).toBe(true);
  });

  it("does not misclassify a plain merchant descriptor", () => {
    expect(isAchStyleMemo("ALL SEASON AZTEC LANDSCAPING")).toBe(false);
    expect(isAchStyleMemo("STARBUCKS #1234 DELAWARE OH")).toBe(false);
  });
});

describe("parseAchFields", () => {
  it("extracts every tagged field regardless of order", () => {
    const fields = parseAchFields(RAW_ACH_MEMO);
    expect(fields["IND NAME"]).toBe("Luz Miranda");
    expect(fields["ORIG CO NAME"]).toBe("ASCEND X");
    expect(fields["ORIG ID"]).toBe("1060377390");
    expect(fields["TRACE#"]).toBe("211170202748729");
  });

  it("prefers the longer compound tag over its substring (TRANSFER TRN vs TRN)", () => {
    const fields = parseAchFields("IND NAME:Jane Doe TRANSFER TRN: 999TC");
    expect(fields["TRANSFER TRN"]).toBe("999TC");
    expect(fields["TRN"]).toBeUndefined();
  });
});

describe("extractCounterparty", () => {
  it("prefers IND NAME over ORIG CO NAME for an ACH memo", () => {
    expect(extractCounterparty(RAW_ACH_MEMO, null)).toBe("Luz Miranda");
  });

  it("falls back to ORIG CO NAME when there is no individual name", () => {
    const memo = "ORIG CO NAME:ALL SEASON AZTEC ORIG ID:9988 SEC:CCD TRACE#:123";
    expect(extractCounterparty(memo, null)).toBe("All Season Aztec");
  });

  it("uses the Plaid merchant name when the memo is not ACH-tagged", () => {
    expect(extractCounterparty("POS PURCHASE 04/22 REF#8817263", "All Season Aztec Landscaping")).toBe(
      "All Season Aztec Landscaping",
    );
  });

  it("cleans a plain non-ACH memo when no merchant name is available", () => {
    expect(extractCounterparty("ZELLE FROM JOHN SMITH", null)).toBe("John Smith");
  });
});

describe("humanizeUnidentifiedTxnTitle", () => {
  it("labels a negative (credit) ACH transaction as an incoming transfer", () => {
    const title = humanizeUnidentifiedTxnTitle({
      amountCents: -62635,
      date: "2026-05-19",
      name: RAW_ACH_MEMO,
      merchantName: null,
    });
    expect(title).toBe("Incoming transfer from Luz Miranda — $626.35 (May 19) — needs matching");
  });

  it("labels a positive (debit) transaction as a payment to the counterparty", () => {
    const title = humanizeUnidentifiedTxnTitle({
      amountCents: 82500,
      date: "2026-05-22",
      name: "ALL SEASON AZTEC LANDSCAPING ACH DEBIT",
      merchantName: "All Season Aztec Landscaping",
    });
    expect(title).toBe("Payment to All Season Aztec Landscaping — $825.00 (May 22) — needs matching");
  });

  it("never leaks the raw ACH addenda tags into the title", () => {
    const title = humanizeUnidentifiedTxnTitle({
      amountCents: -62635,
      date: "2026-05-19",
      name: RAW_ACH_MEMO,
      merchantName: null,
    });
    expect(title).not.toMatch(/ORIG CO NAME|IND NAME|TRACE#|TRN:/);
  });
});
