// founder-os#9487 — The five guided Board-mode actions.
// Single source of truth shared by the Board home cards, the Board sidebar
// quick-actions, and the wizard routes.

import { AlertTriangle, CalendarDays, DollarSign, UserPlus, Wrench, type LucideIcon } from "lucide-react";

export type BoardAction = {
  id: string;
  /** Plain-English action label. */
  label: string;
  /** One-line plain-English description. */
  description: string;
  icon: LucideIcon;
  href: string;
};

export const BOARD_ACTIONS: BoardAction[] = [
  {
    id: "post-charge",
    label: "Bill an owner",
    description: "Add a charge or fine to an owner's account.",
    icon: DollarSign,
    href: "/app/board/post-charge",
  },
  {
    id: "log-violation",
    label: "Log a violation",
    description: "Record that someone broke a community rule.",
    icon: AlertTriangle,
    href: "/app/board/log-violation",
  },
  {
    id: "schedule-meeting",
    label: "Schedule a meeting",
    description: "Put a board or community meeting on the calendar.",
    icon: CalendarDays,
    href: "/app/board/schedule-meeting",
  },
  {
    id: "add-owner",
    label: "Add an owner",
    description: "Add a new owner or resident to your community.",
    icon: UserPlus,
    href: "/app/board/add-owner",
  },
  {
    id: "request-work",
    label: "Request vendor work",
    description: "Create a repair job for a contractor.",
    icon: Wrench,
    href: "/app/board/request-work",
  },
];
