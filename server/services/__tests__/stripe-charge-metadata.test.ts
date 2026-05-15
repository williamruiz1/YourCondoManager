/**
 * Unit tests for stripe-charge-metadata helpers (Issue founder-os#969).
 *
 * Pure-function suite — verifies the three spec contracts:
 *   §2.3 — Statement descriptor suffix vocabulary
 *   §1.2 — Application fee floor/ceiling/computation
 *   §3.1 — Stripe metadata schema population
 */

import { describe, it, expect } from "vitest";

import {
  STATEMENT_DESCRIPTOR_SUFFIX_VOCABULARY,
  descriptorSuffixForEntryType,
  normalizeChargeType,
  computeApplicationFeeCents,
  APPLICATION_FEE_FLOOR_CENTS,
  APPLICATION_FEE_CEILING_CENTS,
  DEFAULT_APPLICATION_FEE_RATE,
  buildSpecMetadata,
  CHARGE_METADATA_SCHEMA_VERSION,
  applyChargeMetadataToCheckoutSession,
  applyChargeMetadataToPaymentIntent,
  periodFromDate,
  isoDate,
} from "../stripe-charge-metadata";

describe("descriptorSuffixForEntryType (spec §2.3 — controlled vocabulary)", () => {
  it("maps every documented entryType to its 4-or-5 char suffix", () => {
    expect(descriptorSuffixForEntryType("dues")).toBe("DUES");
    expect(descriptorSuffixForEntryType("assessment")).toBe("ASMT");
    expect(descriptorSuffixForEntryType("late_fee")).toBe("LATE");
    expect(descriptorSuffixForEntryType("reserve_contribution")).toBe("RSRV");
    expect(descriptorSuffixForEntryType("fine")).toBe("FINE");
    expect(descriptorSuffixForEntryType("interest")).toBe("INTR");
    expect(descriptorSuffixForEntryType("legal_fee")).toBe("LEGAL");
    expect(descriptorSuffixForEntryType("other")).toBe("MISC");
  });

  it("tolerates hyphen vs underscore in input (legacy callers use late-fee)", () => {
    expect(descriptorSuffixForEntryType("late-fee")).toBe("LATE");
    expect(descriptorSuffixForEntryType("reserve-contribution")).toBe("RSRV");
    expect(descriptorSuffixForEntryType("legal-fee")).toBe("LEGAL");
  });

  it("is case-insensitive", () => {
    expect(descriptorSuffixForEntryType("DUES")).toBe("DUES");
    expect(descriptorSuffixForEntryType("Assessment")).toBe("ASMT");
  });

  it("falls back to MISC for unknown / null / empty inputs", () => {
    expect(descriptorSuffixForEntryType(null)).toBe("MISC");
    expect(descriptorSuffixForEntryType(undefined)).toBe("MISC");
    expect(descriptorSuffixForEntryType("")).toBe("MISC");
    expect(descriptorSuffixForEntryType("unrecognized")).toBe("MISC");
  });

  it("vocabulary stays under Stripe's 22-char budget when combined with the YCM- prefix", () => {
    // Per spec §2.4: YCM-CHRY HILL HOA DUES = 22 chars exactly.
    // Prefix is ~17 chars; suffix budget is 4-5 chars.
    for (const suffix of Object.values(STATEMENT_DESCRIPTOR_SUFFIX_VOCABULARY)) {
      expect(suffix.length).toBeLessThanOrEqual(5);
    }
  });
});

describe("normalizeChargeType (spec §3.1 charge_type enum)", () => {
  it("returns the input when it's a known type", () => {
    expect(normalizeChargeType("dues")).toBe("dues");
    expect(normalizeChargeType("late_fee")).toBe("late_fee");
  });

  it("normalizes hyphen variants", () => {
    expect(normalizeChargeType("late-fee")).toBe("late_fee");
    expect(normalizeChargeType("reserve-contribution")).toBe("reserve_contribution");
  });

  it("falls back to 'other' for unknown / null", () => {
    expect(normalizeChargeType(null)).toBe("other");
    expect(normalizeChargeType(undefined)).toBe("other");
    expect(normalizeChargeType("nonsense")).toBe("other");
  });
});

