/**
 * Fail-closed Assisted Board mutation envelope.
 *
 * Every authenticated admin mutation passes through this guard from
 * `requireAdmin`. Roles other than Assisted Board keep their existing route
 * authorization. Assisted Board mutations must map to a canonical feature,
 * resolve one association inside the caller's scope, and pass the effective
 * per-association Write permission.
 *
 * An unmapped mutation is denied. That invariant prevents a newly-added route
 * from silently inheriting Assisted Board write authority merely because its
 * local role list was copied from an older broad allow-list.
 */

import type { Request } from "express";

import type { AdminRole } from "@shared/schema";
import type { AssistedBoardFeatureId } from "@shared/delegated-feature-access";
import {
  assertAssociationScope,
  resolveResourceAssociationId,
} from "./lib/tenant-scope";
import { canDelegatedFeatureAccess } from "./pm-toggles";

type DelegatedAdminRequest = Request & {
  adminRole?: AdminRole;
  adminScopedAssociationIds?: string[];
};

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const USER_STATE_MUTATION_ALLOWLIST = [
  /^\/api\/alerts\/[^/]+\/(?:read|dismiss|restore)$/,
] as const;

interface MutationRouteRule {
  featureId: AssistedBoardFeatureId;
  pattern: RegExp;
}

interface ResourceRouteRule {
  pattern: RegExp;
  resourceType: string;
}

const RESOURCE_ROUTE_RULES: readonly ResourceRouteRule[] = [
  { pattern: /^\/api\/buildings\/([^/]+)(?:\/|$)/, resourceType: "building" },
  { pattern: /^\/api\/units\/([^/]+)(?:\/|$)/, resourceType: "unit" },
  { pattern: /^\/api\/persons\/([^/]+)(?:\/|$)/, resourceType: "person" },
  { pattern: /^\/api\/ownerships\/([^/]+)(?:\/|$)/, resourceType: "ownership" },
  { pattern: /^\/api\/occupancies\/([^/]+)(?:\/|$)/, resourceType: "occupancy" },
  { pattern: /^\/api\/work-orders\/([^/]+)(?:\/|$)/, resourceType: "work-order" },
  { pattern: /^\/api\/maintenance\/requests\/([^/]+)(?:\/|$)/, resourceType: "maintenance-request" },
  { pattern: /^\/api\/maintenance\/schedules\/([^/]+)(?:\/|$)/, resourceType: "maintenance-schedule-template" },
  { pattern: /^\/api\/documents\/([^/]+)(?:\/|$)/, resourceType: "document" },
  { pattern: /^\/api\/board-roles\/([^/]+)(?:\/|$)/, resourceType: "board-role" },
  { pattern: /^\/api\/vendors\/([^/]+)(?:\/|$)/, resourceType: "vendor" },
  { pattern: /^\/api\/inspections\/([^/]+)(?:\/|$)/, resourceType: "inspection-record" },
  { pattern: /^\/api\/governance\/meetings\/([^/]+)(?:\/|$)/, resourceType: "governance-meeting" },
  { pattern: /^\/api\/elections\/([^/]+)(?:\/|$)/, resourceType: "election" },
  { pattern: /^\/api\/violations\/(?:management\/)?([^/]+)(?:\/|$)/, resourceType: "violation" },
  { pattern: /^\/api\/announcements\/([^/]+)(?:\/|$)/, resourceType: "community-announcement" },
  { pattern: /^\/api\/resident-feedback\/([^/]+)(?:\/|$)/, resourceType: "resident-feedback" },
  { pattern: /^\/api\/amenities\/([^/]+)(?:\/|$)/, resourceType: "amenity" },
  { pattern: /^\/api\/amenity-reservations\/([^/]+)(?:\/|$)/, resourceType: "amenity-reservation" },
  { pattern: /^\/api\/amenity-blocks\/([^/]+)(?:\/|$)/, resourceType: "amenity-block" },
] as const;

const MUTATION_ROUTE_RULES: readonly MutationRouteRule[] = [
  {
    featureId: "financials.assessment-rules",
    pattern: /^\/api\/financial\/(?:rules|fee-schedules|assessments|recurring-charges)(?:\/|$)/,
  },
  {
    featureId: "financials.reports",
    pattern: /^\/api\/financial\/(?:reports|statements|ar-aging|owner-ledger\/statement)(?:\/|$)/,
  },
  {
    featureId: "financials.budget-approval",
    pattern: /^\/api\/financial\/budget-ratifications(?:\/|$)/,
  },
  {
    featureId: "governance.meetings-minutes",
    pattern: /^\/api\/governance\/(?:meetings|meeting-notes|minutes)(?:\/|$)/,
  },
  {
    featureId: "governance.elections",
    pattern: /^\/api\/(?:elections|governance\/elections)(?:\/|$)/,
  },
  {
    featureId: "governance.documents",
    pattern: /^\/api\/documents(?:\/|$)/,
  },
  {
    featureId: "governance.board",
    pattern: /^\/api\/board-roles(?:\/|$)/,
  },
  {
    featureId: "operations.violations-appeals",
    pattern: /^\/api\/(?:violations|arc|admin\/arc)(?:\/|$)/,
  },
  {
    featureId: "operations.maintenance-requests",
    pattern: /^\/api\/maintenance\/(?:requests|schedules)(?:\/|$)/,
  },
  {
    featureId: "operations.work-orders",
    pattern: /^\/api\/work-orders(?:\/|$)/,
  },
  {
    featureId: "operations.vendor-contracts",
    pattern: /^\/api\/vendors\/[^/]+\/contracts\/[^/]+\/approve(?:\/|$)/,
  },
  {
    featureId: "operations.vendor-management",
    pattern: /^\/api\/vendors(?:\/|$)/,
  },
  {
    featureId: "operations.owner-directory",
    pattern: /^\/api\/(?:persons|owners)(?:\/|$)/,
  },
  {
    featureId: "operations.unit-management",
    pattern: /^\/api\/(?:buildings|units|ownerships|occupancies)(?:\/|$)/,
  },
  {
    featureId: "operations.inspections",
    pattern: /^\/api\/inspections(?:\/|$)/,
  },
  {
    featureId: "operations.insurance",
    pattern: /^\/api\/associations\/[^/]+\/insurance(?:\/|$)/,
  },
  {
    featureId: "operations.resident-feedback",
    pattern: /^\/api\/resident-feedback(?:\/|$)/,
  },
  {
    featureId: "communications.inbox",
    pattern: /^\/api\/communications(?:\/|$)/,
  },
  {
    featureId: "communications.announcements",
    pattern: /^\/api\/announcements(?:\/|$)/,
  },
  {
    featureId: "communications.amenities",
    pattern: /^\/api\/(?:amenities|amenity-reservations|amenity-blocks)(?:\/|$)/,
  },
  {
    featureId: "communications.community-hub",
    pattern: /^\/api\/associations\/[^/]+\/hub(?:\/|$)/,
  },
];

