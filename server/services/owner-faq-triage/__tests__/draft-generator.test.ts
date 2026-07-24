/**
 * draft-generator.test.ts — grounded reply drafting (founder-os#9476).
 *
 * Verifies drafts are grounded in real source data, never fabricate numbers,
 * expose their reasoning + sourceData (explainability), and flag needsData when
 * the grounding is missing. DB-free.
 */
import { describe, it, expect } from "vitest";
import { generateDraft, type GroundingSnapshot } from "../draft-generator";

const g = (over: Partial<GroundingSnapshot> = {}): GroundingSnapshot => ({
  ownerName: "Jordan",
  associationName: "Cherry Hill Court",
  unitLabel: "Unit 4B",
  ...over,
});

describe("generateDraft — balance", () => {
  it("grounds the reply in the real balance and exposes sourceData", () => {
    const r = generateDraft("balance", g({ balanceCents: 12500, balanceAsOf: "2026-07-01" }));
    expect(r.needsData).toBe(false);
    expect(r.draftText).toContain("$125.00");
    expect(r.draftText).toContain("Jordan");
    expect(r.sourceData.balanceCents).toBe(12500);
    expect(r.reasoning).toMatch(/balance/i);
  });

  it("says paid-in-full at zero balance", () => {
    const r = generateDraft("balance", g({ balanceCents: 0 }));
    expect(r.draftText).toMatch(/paid in full|\$0\.00/i);
  });

  it("flags needsData when no balance is available (never fabricates)", () => {
    const r = generateDraft("balance", g({}));
    expect(r.needsData).toBe(true);
    expect(r.draftText).not.toMatch(/\$\d/); // no fabricated dollar figure
    expect(r.sourceData.balanceCents).toBeNull();
  });
});

describe("generateDraft — payment-status", () => {
  it("grounds in the most recent payment", () => {
    const r = generateDraft(
      "payment-status",
      g({ lastPayment: { amountCents: 30000, date: "2026-06-15", status: "posted", method: "ACH" } }),
    );
    expect(r.draftText).toContain("$300.00");
    expect(r.draftText).toMatch(/posted successfully/i);
    expect((r.sourceData.lastPayment as any).status).toBe("posted");
  });

  it("handles no recent payment gracefully", () => {
    const r = generateDraft("payment-status", g({}));
    expect(r.draftText).toMatch(/don't see a recent payment|still be processing/i);
  });
});

describe("generateDraft — meeting-schedule", () => {
  it("grounds in the next scheduled meeting", () => {
    const r = generateDraft(
      "meeting-schedule",
      g({ nextMeeting: { title: "Q3 Board Meeting", scheduledAt: "2026-08-12T18:00:00Z", location: "Clubhouse" } }),
    );
    expect(r.draftText).toContain("Q3 Board Meeting");
    expect(r.draftText).toContain("Clubhouse");
    expect(r.needsData).toBe(false);
  });

  it("handles no upcoming meeting", () => {
    const r = generateDraft("meeting-schedule", g({}));
    expect(r.draftText).toMatch(/isn't a meeting on the calendar/i);
  });
});

describe("generateDraft — document-request", () => {
  it("lists available documents", () => {
    const r = generateDraft(
      "document-request",
      g({ availableDocuments: [{ title: "Bylaws 2024" }, { title: "2026 Budget" }] }),
    );
    expect(r.draftText).toContain("Bylaws 2024");
    expect(r.draftText).toContain("2026 Budget");
  });

  it("flags needsData when no document catalog is available", () => {
    const r = generateDraft("document-request", g({}));
    expect(r.needsData).toBe(true);
  });
});

describe("generateDraft — other", () => {
  it("routes to a human with a safe acknowledgment and needsData", () => {
    const r = generateDraft("other", g({}));
    expect(r.needsData).toBe(true);
    expect(r.draftText).toMatch(/follow up/i);
  });
});
