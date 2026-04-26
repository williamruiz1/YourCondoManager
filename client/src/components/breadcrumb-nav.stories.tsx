// Wave 37 — Storybook coverage for <BreadcrumbNav>.
//
// Spec: docs/projects/platform-overhaul/decisions/1.3-breadcrumb-label-audit.md
//
// Three trail shapes — two-level (hub), three-level (page within
// zone), and the association-scoped pattern with the active
// association name as the root.

import type { Meta, StoryObj } from "@storybook/react-vite";

import { BreadcrumbNav } from "./breadcrumb-nav";

const meta: Meta<typeof BreadcrumbNav> = {
  title: "Shared/BreadcrumbNav",
  component: BreadcrumbNav,
};

export default meta;

type Story = StoryObj<typeof BreadcrumbNav>;

export const TwoLevel: Story = {
  args: {
    trail: [
      { label: "Communications", href: "/app/communications" },
      { label: "Inbox" },
    ],
  },
};

export const ThreeLevel: Story = {
  args: {
    trail: [
      { label: "Operations", href: "/app/operations" },
      { label: "Work Orders", href: "/app/work-orders" },
      { label: "WO-1024" },
    ],
  },
};

export const AssociationScoped: Story = {
  args: {
    trail: [
      { label: "Maple Court HOA", href: "/app/portfolio/maple-court" },
      { label: "Financials", href: "/app/financial" },
      { label: "Owner Ledger" },
    ],
  },
};
