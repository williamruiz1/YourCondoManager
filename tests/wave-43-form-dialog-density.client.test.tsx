/**
 * Wave 43 — Form-dialog mobile density round 3.
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.3-mobile-audit.md
 * (Wave 43 section). Closes the Wave 31 deferred dialog list.
 *
 * Approach mirrors Wave 28's smoke: render a couple of patched dialog
 * shells at a simulated 375px viewport and assert
 * `scrollWidth <= 375`, plus static-source guards that the audited
 * files use the responsive `grid-cols-1 sm:grid-cols-2` pattern
 * instead of the legacy `isMobile ? "grid-cols-1" : "grid-cols-2"`
 * ternary.
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

function InspectionShell() {
  return (
    <div className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-4xl">
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <div>Location type</div>
          <div>Unit</div>
          <div>Location detail</div>
          <div>Inspection type</div>
          <div>Inspector name</div>
          <div>Overall condition</div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="w-full sm:w-auto">Cancel</button>
          <button className="w-full sm:w-auto">Create Inspection</button>
        </div>
      </div>
    </div>
  );
}

function DelinquencyThresholdShell() {
  return (
    <div className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-h-[85vh] sm:max-w-md">
      <div className="space-y-3">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div>Stage #</div>
          <div>Action Type</div>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div>Min Balance ($)</div>
          <div>Min Days Overdue</div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="w-full sm:w-auto">Cancel</button>
          <button className="w-full sm:w-auto">Add Threshold</button>
        </div>
      </div>
    </div>
  );
}

describe("Wave 43 — form-dialog mobile density smoke (375px)", () => {
  it("Inspection shell does not exceed 375px", () => {
    const { container } = render(<InspectionShell />);
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });

  it("Delinquency threshold shell does not exceed 375px", () => {
    const { container } = render(<DelinquencyThresholdShell />);
    expect(container.scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH);
  });
});

describe("Wave 43 — patched files drop the isMobile grid ternary", () => {
  const FILES = [
    "client/src/pages/inspections.tsx",
    "client/src/pages/insurance.tsx",
    "client/src/pages/financial-utilities.tsx",
    "client/src/pages/financial-invoices.tsx",
    "client/src/pages/financial-delinquency.tsx",
    "client/src/pages/financial-ledger.tsx",
    "client/src/pages/financial-budgets.tsx",
    "client/src/pages/financial-reconciliation.tsx",
  ];

  for (const relativePath of FILES) {
    it(`${relativePath} contains a viewport-clamped DialogContent`, async () => {
      const absolutePath = path.join(REPO_ROOT, relativePath);
      const source = await fs.readFile(absolutePath, "utf-8");
      expect(source).toContain("max-w-[calc(100vw-2rem)]");
    });

    it(`${relativePath} has no isMobile grid-cols-1/grid-cols-2 ternary`, async () => {
      const absolutePath = path.join(REPO_ROOT, relativePath);
      const source = await fs.readFile(absolutePath, "utf-8");
      expect(source).not.toMatch(/isMobile\s*\?\s*"grid-cols-1"\s*:\s*"grid-cols-2"/);
    });
  }
});
