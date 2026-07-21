import { describe, expect, it } from "vitest";
import { founderFeedbackSuccessToast } from "./founder-feedback-widget";

describe("founderFeedbackSuccessToast", () => {
  it("confirms build-team routing only when the GitHub mirror succeeded", () => {
    expect(founderFeedbackSuccessToast({ dbOnly: false })).toEqual({
      title: "Got it — routed to the build team.",
    });
  });

  it("truthfully distinguishes database-only persistence", () => {
    expect(founderFeedbackSuccessToast({ dbOnly: true })).toEqual({
      title: "Feedback saved to YCM",
      description: "GitHub issue filing is unavailable right now. Your note is safely stored for follow-up.",
    });
  });
});
