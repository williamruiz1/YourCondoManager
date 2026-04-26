/**
 * 5.1 — EmptyState component tests.
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.1-empty-states.md
 *
 * Covers:
 *   - default render with icon + title + description
 *   - title-only render (no description)
 *   - cta with onClick fires the handler
 *   - cta with href renders a link
 *   - custom testId applies consistently
 *   - adoption at 3 call sites is present in source
 *
 * @vitest-environment jsdom
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Inbox } from "lucide-react";

import { EmptyState } from "../client/src/components/empty-state";

const REPO_ROOT = path.resolve(__dirname, "..");

describe("EmptyState", () => {
  it("renders default title + description + icon", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing yet"
        description="Items will show here."
      />,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state-title")).toHaveTextContent("Nothing yet");
    expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
      "Items will show here.",
    );
    expect(screen.getByTestId("empty-state-icon")).toBeInTheDocument();
  });

  it("renders without description when omitted", () => {
    render(<EmptyState icon={Inbox} title="Nothing yet" />);
    expect(screen.queryByTestId("empty-state-description")).toBeNull();
  });

  it("fires onClick when cta.onClick is provided", () => {
    const handler = vi.fn();
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing yet"
        cta={{ label: "Do the thing", onClick: handler }}
      />,
    );
    fireEvent.click(screen.getByTestId("empty-state-cta"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders a link when cta.href is provided", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing yet"
        cta={{ label: "Go somewhere", href: "/somewhere" }}
      />,
    );
    const cta = screen.getByTestId("empty-state-cta");
    // The Button asChild wraps a <Link> (anchor) from wouter.
    const anchor = cta.tagName === "A" ? cta : cta.querySelector("a");
    expect(anchor).not.toBeNull();
    expect((anchor as HTMLElement).getAttribute("href")).toBe("/somewhere");
  });

  it("honors custom testId", () => {
    render(
      <EmptyState icon={Inbox} title="Nothing yet" testId="portal-custom-empty" />,
    );
    expect(screen.getByTestId("portal-custom-empty")).toBeInTheDocument();
    expect(screen.getByTestId("portal-custom-empty-title")).toBeInTheDocument();
  });
});

describe("EmptyState — call-site adoption", () => {
  it("portal-requests.tsx imports and uses EmptyState", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/portal/portal-requests.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/components\/empty-state"/);
    expect(source).toMatch(/<EmptyState/);
  });

  it("portal-notices.tsx imports and uses EmptyState", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/portal/portal-notices.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/components\/empty-state"/);
    expect(source).toMatch(/<EmptyState/);
  });

  it("portal-finances.tsx imports and uses EmptyState", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/portal/portal-finances.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/components\/empty-state"/);
    expect(source).toMatch(/<EmptyState/);
  });

  it("financial-rules.tsx imports and uses EmptyState", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/financial-rules.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/components\/empty-state"/);
    expect(source).toMatch(/<EmptyState/);
  });

  // Phase 11 (3.2 Q1/Q2): the Financials and Operations hubs are now
  // navigation surfaces (zone title + sub-page link list per 1.2 Q2),
  // not EmptyState placeholders. EmptyState was the Wave-14 MVP slice
  // for hub placeholders; it's retired now that the hubs ship real nav
  // content. Adoption tests for these surfaces moved to the hub-pages
  // navigation grid assertion in `tests/hub-pages.client.test.tsx`.
});
