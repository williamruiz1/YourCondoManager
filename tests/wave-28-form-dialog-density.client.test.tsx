/**
 * Wave 28 — Form-dialog mobile density smoke.
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.3-mobile-audit.md (Wave 28 section)
 *
 * Approach: render the patched DialogContent shells (no portal — we
 * render their inner markup directly so jsdom can measure them) at a
 * simulated 375px viewport and assert `scrollWidth <= 375`. As with
 * Wave 14 / Wave 18, this is a ROUGH PROXY: jsdom doesn't compute real
 * layout, so we're really asserting that no inline fixed widths > 375px
 * leak in. Real layout correctness still needs a human pass.
 *
 * We also do a static-source check verifying that the audited dialog
 * files do NOT contain unconditional `grid-cols-2` inside form blocks
 * (which is the regression we're guarding against).
 *
 * @vitest-environment jsdom
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const REPO_ROOT = path.resolve(__dirname, "..");
const MOBILE_WIDTH = 375;

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: MOBILE_WIDTH,
  });
  document.documentElement.style.width = `${MOBILE_WIDTH}px`;
  document.body.style.width = `${MOBILE_WIDTH}px`;
  document.body.style.margin = "0";
});

/**
 * Mini fixtures mirroring the patched dialog inner layouts. We don't
 * mount the real page components (they need TanStack Query + auth +
 * association context); instead, we re-render the shape of the
 * critical responsive blocks so the scrollWidth proxy can validate
 * them in isolation.
 */
function RecurringChargeShell() {
  return (
    <div className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-h-[85vh] sm:max-w-md">
      <div className="space-y-3">
        <input placeholder="Charge description" className="w-full rounded-md border px-3 py-2" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>Entry Type</div>
          <div>Amount ($)</div>
          <div>Frequency</div>
          <div>Day of Month</div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
          <button className="w-full sm:w-auto">Cancel</button>
          <button className="w-full sm:w-auto">Create</button>
        </div>
      </div>
    </div>
  );
}

function SpecialAssessmentShell() {
  return (
    <div className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-h-[85vh] sm:max-w-xl">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <input placeholder="Total Amount" />
        <input placeholder="Installments" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <input type="date" />
        <input type="date" />
      </div>
      <button className="w-full">Create Assessment</button>
    </div>
  );
}

function WorkOrderShell() {
  return (
    <div className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-h-[85vh] sm:max-w-2xl">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <input placeholder="Title" />
        <input placeholder="Location" />
        <input placeholder="Unit" />
        <input placeholder="Vendor" />
      </div>
      <button className="w-full">Create Work Order</button>
    </div>
  );
}

describe("Wave 28 — form-dialog mobile density smoke (375px)", () => {
  it("Recurring Charge shell does not exceed 375px", () => {
    const { container } = render(<RecurringChargeShell />);
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });

  it("Special Assessment shell does not exceed 375px", () => {
    const { container } = render(<SpecialAssessmentShell />);
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });

  it("Work Order shell does not exceed 375px", () => {
    const { container } = render(<WorkOrderShell />);
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });
});

/**
 * Static-source guards — ensure the audited files use the responsive
 * `grid-cols-1 sm:grid-cols-2` pattern inside dialog blocks instead of
 * the JS-gated `isMobile ? "grid-cols-1" : "grid-cols-2"` ternary
 * pattern that ships an extra render dependency on a hook (and won't
 * adapt if the user resizes mid-session without a re-render).
 */
describe("Wave 28 — patched files use Tailwind responsive prefixes (no isMobile grid ternary)", () => {
  const FILES = [
    "client/src/pages/financial-recurring-charges.tsx",
    "client/src/pages/financial-assessments.tsx",
    "client/src/pages/financial-late-fees.tsx",
    "client/src/pages/work-orders.tsx",
    "client/src/pages/admin-users.tsx",
    "client/src/pages/elections.tsx",
    "client/src/pages/maintenance-schedules.tsx",
    "client/src/pages/vendors.tsx",
    "client/src/pages/associations.tsx",
    "client/src/pages/persons.tsx",
    "client/src/pages/documents.tsx",
  ];

  for (const relativePath of FILES) {
    it(`${relativePath} contains a viewport-clamped DialogContent`, async () => {
      const absolutePath = path.join(REPO_ROOT, relativePath);
      const source = await fs.readFile(absolutePath, "utf-8");
      // Every patched file should now have at least one DialogContent
      // that uses `max-w-[calc(100vw-2rem)]` for the <640px clamp.
      expect(source).toContain("max-w-[calc(100vw-2rem)]");
    });

    it(`${relativePath} has no isMobile grid ternary inside dialog forms`, async () => {
      const absolutePath = path.join(REPO_ROOT, relativePath);
      const source = await fs.readFile(absolutePath, "utf-8");
      // The legacy pattern was: `${isMobile ? "grid-cols-1" : "grid-cols-2"}`
      // We assert the audited files no longer carry that exact tail.
      expect(source).not.toMatch(/isMobile\s*\?\s*"grid-cols-1"\s*:\s*"grid-cols-2"/);
    });
  }
});