export function resolveAssistedBoardMutationFeature(
  method: string,
  path: string,
): AssistedBoardFeatureId | null {
  if (!MUTATION_METHODS.has(method.toUpperCase())) return null;
  return resolveAssistedBoardRequestFeature(path);
}

export function resolveAssistedBoardRequestFeature(
  path: string,
): AssistedBoardFeatureId | null {
  return MUTATION_ROUTE_RULES.find((rule) => rule.pattern.test(path))?.featureId ?? null;
}

function bodyAssociationId(req: Request): string | undefined {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return undefined;
  const candidate = (req.body as Record<string, unknown>).associationId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

function pathAssociationId(path: string): string | undefined {
  const match = /^\/api\/associations\/([^/]+)(?:\/|$)/.exec(path);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function resolveDelegatedAssociationId(req: DelegatedAdminRequest): string {
  const header = req.get("x-ycm-association-id");
  const query = typeof req.query.associationId === "string"
    ? req.query.associationId
    : undefined;
  const candidate = bodyAssociationId(req) || query || pathAssociationId(req.path) || header;

  if (candidate) {
    assertAssociationScope(req, candidate);
    return candidate;
  }

  const scoped = req.adminScopedAssociationIds ?? [];
  if (scoped.length === 1) return scoped[0];
  if (scoped.length === 0) {
    throw new Error("No association scopes assigned to this admin");
  }
  throw new Error("associationId is required for multi-association Assisted Board mutations");
}

async function resolveDelegatedAssociationForRequest(
  req: DelegatedAdminRequest,
): Promise<string> {
  for (const rule of RESOURCE_ROUTE_RULES) {
    const match = rule.pattern.exec(req.path);
    if (!match?.[1]) continue;
    const associationId = await resolveResourceAssociationId(
      rule.resourceType,
      decodeURIComponent(match[1]),
    );
    if (!associationId) {
      throw new Error("Resource not found or outside your association scope");
    }
    assertAssociationScope(req, associationId);
    return associationId;
  }
  return resolveDelegatedAssociationId(req);
}

export type AssistedBoardMutationDecision =
  | { allowed: true; associationId?: string; featureId?: AssistedBoardFeatureId }
  | {
      allowed: false;
      code:
        | "ASSISTED_BOARD_MUTATION_UNMAPPED"
        | "ASSISTED_BOARD_VIEW_NOT_DELEGATED"
        | "ASSISTED_BOARD_WRITE_NOT_DELEGATED";
      detail: string;
      associationId?: string;
      featureId?: AssistedBoardFeatureId;
    };

export async function evaluateAssistedBoardMutation(
  req: DelegatedAdminRequest,
): Promise<AssistedBoardMutationDecision> {
  if (req.adminRole !== "assisted-board") {
    return { allowed: true };
  }

  const isMutation = MUTATION_METHODS.has(req.method.toUpperCase());
  if (isMutation && USER_STATE_MUTATION_ALLOWLIST.some((pattern) => pattern.test(req.path))) {
    // Alert read-state is personal UI state. The alert ownership gate still
    // enforces association scope and delegated View access before mutation.
    return { allowed: true };
  }

  const featureId = resolveAssistedBoardRequestFeature(req.path);
  if (!featureId) {
    if (!isMutation) return { allowed: true };
    return {
      allowed: false,
      code: "ASSISTED_BOARD_MUTATION_UNMAPPED",
      detail: "This mutation is outside the Manager-configured Assisted Board feature envelope.",
    };
  }

  const associationId = await resolveDelegatedAssociationForRequest(req);
  const allowed = await canDelegatedFeatureAccess(
    req.adminRole,
    associationId,
    featureId,
    isMutation ? "write" : "view",
  );
  if (!allowed) {
    return {
      allowed: false,
      code: isMutation
        ? "ASSISTED_BOARD_WRITE_NOT_DELEGATED"
        : "ASSISTED_BOARD_VIEW_NOT_DELEGATED",
      detail: `${isMutation ? "Write" : "View"} access is not delegated for ${featureId}.`,
      associationId,
      featureId,
    };
  }

  return { allowed: true, associationId, featureId };
}
