/**
 * Unit tests for `useDocumentTitle` — the SOLE `document.title` setter per
 * 1.4 Page Title Consistency (Q1, Q2).
 *
 * Covers:
 * - Format: `{title} — YCM` with em dash U+2014 and uppercase YCM.
 * - Updates when the `title` argument changes.
 * - Empty-string behavior (1.4 doc is silent → hook is a mechanical setter;
 *   caller is responsible for supplying non-empty titles).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";

function Harness({ title }: { title: string }) {
  useDocumentTitle(title);
  return <div data-testid="harness">{title}</div>;
}

const ORIGINAL_TITLE = "YourCondoManager";

afterEach(() => {
  document.title = ORIGINAL_TITLE;
});

describe("useDocumentTitle", () => {
  it("sets document.title to `{title} — YCM`", () => {
    render(<Harness title="Home" />);
    expect(document.title).toBe("Home — YCM");
  });

  it("uses the em dash U+2014 separator, not a hyphen or en dash", () => {
    render(<Harness title="Financials" />);
    // Strict character check: U+2014 EM DASH.
    expect(document.title).toBe("Financials \u2014 YCM");
    expect(document.title).toContain("\u2014");
    expect(document.title).not.toContain(" - ");
    expect(document.title).not.toContain(" \u2013 "); // en dash U+2013
  });

  it("keeps YCM uppercase", () => {
    render(<Harness title="Operations" />);
    // Regex asserts the trailing token is YCM (uppercase), no lowercase variants.
    expect(document.title).toMatch(/ \u2014 YCM$/);
    expect(document.title).not.toMatch(/ycm/);
    expect(document.title).not.toMatch(/Ycm/);
  });

  it("updates document.title when the title arg changes", () => {
    const { rerender } = render(<Harness title="Home" />);
    expect(document.title).toBe("Home — YCM");

    rerender(<Harness title="Financials" />);
    expect(document.title).toBe("Financials — YCM");

    rerender(<Harness title="Operations" />);
    expect(document.title).toBe("Operations — YCM");
  });

  it("applies the format mechanically to an empty-string title", () => {
    // The 1.4 decision doc does not specify empty-string validation; the hook
    // is a mechanical setter and the caller is responsible for supplying a
    // meaningful title. The HTML spec (and jsdom) strips leading/trailing
    // ASCII whitespace from `document.title`, so the composed string
    // " — YCM" surfaces as "— YCM". This test locks in that observable
    // behavior so future changes surface deliberately.
    render(<Harness title="" />);
    expect(document.title).toBe("— YCM");
  });

  it("is idempotent: does not rewrite document.title when value is unchanged", () => {
    render(<Harness title="Home" />);
    expect(document.title).toBe("Home — YCM");

    // Mutating document.title to the same value should not be triggered by a
    // re-render with the same prop. We observe this by replacing document.title
    // with a sentinel and confirming the hook does NOT overwrite it when the
    // title arg is unchanged across renders.
    //
    // Re-rendering the same Harness with the same title does not re-run the
    // effect (React's dep-array short-circuit), so document.title stays as the
    // sentinel we set.
    const { rerender } = render(<Harness title="Stable" />);
    expect(document.title).toBe("Stable — YCM");
    document.title = "EXTERNAL_SENTINEL";
    rerender(<Harness title="Stable" />);
    expect(document.title).toBe("EXTERNAL_SENTINEL");
  });
});
