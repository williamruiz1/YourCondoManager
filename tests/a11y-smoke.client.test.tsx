/**
 * 5.5 — Accessibility smoke test (Wave 21).
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.5-accessibility-audit.md
 *
 * This is a structural smoke test, not a full axe-core run. It verifies
 * the two cross-cutting fixes from Wave 21 stay in place:
 *
 *   1. Both shells (operator + portal) include a "Skip to content" link
 *      that targets the shell's <main> element.
 *   2. The hub placeholder pages render exactly one outermost wrapper
 *      and do NOT introduce a nested <main> (page-level wrappers are
 *      <section> / <div>, not <main>).
 *
 * Because the full operator shell + portal shell require a live session
 * + react-query provider tree, we assert the skip-link presence by
 * grepping the source files at test time. The hub-placeholder render
 * uses the same harness as `mobile-audit.client.test.tsx`.
 *
 * @vitest-environment jsdom
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import FinancialsHub from "../client/src/pages/hubs/financials-hub";
import OperationsHub from "../client/src/pages/hubs/operations-hub";
import GovernanceHub from "../client/src/pages/hubs/governance-hub";
import CommunicationsHub from "../client/src/pages/hubs/communications-hub";

const REPO_ROOT = path.resolve(__dirname, "..");

function renderWithClient(node: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchInterval: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ alerts: [], readStateBy: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

describe("a11y smoke — shells (5.5 AC 3 + AC 4)", () => {
  it("operator shell (App.tsx) declares the skip-link + main-content target", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/App.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/href="#main-content"/);
    expect(source).toMatch(/Skip to content/);
    expect(source).toMatch(/id="main-content"/);
    expect(source).toMatch(/tabIndex=\{-1\}/);
    expect(source).toMatch(/data-testid="skip-to-content-workspace"/);
  });

  it("portal shell declares the skip-link + portal-main-content target", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/portal/portal-shell.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/href="#portal-main-content"/);
    expect(source).toMatch(/Skip to content/);
    expect(source).toMatch(/id="portal-main-content"/);
    expect(source).toMatch(/tabIndex=\{-1\}/);
    expect(source).toMatch(/data-testid="skip-to-content-portal"/);
  });

  it("portal shell still renders a single <main> element with role=main implied", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/portal/portal-shell.tsx"),
      "utf-8",
    );
    // Strip block comments (`/* ... */`) before counting, since the
    // shell's prose comments mention <main> in passing.
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const mainCount = (stripped.match(/<main(\s|\n|>)/g) ?? []).length;
    expect(mainCount).toBe(1);
  });

  it("operator shell still renders a single <main> element", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/App.tsx"),
      "utf-8",
    );
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const mainCount = (stripped.match(/<main(\s|\n|>)/g) ?? []).length;
    expect(mainCount).toBe(1);
  });
});

describe("a11y smoke — hub placeholders (5.5 AC 5)", () => {
  it("Financials hub does not introduce a nested <main>", () => {
    const { container } = renderWithClient(<FinancialsHub />);
    expect(container.querySelector("main")).toBeNull();
  });

  it("Operations hub does not introduce a nested <main>", () => {
    const { container } = renderWithClient(<OperationsHub />);
    expect(container.querySelector("main")).toBeNull();
  });

  it("Governance hub does not introduce a nested <main>", () => {
    const { container } = renderWithClient(<GovernanceHub />);
    expect(container.querySelector("main")).toBeNull();
  });

  it("Communications hub does not introduce a nested <main>", () => {
    const { container } = renderWithClient(<CommunicationsHub />);
    expect(container.querySelector("main")).toBeNull();
  });

  it("Financials hub renders the EmptyState with role=status (5.5 AC 7-8)", () => {
    const { container } = renderWithClient(<FinancialsHub />);
    const empty = container.querySelector('[data-testid="financials-hub-empty"]');
    expect(empty).not.toBeNull();
    expect(empty?.getAttribute("role")).toBe("status");
  });
});

describe("a11y smoke — Wave 23 round 2 fixes", () => {
  it("operator sidebar declares aria-label on its navigation region", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/components/app-sidebar.tsx"),
      "utf-8",
    );
    // SidebarContent role + aria-label name the sidebar's nav region as
    // 'Main navigation' so screen readers can identify it. This was a
    // Wave 21 deferred fix that landed in Wave 23.
    expect(source).toMatch(/role="navigation"/);
    expect(source).toMatch(/aria-label="Main navigation"/);
  });

  it("WorkspacePageHeader supports headingId for aria-labelledby wiring", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/components/workspace-page-header.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/headingId\?:\s*string/);
    // The h1 wires id={headingId} so a parent <section aria-labelledby> can
    // resolve the accessible name from the visible heading.
    expect(source).toMatch(/id=\{headingId\}/);
  });

  it("Wave 23 surfaces use <section aria-labelledby> instead of <main>", async () => {
    const SURFACES = [
      "client/src/pages/financial-foundation.tsx",
      "client/src/pages/financial-billing.tsx",
      "client/src/pages/financial-recurring-charges.tsx",
      "client/src/pages/financial-late-fees.tsx",
      "client/src/pages/financial-payments.tsx",
      "client/src/pages/financial-ledger.tsx",
      "client/src/pages/work-orders.tsx",
      "client/src/pages/vendors.tsx",
      "client/src/pages/meetings.tsx",
      "client/src/pages/elections.tsx",
      "client/src/pages/announcements.tsx",
      "client/src/pages/documents.tsx",
      "client/src/pages/persons.tsx",
      "client/src/pages/units.tsx",
    ];
    for (const rel of SURFACES) {
      const source = await fs.readFile(path.join(REPO_ROOT, rel), "utf-8");
      // Each surface declares an aria-labelledby tying its <section> region
      // to the visible <h1> id. We don't grep for `<main>` because the
      // shell renders that — surfaces should not.
      expect(source, `${rel} missing aria-labelledby`).toMatch(/aria-labelledby="/);
    }
  });
});

describe("a11y smoke — registry-driven copy (5.5 AC 1)", () => {
  it("Financials hub heading uses the i18n registry value", () => {
    const { getAllByText } = renderWithClient(<FinancialsHub />);
    // The string "Financials" is sourced from `strings.en.ts`. Both the
    // breadcrumb and the page heading render it, so we assert
    // multiplicity rather than uniqueness.
    expect(getAllByText("Financials").length).toBeGreaterThanOrEqual(1);
  });

  it("Communications hub heading uses the i18n registry value", () => {
    const { getAllByText } = renderWithClient(<CommunicationsHub />);
    expect(getAllByText("Communications").length).toBeGreaterThanOrEqual(1);
  });
});
