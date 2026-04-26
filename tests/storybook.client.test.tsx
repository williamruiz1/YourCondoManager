/**
 * Wave 37 — Storybook smoke test.
 *
 * Spec: docs/projects/platform-overhaul/decisions/5.10-component-library-docs.md
 *
 * Imports the EmptyState stories via Storybook's `composeStories()`
 * helper and renders each one with React Testing Library to confirm
 * the story setup wires up cleanly. Pure smoke — no assertions on
 * intent or visuals; that's the dev-server / Chromatic pass.
 *
 * Picking <EmptyState> as the representative file keeps the test
 * dependency footprint zero (no QueryClient, no router, no fixtures
 * with browser-only globals). If the harness ever drifts the
 * exception will surface here on every CI run.
 *
 * @vitest-environment jsdom
 */

import { describe, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { composeStories } from "@storybook/react-vite";

import * as emptyStateStories from "../client/src/components/empty-state.stories";

describe("Storybook composeStories smoke (5.10 Wave 37)", () => {
  const composed = composeStories(emptyStateStories);
  const names = Object.keys(composed);

  it("composes at least one named story", () => {
    if (names.length === 0) {
      throw new Error(
        "composeStories returned no stories — Storybook setup is misconfigured.",
      );
    }
  });

  for (const name of names) {
    it(`renders <EmptyState> story: ${name}`, () => {
      const Story = composed[name as keyof typeof composed];
      const { unmount } = render(<Story />);
      unmount();
      cleanup();
    });
  }
});
