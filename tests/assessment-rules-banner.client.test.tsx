/**
 * 4.3 Wave 8 — Legacy banner tests.
 *
 * Covers:
 *   1. Banner renders on Foundation + Billing when localStorage is empty.
 *   2. Dismiss click writes the localStorage key.
 *   3. Banner does not render when localStorage key is already set.
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import {
  AssessmentRulesBanner,
  ASSESSMENT_RULES_BANNER_STORAGE_KEY,
} from "@/components/assessment-rules-banner";

function renderBanner() {
  const { hook } = memoryLocation({ path: "/app/financial/foundation", record: true });
  return render(
    <Router hook={hook}>
      <AssessmentRulesBanner />
    </Router>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("AssessmentRulesBanner", () => {
  it("renders a link to /app/financial/rules when localStorage is empty", async () => {
    renderBanner();
    // Banner mounts then flips dismissed=false via useEffect, so wait.
    const banner = await screen.findByTestId("assessment-rules-banner");
    expect(banner).toBeInTheDocument();
    const link = screen.getByTestId("assessment-rules-banner-link");
    expect(link).toHaveAttribute("href", "/app/financial/rules");
    expect(link.textContent).toMatch(/assessment rules/i);
  });

  it("writes the localStorage key on dismiss and hides the banner", async () => {
    renderBanner();
    const dismiss = await screen.findByTestId("assessment-rules-banner-dismiss");
    act(() => {
      fireEvent.click(dismiss);
    });
    expect(window.localStorage.getItem(ASSESSMENT_RULES_BANNER_STORAGE_KEY)).toBe("1");
    expect(screen.queryByTestId("assessment-rules-banner")).toBeNull();
  });

  it("does not render when the dismiss key is already set", () => {
    window.localStorage.setItem(ASSESSMENT_RULES_BANNER_STORAGE_KEY, "1");
    renderBanner();
    expect(screen.queryByTestId("assessment-rules-banner")).toBeNull();
  });
});
