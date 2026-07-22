import { describe, expect, it } from "vitest";
import { canTransitionFounderFeedback } from "./founder-feedback-lifecycle";

describe("first-party founder feedback lifecycle", () => {
  it("requires triage before planning or active work", () => {
    expect(canTransitionFounderFeedback("new", "triaged")).toBe(true);
    expect(canTransitionFounderFeedback("new", "planned")).toBe(false);
    expect(canTransitionFounderFeedback("new", "in_progress")).toBe(false);
  });

  it("supports resolution and a controlled reopen path", () => {
    expect(canTransitionFounderFeedback("in_progress", "resolved")).toBe(true);
    expect(canTransitionFounderFeedback("resolved", "in_progress")).toBe(true);
    expect(canTransitionFounderFeedback("resolved", "new")).toBe(false);
  });

  it("allows dismissed items to return to intake or triage", () => {
    expect(canTransitionFounderFeedback("dismissed", "new")).toBe(true);
    expect(canTransitionFounderFeedback("dismissed", "triaged")).toBe(true);
  });
});
