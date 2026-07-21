/**
 * Canonical PM-managed Assisted Board delegation envelope.
 *
 * The locked persona map requires View and Write to be independently
 * configurable per feature and association. Missing database rows resolve to
 * these YCM defaults; an explicit row is an override in either direction.
 *
 * Platform, admin, settings, portfolio, and commercial billing authority are
 * intentionally absent. They are hard boundaries and cannot be granted by a
 * feature toggle.
 */

export type DelegatedPermission = "view" | "write";

/**
 * Personas whose access can be delegated by a Property Manager. The value is
 * persisted with every grant so one persona's envelope can never widen the
 * other persona's access.
 */
export const DELEGATED_TARGET_ROLES = ["assisted-board", "pm-assistant"] as const;
export type DelegatedTargetRole = (typeof DELEGATED_TARGET_ROLES)[number];

export function isDelegatedTargetRole(value: unknown): value is DelegatedTargetRole {
  return typeof value === "string"
    && (DELEGATED_TARGET_ROLES as readonly string[]).includes(value);
}

export const ASSISTED_BOARD_FEATURES = [
  {
    id: "financials.accounting-foundation",
    label: "Accounting foundation",
    zone: "Financials",
    description: "Review or maintain the chart of accounts and accounting setup.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "financials.owner-ledger",
    label: "Owner ledger",
    zone: "Financials",
    description: "Review or operate owner billing, charges, and ledger records.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "financials.payments-reconciliation",
    label: "Payments & reconciliation",
    zone: "Financials",
    description: "Review payments, bank feeds, deposits, and reconciliation records.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "financials.expenses-disbursements",
    label: "Expenses & disbursements",
    zone: "Financials",
    description: "Review expenses, invoices, and authorized disbursement actions.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "financials.reports",
    label: "Financial reports & statements",
    zone: "Financials",
    description: "Review statements, dashboards, and association financial reporting.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "financials.budget-approval",
    label: "Annual budget approval",
    zone: "Financials",
    description: "Review the annual budget and perform board approval actions.",
    defaultView: true,
    defaultWrite: true,
  },
  {
    id: "financials.assessment-rules",
    label: "Assessment rules",
    zone: "Financials",
    description: "Review recurring dues and special-assessment rules.",
    defaultView: true,
    defaultWrite: false,
    legacyWriteToggleKey: "assessment_rules_write",
  },
  {
    id: "governance.meetings-minutes",
    label: "Meetings & minutes",
    zone: "Governance",
    description: "Schedule meetings, manage agendas, and approve minutes.",
    defaultView: true,
    defaultWrite: true,
  },
  {
    id: "governance.documents",
    label: "Governance documents",
    zone: "Governance",
    description: "Review bylaws, rules, resolutions, and board documents.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "governance.board",
    label: "Board directory",
    zone: "Governance",
    description: "Review current board seats and officer information.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "governance.elections",
    label: "Elections",
    zone: "Governance",
    description: "Run board elections and publish board-approved results.",
    defaultView: true,
    defaultWrite: true,
  },
  {
    id: "operations.violations-appeals",
    label: "Violations & appeals",
    zone: "Operations",
    description: "Review violations and board-level appeals.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "operations.maintenance-requests",
    label: "Maintenance requests",
    zone: "Operations",
    description: "Review resident requests and capital-project status.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "operations.work-orders",
    label: "Work orders",
    zone: "Operations",
    description: "Coordinate vendor work and operational execution.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "operations.vendor-contracts",
    label: "Vendor contracts",
    zone: "Operations",
    description: "Review vendor contracts and perform board approval actions.",
    defaultView: true,
    defaultWrite: true,
  },
  {
    id: "operations.vendor-management",
    label: "Vendor management",
    zone: "Operations",
    description: "Create vendors and manage operational vendor records.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "operations.owner-directory",
    label: "Owner directory",
    zone: "Operations",
    description: "Use the limited board-safe owner contact directory.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "operations.unit-management",
    label: "Unit management",
    zone: "Operations",
    description: "Create and edit buildings, units, ownership, and occupancy records.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "operations.inspections",
    label: "Inspections",
    zone: "Operations",
    description: "Create and manage property inspections.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "operations.insurance",
    label: "Insurance oversight",
    zone: "Operations",
    description: "Review association insurance coverage and expirations.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "operations.resident-feedback",
    label: "Resident feedback",
    zone: "Operations",
    description: "Review resident feedback and board-facing follow-up.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "communications.inbox",
    label: "Communications inbox",
    zone: "Communications",
    description: "Review association communications and owner messages.",
    defaultView: true,
    defaultWrite: false,
  },
  {
    id: "communications.announcements",
    label: "Announcements",
    zone: "Communications",
    description: "Publish board policy and community announcements.",
    defaultView: true,
    defaultWrite: true,
  },
  {
    id: "communications.amenities",
    label: "Amenity administration",
    zone: "Communications",
    description: "Manage amenities, reservations, and blocks when an association uses amenities.",
    defaultView: false,
    defaultWrite: false,
  },
  {
    id: "communications.community-hub",
    label: "Community Hub content",
    zone: "Communications",
    description: "Review public community information and notices.",
    defaultView: true,
    defaultWrite: false,
  },
] as const;

