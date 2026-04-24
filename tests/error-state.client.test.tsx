/**
 * 5.2 — ErrorState component tests.
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.2-error-states.md
 *
 * @vitest-environment jsdom
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ErrorState } from "../client/src/components/error-state";

const REPO_ROOT = path.resolve(__dirname, "..");

describe("ErrorState", () => {
  it("renders default title + description without retry", () => {
    render(<ErrorState />);
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
    expect(screen.getByTestId("error-state-title")).toHaveTextContent(
      /something went wrong/i,
    );
    expect(screen.queryByTestId("error-state-retry")).toBeNull();
  });

  it("renders custom title and description", () => {
    render(
      <ErrorState
        title="Couldn't load history"
        description="We hit a glitch."
      />,
    );
    expect(screen.getByTestId("error-state-title")).toHaveTextContent(
      "Couldn't load history",
    );
    expect(screen.getByTestId("error-state-description")).toHaveTextContent(
      "We hit a glitch.",
    );
  });

  it("fires retry when the button is clicked", () => {
    const retry = vi.fn();
    render(<ErrorState retry={retry} />);
    fireEvent.click(screen.getByTestId("error-state-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders collapsed details when supplied", () => {
    render(<ErrorState details="TypeError: foo is undefined" />);
    const details = screen.getByTestId("error-state-details");
    expect(details).toBeInTheDocument();
    // default collapsed — `open` attribute is absent
    expect(details.hasAttribute("open")).toBe(false);
    // content rendered in the DOM regardless so tests can assert on it
    expect(details.textContent).toMatch(/TypeError: foo is undefined/);
  });

  it("honors custom testId", () => {
    render(<ErrorState testId="portal-custom-error" />);
    expect(screen.getByTestId("portal-custom-error")).toBeInTheDocument();
  });
});

describe("ErrorState — call-site adoption", () => {
  it("portal-requests.tsx imports and uses ErrorState", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/portal/portal-requests.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/components\/error-state"/);
    expect(source).toMatch(/<ErrorState/);
  });

  it("portal-notices.tsx imports and uses ErrorState", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/portal/portal-notices.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/components\/error-state"/);
    expect(source).toMatch(/<ErrorState/);
  });

  it("financial-rules.tsx imports and uses ErrorState", async () => {
    const source = await fs.readFile(
      path.join(REPO_ROOT, "client/src/pages/financial-rules.tsx"),
      "utf8",
    );
    expect(source).toMatch(/from "@\/components\/error-state"/);
    expect(source).toMatch(/<ErrorState/);
  });
});
