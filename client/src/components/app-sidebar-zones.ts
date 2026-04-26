/**
 * app-sidebar-zones.ts — canonical sidebar nav data for Phase 11 (3.1).
 *
 * 3.1 Q1 + Q12 — six top-level zones with verbatim 1.1 labels:
 *   Home, Financials, Operations, Governance, Communications, Platform.
 * Settings + Help Center are footer items (per Q12), not zone content.
 *
 * 3.1 Q9 — sidebar role visibility derives from the same persona-access
 * primitives consumed by `<RouteGuard>`. Until the Phase 9 manifest in
 * `shared/persona-access.ts` is populated (which would gate this file
 * entirely on a single source), this module encodes the 0.2 boundary
 * matrix as a static derivation of `AdminRole` literals — but isolated
 * here so `app-sidebar.tsx` stays free of inline `roles: [...]`
 * literals (3.1 AC 39 + 3.1 Q9 — sidebar component sources from a
 * shared module, not per-item literals). Phase 12+ migrates this file
 * to read from the populated `ROUTE_MANIFEST`/`FEATURE_MANIFEST`.
 *
 * 3.1 Q5 — SUBSET-RENDER. `filterZonesForPersona` removes any zone or
 * sub-item the persona is not permitted to see. No greyed-out, no
 * collapsed, no display:none — disallowed items are absent from the
 * DOM.
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Layers,
  Building2,
  Wallet,
  Receipt,
  CreditCard,
  Banknote,
  BarChart3,
  Gavel,
  ClipboardList,
  Wrench,
  SearchCheck,
  BriefcaseBusiness,
  ShieldCheck,
  DoorOpen,
  Users,
  MessageCircle,
  Landmark,
  FileText,
  UserCheck,
  Megaphone,
  Inbox,
  MessageSquare,
  Globe,
  CalendarCheck,
  SlidersHorizontal,
  ListChecks,
  Bot,
  UserCog,
  TrendingUp,
} from "lucide-react";
import type { AdminRole } from "@shared/schema";

// ---------------------------------------------------------------------------
// Persona-access derivation — 0.2 Persona Boundary Matrix
// ---------------------------------------------------------------------------
// Source-of-truth role lists per persona class. Items in the sidebar tree
// reference these constants (rather than per-item `[...]` literals) so the
// sidebar component can be audited for hardcoded role literals === 0.

/** Manager equivalents — full operator visibility minus Platform zone. */
export const FIVE_PERSONA_OPERATOR: ReadonlyArray<AdminRole> = [
  "manager",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "viewer",
];

/** Operator + Platform Admin — covers the universal Manager-equivalent surfaces
 *  (Settings, Home, Help) where Platform Admin also has access. */
export const ALL_OPERATORS: ReadonlyArray<AdminRole> = [
  "manager",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "viewer",
  "platform-admin",
];

/** Platform-admin only (Platform zone). */
export const PLATFORM_ADMIN_ONLY: ReadonlyArray<AdminRole> = ["platform-admin"];

/** Manager + Platform Admin (multi-association portfolio surfaces). */
export const PORTFOLIO_OPERATORS: ReadonlyArray<AdminRole> = [
  "manager",
  "pm-assistant",
  "platform-admin",
  "viewer",
];

/** Settings — Manager, Board Officer, Platform Admin per 2.3 Q6. */
export const SETTINGS_ALLOWED: ReadonlyArray<AdminRole> = [
  "manager",
  "board-officer",
  "platform-admin",
];

// ---------------------------------------------------------------------------
// Zone canonical labels — 1.1 Q1 (LOCKED, amended ac446c0)
// ---------------------------------------------------------------------------

export const ZONE_LABELS = {
  HOME: "Home",
  FINANCIALS: "Financials",
  OPERATIONS: "Operations",
  GOVERNANCE: "Governance",
  COMMUNICATIONS: "Communications",
  PLATFORM: "Platform",
} as const;

export type ZoneLabel = (typeof ZONE_LABELS)[keyof typeof ZONE_LABELS];