describe("computeApplicationFeeCents (spec §1.2 — fee math)", () => {
  it("applies the default rate (1.0%) when none specified", () => {
    // $100 charge → 100c → $1.00 fee
    expect(computeApplicationFeeCents(10000)).toBe(100);
    expect(DEFAULT_APPLICATION_FEE_RATE).toBe(0.01);
  });

  it("enforces the $0.50 floor on tiny charges", () => {
    // $10 charge × 1% = 10c, but floor is 50c
    expect(computeApplicationFeeCents(1000)).toBe(50);
    // $25 charge × 1% = 25c → still floored
    expect(computeApplicationFeeCents(2500)).toBe(50);
    expect(APPLICATION_FEE_FLOOR_CENTS).toBe(50);
  });

  it("enforces the $25 ceiling on large charges", () => {
    // $10,000 charge × 1% = $100, but ceiling is $25
    expect(computeApplicationFeeCents(1_000_000)).toBe(2500);
    // $50,000 charge × 1% = $500 → still capped
    expect(computeApplicationFeeCents(5_000_000)).toBe(2500);
    expect(APPLICATION_FEE_CEILING_CENTS).toBe(2500);
  });

  it("respects custom rates (e.g., 0.5% competitive, 1.5% premium)", () => {
    // $5000 × 0.5% = $25 (right at ceiling)
    expect(computeApplicationFeeCents(500_000, 0.005)).toBe(2500);
    // $1000 × 1.5% = $15
    expect(computeApplicationFeeCents(100_000, 0.015)).toBe(1500);
  });

  it("never charges more in fees than the principal (degenerate guard)", () => {
    // $0.10 charge — floor is $0.50, but you can't take more than the principal.
    expect(computeApplicationFeeCents(10)).toBe(10);
  });

  it("returns 0 for non-positive amounts or rates", () => {
    expect(computeApplicationFeeCents(0)).toBe(0);
    expect(computeApplicationFeeCents(-100)).toBe(0);
    expect(computeApplicationFeeCents(1000, 0)).toBe(0);
    expect(computeApplicationFeeCents(1000, -0.01)).toBe(0);
    expect(computeApplicationFeeCents(NaN)).toBe(0);
    expect(computeApplicationFeeCents(1000, NaN)).toBe(0);
  });

  it("rounds rather than truncates for half-cent edge cases", () => {
    // 12345c × 1% = 123.45 → 123c (rounds)
    expect(computeApplicationFeeCents(12345)).toBe(123);
    // 12356c × 1% = 123.56 → 124c (rounds)
    expect(computeApplicationFeeCents(12356)).toBe(124);
  });
});

