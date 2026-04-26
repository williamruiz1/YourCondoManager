// Wave 37 — Storybook coverage for <ErrorBoundary>.
//
// Spec: docs/projects/platform-overhaul/decisions/5.2-error-states.md
//
// The boundary only renders its children unless something throws. To
// demonstrate the fallback we render a tiny child that throws on
// first mount.

import type { Meta, StoryObj } from "@storybook/react-vite";

import { ErrorBoundary } from "./error-boundary";

function ThrowOnMount(): JSX.Element {
  throw new Error("Synthetic Storybook render error");
}

const meta: Meta<typeof ErrorBoundary> = {
  title: "Shared/ErrorBoundary",
  component: ErrorBoundary,
};

export default meta;

type Story = StoryObj<typeof ErrorBoundary>;

export const HappyPath: Story = {
  args: {
    children: (
      <div className="rounded-md border bg-card p-4 text-sm">
        Wrapped content renders normally when nothing throws.
      </div>
    ),
  },
};

export const RendersFallback: Story = {
  args: {
    title: "This panel hit an error",
    description: "Reload the panel to try again.",
    children: <ThrowOnMount />,
  },
};

export const CustomFallback: Story = {
  args: {
    fallback: (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
      >
        Custom inline fallback markup supplied by the call site.
      </div>
    ),
    children: <ThrowOnMount />,
  },
};
