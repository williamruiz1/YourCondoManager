// Wave 37 — Storybook coverage for the shared <EmptyState>.
//
// Spec: docs/projects/platform-overhaul/decisions/5.1-empty-states.md
//
// Three states cover the practical permutations: no CTA at all
// (read-only zones), CTA wired to an in-app route, and the still-
// supported "title only" form (no description, no CTA).

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox } from "lucide-react";

import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Shared/EmptyState",
  component: EmptyState,
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: Inbox,
    title: "No notices yet",
    description:
      "Once a manager publishes a notice, it will appear in this archive.",
  },
};

export const WithCTA: Story = {
  args: {
    icon: Inbox,
    title: "No notices yet",
    description:
      "Send your first announcement to start building the archive.",
    cta: { label: "Compose notice", href: "/app/communications/notices/new" },
  },
};

export const NoIcon: Story = {
  args: {
    // EmptyState requires an icon, so the "no description" / "no CTA" form
    // is what call sites reach for when the title is enough on its own.
    icon: Inbox,
    title: "All caught up",
  },
};