describe("buildSpecMetadata (spec §3.1 — required + optional keys)", () => {
  const baseCtx = {
    ownerName: "Jane Doe",
    ownerId: "per_a1b2c3",
    unitId: "unt_d4e5f6",
    unitLabel: "1417 #3",
    hoaId: "asn_g7h8i9",
    hoaName: "Cherry Hill Court Condominiums",
    ledgerEntryId: "led_j0k1l2",
    chargeType: "dues" as const,
    period: "2026-05",
    environment: "production",
  };

  it("populates every §3.1 required key", () => {
    const md = buildSpecMetadata(baseCtx);
    expect(md.owner_name).toBe("Jane Doe");
    expect(md.owner_id).toBe("per_a1b2c3");
    expect(md.unit_id).toBe("unt_d4e5f6");
    expect(md.unit_label).toBe("1417 #3");
    expect(md.hoa_id).toBe("asn_g7h8i9");
    expect(md.hoa_name).toBe("Cherry Hill Court Condominiums");
    expect(md.ledger_entry_id).toBe("led_j0k1l2");
    expect(md.charge_type).toBe("dues");
    expect(md.period).toBe("2026-05");
    expect(md.ycm_environment).toBe("production");
    expect(md.ycm_charge_version).toBe(String(CHARGE_METADATA_SCHEMA_VERSION));
  });

  it("uses snake_case keys per spec §3.3", () => {
    const md = buildSpecMetadata(baseCtx);
    for (const key of Object.keys(md)) {
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("omits optional keys when not provided (Stripe 50-key budget hygiene)", () => {
    const md = buildSpecMetadata(baseCtx);
    expect(md).not.toHaveProperty("assessment_id");
    expect(md).not.toHaveProperty("payment_link_token");
    expect(md).not.toHaveProperty("autopay_enrollment_id");
    expect(md).not.toHaveProperty("original_due_date");
  });

  it("includes optional keys when set", () => {
    const md = buildSpecMetadata({
      ...baseCtx,
      assessmentId: "ass_111",
      paymentLinkToken: "tok_abc",
      autopayEnrollmentId: "en_222",
      originalDueDate: "2026-04-15",
    });
    expect(md.assessment_id).toBe("ass_111");
    expect(md.payment_link_token).toBe("tok_abc");
    expect(md.autopay_enrollment_id).toBe("en_222");
    expect(md.original_due_date).toBe("2026-04-15");
  });

  it("stays under Stripe's 50-key-per-object hard limit", () => {
    const md = buildSpecMetadata({
      ...baseCtx,
      assessmentId: "ass_111",
      paymentLinkToken: "tok_abc",
      autopayEnrollmentId: "en_222",
      originalDueDate: "2026-04-15",
    });
    expect(Object.keys(md).length).toBeLessThan(50);
  });
});

describe("applyChargeMetadataToCheckoutSession (URLSearchParams wiring)", () => {
  it("writes metadata to BOTH session and payment_intent_data scopes", () => {
    const params = new URLSearchParams();
    applyChargeMetadataToCheckoutSession(params, {
      owner_name: "Jane Doe",
      hoa_id: "asn_xyz",
    });
    expect(params.get("metadata[owner_name]")).toBe("Jane Doe");
    expect(params.get("metadata[hoa_id]")).toBe("asn_xyz");
    expect(params.get("payment_intent_data[metadata][owner_name]")).toBe("Jane Doe");
    expect(params.get("payment_intent_data[metadata][hoa_id]")).toBe("asn_xyz");
  });
});

describe("applyChargeMetadataToPaymentIntent (URLSearchParams wiring)", () => {
  it("writes metadata only to the top-level metadata scope", () => {
    const params = new URLSearchParams();
    applyChargeMetadataToPaymentIntent(params, {
      owner_name: "Jane Doe",
      ledger_entry_id: "led_111",
    });
    expect(params.get("metadata[owner_name]")).toBe("Jane Doe");
    expect(params.get("metadata[ledger_entry_id]")).toBe("led_111");
    // No nested payment_intent_data scope on off-session intent creation.
    expect(params.get("payment_intent_data[metadata][owner_name]")).toBeNull();
  });
});

describe("periodFromDate + isoDate (date helpers)", () => {
  it("periodFromDate returns YYYY-MM in UTC", () => {
    expect(periodFromDate(new Date("2026-05-15T12:00:00Z"))).toBe("2026-05");
    expect(periodFromDate(new Date("2025-12-31T23:00:00Z"))).toBe("2025-12");
  });

  it("isoDate returns YYYY-MM-DD in UTC; null for null input", () => {
    expect(isoDate(new Date("2026-04-15T10:00:00Z"))).toBe("2026-04-15");
    expect(isoDate(null)).toBeNull();
    expect(isoDate(undefined)).toBeNull();
  });
});