export type AssistedBoardFeatureId = (typeof ASSISTED_BOARD_FEATURES)[number]["id"];

export type AssistedBoardToggleKey =
  | `${AssistedBoardFeatureId}.view`
  | `${AssistedBoardFeatureId}.write`
  | "assessment_rules_write";

export const ASSISTED_BOARD_FEATURE_IDS = ASSISTED_BOARD_FEATURES.map(
  (feature) => feature.id,
) as readonly AssistedBoardFeatureId[];

export const ASSISTED_BOARD_TOGGLE_KEYS = Array.from(
  new Set(
    ASSISTED_BOARD_FEATURES.flatMap((feature) => [
      `${feature.id}.view`,
      "legacyWriteToggleKey" in feature && feature.legacyWriteToggleKey
        ? feature.legacyWriteToggleKey
        : `${feature.id}.write`,
    ]),
  ),
) as readonly AssistedBoardToggleKey[];

export function isAssistedBoardFeatureId(value: unknown): value is AssistedBoardFeatureId {
  return typeof value === "string"
    && (ASSISTED_BOARD_FEATURE_IDS as readonly string[]).includes(value);
}

export function isAssistedBoardToggleKey(value: unknown): value is AssistedBoardToggleKey {
  return typeof value === "string"
    && (ASSISTED_BOARD_TOGGLE_KEYS as readonly string[]).includes(value);
}

export function delegatedToggleKey(
  featureId: AssistedBoardFeatureId,
  permission: DelegatedPermission,
): AssistedBoardToggleKey {
  const feature = ASSISTED_BOARD_FEATURES.find((entry) => entry.id === featureId);
  if (
    permission === "write"
    && feature
    && "legacyWriteToggleKey" in feature
    && feature.legacyWriteToggleKey
  ) {
    return feature.legacyWriteToggleKey;
  }
  return `${featureId}.${permission}` as AssistedBoardToggleKey;
}

export function delegatedToggleDescriptor(
  toggleKey: AssistedBoardToggleKey,
): { featureId: AssistedBoardFeatureId; permission: DelegatedPermission } | null {
  for (const feature of ASSISTED_BOARD_FEATURES) {
    if (delegatedToggleKey(feature.id, "view") === toggleKey) {
      return { featureId: feature.id, permission: "view" };
    }
    if (delegatedToggleKey(feature.id, "write") === toggleKey) {
      return { featureId: feature.id, permission: "write" };
    }
  }
  return null;
}

export function assistedBoardDefaultAccess(
  featureId: AssistedBoardFeatureId,
  permission: DelegatedPermission,
): boolean {
  const feature = ASSISTED_BOARD_FEATURES.find((entry) => entry.id === featureId);
  if (!feature) return false;
  return permission === "view" ? feature.defaultView : feature.defaultWrite;
}