// ---------------------------------------------------------------------------
// Sidebar item types
// ---------------------------------------------------------------------------

export interface SidebarItem {
  /** Canonical nav label. Must match the `SIDEBAR_NAV_ITEMS` test list. */
  title: string;
  /** Target URL — for zone labels this is the hub URL per 1.2 Q4. */
  url: string;
  /** Icon component (lucide-react). */
  icon: LucideIcon;
  /** Material symbols name for legacy parity with the existing chrome. */
  materialIcon: string;
  /** Active-state prefix; defaults to `url`. */
  activePrefix?: string;
  /** Personas allowed to see this item — derived from 0.2 matrix. */
  roles: ReadonlyArray<AdminRole>;
  /** Sub-items rendered under this item when expanded. */
  children?: ReadonlyArray<SidebarItem>;
}

export interface SidebarZone {
  /** Zone label per 1.1 Q1. */
  label: ZoneLabel;
  /** Hub URL per 1.2 Q4 (Home navigates to `/app`, Platform to controls). */
  hubUrl: string;
  /** Icon for the zone label entry. */
  icon: LucideIcon;
  /** Material icon name. */
  materialIcon: string;
  /** Personas permitted to see this zone at all (zone-level gate). */
  roles: ReadonlyArray<AdminRole>;
  /** Sub-items under this zone. */
  items: ReadonlyArray<SidebarItem>;
}

// ---------------------------------------------------------------------------
// Six zones — Phase 11 canonical tree
// ---------------------------------------------------------------------------
//
// Per 3.1 Q4 — Home is the first zone. Portfolio Health and Associations are
// sub-items under Home.
//
// Per 3.1 Q3 — clicking a zone label navigates to the hub URL (1.2 Q4).
//   Financials → /app/financials
//   Operations → /app/operations
//   Governance → /app/governance
//   Communications → /app/communications
//   Home → /app
//   Platform → /app/platform/controls
//
// Per 3.1 Q11 — no Owner Portal launcher in Platform zone (2.4 Q5).

