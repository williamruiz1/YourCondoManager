/**
 * Pressing-items role lens tests (founder-os#1256, Phase 1).
 *
 * Pure-data tests for the role → class lens. The full scanner is exercised
 * via integration tests once the test DB is in scope (separate dispatch);
 * this file verifies the lens table is intact and complete.
 */

import { describe, expect, it } from "vitest";
import { PRESSING_ITEM_ROLE_LENS } from "@shared/schema";

describe("PRESSING_ITEM_ROLE_LENS", () => {
  it("board role sees every class", () => {
    expect(PRESSING_ITEM_ROLE_LENS.board).toEqual(
      expect.arrayContaining([
        "unidentified_txn",
        "delinquency_rising",
        "document_attention",
        "compliance_deadline",
      ]),
    );
    expect(PRESSING_ITEM_ROLE_LENS.board).toHaveLength(4);
  });

  it("treasurer only sees money classes", () => {
    expect(PRESSING_ITEM_ROLE_LENS.treasurer).toEqual([
      "unidentified_txn",
      "delinquency_rising",
    ]);
  });

  it("secretary only sees document/compliance classes", () => {
    expect(PRESSING_ITEM_ROLE_LENS.secretary).toEqual([
      "document_attention",
      "compliance_deadline",
    ]);
  });

  it("president sees compliance + delinquency (no unidentified txns)", () => {
    expect(PRESSING_ITEM_ROLE_LENS.president).not.toContain("unidentified_txn");
    expect(PRESSING_ITEM_ROLE_LENS.president).toContain("compliance_deadline");
  });
});