/**
 * Missing PM Assistant grants always deny. Assisted Board retains the locked
 * defaults that existed before target-role delegation was introduced.
 */
export function delegatedDefaultAccess(
  targetRole: DelegatedTargetRole,
  featureId: AssistedBoardFeatureId,
  permission: DelegatedPermission,
): boolean {
  if (targetRole === "pm-assistant") return false;
  return assistedBoardDefaultAccess(featureId, permission);
}

export type AssistedBoardAccessMatrix = Readonly<
  Record<AssistedBoardFeatureId, Readonly<Record<DelegatedPermission, boolean>>>
>;

export function createDefaultAssistedBoardAccessMatrix(): AssistedBoardAccessMatrix {
  return Object.fromEntries(
    ASSISTED_BOARD_FEATURES.map((feature) => [
      feature.id,
      {
        view: feature.defaultView,
        write: feature.defaultWrite,
      },
    ]),
  ) as AssistedBoardAccessMatrix;
}

export function createDefaultDelegatedAccessMatrix(
  targetRole: DelegatedTargetRole,
): AssistedBoardAccessMatrix {
  if (targetRole === "assisted-board") {
    return createDefaultAssistedBoardAccessMatrix();
  }
  return Object.fromEntries(
    ASSISTED_BOARD_FEATURES.map((feature) => [
      feature.id,
      { view: false, write: false },
    ]),
  ) as AssistedBoardAccessMatrix;
}

/** Canonical page-to-feature map used by both RouteGuard and navigation. */
export const DELEGATED_ROUTE_FEATURES: Readonly<
  Partial<Record<string, AssistedBoardFeatureId>>
> = {
  "/app/financial/foundation": "financials.accounting-foundation",
  "/app/financial/bank-connections": "financials.payments-reconciliation",
  "/app/financial/rules": "financials.assessment-rules",
  "/app/financial/billing": "financials.owner-ledger",
  "/app/financial/payments": "financials.payments-reconciliation",
  "/app/financial/expenses": "financials.expenses-disbursements",
  "/app/financial/reports": "financials.reports",
  "/app/financial/statements": "financials.reports",
  "/app/financial/ar-aging": "financials.reports",
  "/app/financial/statement": "financials.reports",
  "/app/units": "operations.unit-management",
  "/app/persons": "operations.owner-directory",
  "/app/work-orders": "operations.work-orders",
  "/app/violations": "operations.violations-appeals",
  "/app/maintenance-schedules": "operations.maintenance-requests",
  "/app/inspections": "operations.inspections",
  "/app/vendors": "operations.vendor-contracts",
  "/app/insurance": "operations.insurance",
  "/app/resident-feedback": "operations.resident-feedback",
  "/app/board": "governance.board",
  "/app/governance": "governance.meetings-minutes",
  "/app/documents": "governance.documents",
  "/app/communications": "communications.inbox",
  "/app/communications/inbox": "communications.inbox",
  "/app/announcements": "communications.announcements",
  "/app/amenities": "communications.amenities",
  "/app/community-hub": "communications.community-hub",
};

export function delegatedFeatureForRoute(
  route: string,
): AssistedBoardFeatureId | null {
  const exact = DELEGATED_ROUTE_FEATURES[route];
  if (exact) return exact;
  if (route.startsWith("/app/governance/elections/")) return "governance.elections";
  if (route.startsWith("/app/financial/statement/")) return "financials.reports";
  return null;
}

export function hasAnyDelegatedView(access: AssistedBoardAccessMatrix): boolean {
  return Object.values(access).some((permissions) => permissions.view);
}

export function hasDelegatedViewInZone(
  access: AssistedBoardAccessMatrix,
  zone: (typeof ASSISTED_BOARD_FEATURES)[number]["zone"],
): boolean {
  return ASSISTED_BOARD_FEATURES.some(
    (feature) => feature.zone === zone && access[feature.id].view,
  );
}
