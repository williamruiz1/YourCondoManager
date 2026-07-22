import { describe, expect, it } from "vitest";
import { founderFeedbackSuccessToast } from "./founder-feedback-widget";

describe("founderFeedbackSuccessToast", () => {
  it("confirms first-party intake without referencing an external tracker", () => {
    expect(founderFeedbackSuccessToast({ destination: "feedback-center" })).toEqual({
      title: "Saved in YCM Feedback Center",
      description: "Your note is in the internal review queue with its page context attached.",
    });
  });
});
