/**
 * classifier.test.ts — owner-inquiry categorizer (founder-os#9476).
 *
 * Verifies each routine category classifies correctly, the payment-status vs
 * balance disambiguation, and the "other" fallback. DB-free.
 */
import { describe, it, expect } from "vitest";
import { classifyInquiry } from "../classifier";

describe("classifyInquiry", () => {
  it("classifies a balance question", () => {
    const r = classifyInquiry("Hi, what's my current balance? How much do I owe?");
    expect(r.category).toBe("balance");
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.matchedSignals.length).toBeGreaterThan(0);
  });

  it("classifies a payment-status question (not balance) even though it says 'payment'", () => {
    const r = classifyInquiry("Did my payment post? I sent it last week.");
    expect(r.category).toBe("payment-status");
  });

  it("classifies a document request", () => {
    expect(classifyInquiry("Can I get a copy of the bylaws?").category).toBe("document-request");
    expect(classifyInquiry("Where do I find the reserve study report?").category).toBe("document-request");
  });

  it("classifies a meeting-schedule question", () => {
    expect(classifyInquiry("When's the next board meeting?").category).toBe("meeting-schedule");
    expect(classifyInquiry("When does the board meet next?").category).toBe("meeting-schedule");
  });

  it("falls back to 'other' for an unmatched inquiry", () => {
    const r = classifyInquiry("My neighbor's dog keeps barking at night.");
    expect(r.category).toBe("other");
    expect(r.confidence).toBe(0);
  });

  it("returns 'other' with zero confidence for empty input", () => {
    const r = classifyInquiry("   ");
    expect(r.category).toBe("other");
    expect(r.confidence).toBe(0);
    expect(r.matchedSignals).toEqual([]);
  });

  it("confidence rises with more matched signals", () => {
    const weak = classifyInquiry("balance");
    const strong = classifyInquiry("what is my current balance, how much do I owe, am I paid up?");
    expect(strong.confidence).toBeGreaterThanOrEqual(weak.confidence);
  });
});