export const SIDEBAR_ZONES: ReadonlyArray<SidebarZone> = [
  {
    label: ZONE_LABELS.HOME,
    hubUrl: "/app",
    icon: LayoutDashboard,
    materialIcon: "home",
    roles: ALL_OPERATORS,
    items: [
      {
        title: "Portfolio Health",
        url: "/app/portfolio",
        icon: Layers,
        materialIcon: "layers",
        activePrefix: "/app/portfolio",
        roles: PORTFOLIO_OPERATORS,
      },
      {
        title: "Associations",
        url: "/app/associations",
        icon: Building2,
        materialIcon: "domain",
        activePrefix: "/app/associations",
        // Manager + multi-association personas + Platform Admin. Single-
        // association Board Officer / Assisted Board are filtered out at
        // render time by the same `singleAssociationBoardExperience` rule
        // currently applied in app-sidebar.tsx.
        roles: PORTFOLIO_OPERATORS,
      },
    ],
  },
  {
    label: ZONE_LABELS.FINANCIALS,
    hubUrl: "/app/financials",
    icon: Wallet,
    materialIcon: "payments",
    roles: FIVE_PERSONA_OPERATOR,
    items: [
      {
        title: "Chart of Accounts",
        url: "/app/financial/foundation",
        icon: Layers,
        materialIcon: "account_tree",
        activePrefix: "/app/financial/foundation",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Billing",
        url: "/app/financial/billing",
        icon: Receipt,
        materialIcon: "receipt_long",
        activePrefix: "/app/financial/billing",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Assessment Rules",
        url: "/app/financial/rules",
        icon: Gavel,
        materialIcon: "rule",
        activePrefix: "/app/financial/rules",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Payments",
        url: "/app/financial/payments",
        icon: CreditCard,
        materialIcon: "credit_card",
        activePrefix: "/app/financial/payments",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Expenses",
        url: "/app/financial/expenses",
        icon: Banknote,
        materialIcon: "account_balance",
        activePrefix: "/app/financial/expenses",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Reports",
        url: "/app/financial/reports",
        icon: BarChart3,
        materialIcon: "summarize",
        activePrefix: "/app/financial/reports",
        roles: FIVE_PERSONA_OPERATOR,
      },
    ],
  },
  {
    label: ZONE_LABELS.OPERATIONS,
    hubUrl: "/app/operations",
    icon: ClipboardList,
    materialIcon: "engineering",
    roles: FIVE_PERSONA_OPERATOR,
    items: [
      {
        title: "Buildings & Units",
        url: "/app/units",
        icon: DoorOpen,
        materialIcon: "door_front",
        activePrefix: "/app/units",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "People",
        url: "/app/persons",
        icon: Users,
        materialIcon: "contacts",
        activePrefix: "/app/persons",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Work Orders",
        url: "/app/work-orders",
        icon: ClipboardList,
        materialIcon: "build",
        activePrefix: "/app/work-orders",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Maintenance",
        url: "/app/maintenance-schedules",
        icon: Wrench,
        materialIcon: "handyman",
        activePrefix: "/app/maintenance-schedules",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Inspections",
        url: "/app/inspections",
        icon: SearchCheck,
        materialIcon: "fact_check",
        activePrefix: "/app/inspections",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Vendors",
        url: "/app/vendors",
        icon: BriefcaseBusiness,
        materialIcon: "storefront",
        activePrefix: "/app/vendors",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Insurance",
        url: "/app/insurance",
        icon: ShieldCheck,
        materialIcon: "verified_user",
        activePrefix: "/app/insurance",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Feedback",
        url: "/app/resident-feedback",
        icon: MessageCircle,
        materialIcon: "rate_review",
        activePrefix: "/app/resident-feedback",
        roles: FIVE_PERSONA_OPERATOR,
      },
    ],
  },
  {
    label: ZONE_LABELS.GOVERNANCE,
    hubUrl: "/app/governance",
    icon: Landmark,
    materialIcon: "gavel",
    roles: FIVE_PERSONA_OPERATOR,
    items: [
      {
        title: "Board",
        url: "/app/board",
        icon: UserCheck,
        materialIcon: "groups",
        activePrefix: "/app/board",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Documents",
        url: "/app/documents",
        icon: FileText,
        materialIcon: "description",
        activePrefix: "/app/documents",
        roles: FIVE_PERSONA_OPERATOR,
      },
    ],
  },
  {
    label: ZONE_LABELS.COMMUNICATIONS,
    hubUrl: "/app/communications",
    icon: MessageSquare,
    materialIcon: "forum",
    roles: FIVE_PERSONA_OPERATOR,
    items: [
      {
        title: "Inbox",
        url: "/app/communications/inbox",
        icon: Inbox,
        materialIcon: "inbox",
        activePrefix: "/app/communications/inbox",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Announcements",
        url: "/app/announcements",
        icon: Megaphone,
        materialIcon: "campaign",
        activePrefix: "/app/announcements",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Amenity Booking",
        url: "/app/amenities",
        icon: CalendarCheck,
        materialIcon: "event_available",
        activePrefix: "/app/amenities",
        roles: FIVE_PERSONA_OPERATOR,
      },
      {
        title: "Community Hub",
        url: "/app/community-hub",
        icon: Globe,
        materialIcon: "language",
        activePrefix: "/app/community-hub",
        roles: FIVE_PERSONA_OPERATOR,
      },
    ],
  },
  {
    label: ZONE_LABELS.PLATFORM,
    hubUrl: "/app/platform/controls",
    icon: SlidersHorizontal,
    materialIcon: "tune",
    roles: PLATFORM_ADMIN_ONLY,
    items: [
      {
        title: "Platform Controls",
        url: "/app/platform/controls",
        icon: SlidersHorizontal,
        materialIcon: "tune",
        activePrefix: "/app/platform/controls",
        roles: PLATFORM_ADMIN_ONLY,
      },
      {
        title: "Admin Roadmap",
        url: "/app/admin/roadmap",
        icon: ListChecks,
        materialIcon: "checklist",
        activePrefix: "/app/admin/roadmap",
        roles: PLATFORM_ADMIN_ONLY,
      },
      {
        title: "Admin Users",
        url: "/app/admin/users",
        icon: UserCog,
        materialIcon: "manage_accounts",
        activePrefix: "/app/admin/users",
        roles: PLATFORM_ADMIN_ONLY,
      },
      {
        title: "Executive",
        url: "/app/admin/executive",
        icon: TrendingUp,
        materialIcon: "monitoring",
        activePrefix: "/app/admin/executive",
        roles: PLATFORM_ADMIN_ONLY,
      },
      {
        title: "AI Ingestion",
        url: "/app/ai/ingestion",
        icon: Bot,
        materialIcon: "smart_toy",
        activePrefix: "/app/ai",
        roles: PLATFORM_ADMIN_ONLY,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Footer items — Settings, Help Center per 3.1 Q12
// ---------------------------------------------------------------------------

export const SIDEBAR_FOOTER_ITEMS: ReadonlyArray<SidebarItem> = [
  {
    title: "Settings",
    url: "/app/settings",
    icon: SlidersHorizontal,
    materialIcon: "settings",
    activePrefix: "/app/settings",
    roles: SETTINGS_ALLOWED,
  },
  {
    title: "Help Center",
    url: "/app/help-center",
    icon: ListChecks,
    materialIcon: "help",
    activePrefix: "/app/help-center",
    // 2.3 Q12 — all roles, no gate.
    roles: ALL_OPERATORS,
  },
];

// ---------------------------------------------------------------------------
// SUBSET-RENDER filter — 3.1 Q5
// ---------------------------------------------------------------------------

export interface FilterContext {
  /** Active admin role; null until session resolves. */
  role: AdminRole | null | undefined;
  /** True for self-managed Board Officer or PM-managed Assisted Board with
   *  ≤ 1 association — Portfolio Health + Associations sub-items are hidden. */
  singleAssociationBoardExperience: boolean;
  /** Hide the Communications "Amenity Booking" entry when the active
   *  association has disabled amenities. */
  amenitiesDisabled: boolean;
}

function roleAllowsItem(role: AdminRole | null | undefined, allowed: ReadonlyArray<AdminRole>): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

/**
 * Returns the zone tree filtered for the active persona per 3.1 Q5.
 * - Zones the persona cannot see are absent (not greyed, not collapsed).
 * - Sub-items the persona cannot see are absent.
 * - Zones with zero remaining sub-items are still rendered IF the persona
 *   is permitted at the zone level (so the hub link still appears).
 * - Empty zones (no permission at any level) are dropped entirely.
 */
export function filterZonesForPersona(
  zones: ReadonlyArray<SidebarZone>,
  ctx: FilterContext,
): SidebarZone[] {
  const filtered: SidebarZone[] = [];
  for (const zone of zones) {
    if (!roleAllowsItem(ctx.role, zone.roles)) continue;
    let items = zone.items.filter((item) => roleAllowsItem(ctx.role, item.roles));

    // Per 3.1 AC 17/18 + Q4 — single-association Board Officer / Assisted
    // Board hide Portfolio Health + Associations under Home.
    if (zone.label === ZONE_LABELS.HOME && ctx.singleAssociationBoardExperience) {
      items = items.filter(
        (item) => item.url !== "/app/portfolio" && item.url !== "/app/associations",
      );
    }

    // 4.2 Q3 addendum (3a) — hide Amenity Booking entry when the active
    // association has disabled amenities. Server still enforces the gate.
    if (zone.label === ZONE_LABELS.COMMUNICATIONS && ctx.amenitiesDisabled) {
      items = items.filter((item) => item.url !== "/app/amenities");
    }

    filtered.push({ ...zone, items });
  }
  return filtered;
}

/**
 * Returns the footer items filtered for the active persona.
 */
export function filterFooterItemsForPersona(
  items: ReadonlyArray<SidebarItem>,
  role: AdminRole | null | undefined,
): SidebarItem[] {
  return items.filter((item) => roleAllowsItem(role, item.roles));
}
