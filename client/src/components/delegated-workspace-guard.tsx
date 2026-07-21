import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";

import { useActiveAssociation } from "@/hooks/use-active-association";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAssistedBoardAccess } from "@/hooks/use-assisted-board-access";
import {
  type AssistedBoardAccessMatrix,
  delegatedFeatureForRoute,
  hasAnyDelegatedView,
  hasDelegatedViewInZone,
} from "@shared/delegated-feature-access";
import type { AdminRole } from "@shared/schema";

const PERSONAL_ROUTES = new Set(["/app", "/app/help-center", "/app/associations"]);
const NON_DELEGABLE_PREFIXES = [
  "/app/admin",
  "/app/ai",
  "/app/platform",
  "/app/settings/billing",
] as const;

function aggregateRouteAllowed(
  route: string,
  access: ReturnType<typeof useAssistedBoardAccess>["access"],
): boolean | null {
  if (route === "/app/financials") return hasDelegatedViewInZone(access, "Financials");
  if (route === "/app/operations") return hasDelegatedViewInZone(access, "Operations");
  if (route === "/app/governance") return hasDelegatedViewInZone(access, "Governance");
  if (route === "/app/communications") return hasDelegatedViewInZone(access, "Communications");
  if (route === "/app/portfolio" || route === "/app/association-context") {
    return hasAnyDelegatedView(access);
  }
  return null;
}

export function delegatedWorkspaceRouteAllowed(
  role: AdminRole,
  route: string,
  access: AssistedBoardAccessMatrix,
): boolean {
  if (role !== "assisted-board" && role !== "pm-assistant") return true;
  if (NON_DELEGABLE_PREFIXES.some((prefix) => route.startsWith(prefix))) return false;
  if (PERSONAL_ROUTES.has(route)) return true;
  const aggregate = aggregateRouteAllowed(route, access);
  if (aggregate !== null) return aggregate;
  const featureId = delegatedFeatureForRoute(route);
  if (featureId) return access[featureId].view;
  return role === "assisted-board";
}

/**
 * Page-level defense in depth for delegated personas. The matrix is returned
 * by the same server-side authorization source that protects direct API
 * requests, alerts, and notifications. PM Assistant routes that are not
 * explicitly mapped fail closed; Assisted Board keeps its shipped behavior.
 */
export function DelegatedWorkspaceGuard({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { role, authResolved } = useAdminRole();
  const { activeAssociationId, associationResolved } = useActiveAssociation();
  const delegatedRole = role === "pm-assistant" ? "pm-assistant" : "assisted-board";
  const isDelegated = role === "assisted-board" || role === "pm-assistant";
  const { access, isLoading } = useAssistedBoardAccess(
    activeAssociationId,
    delegatedRole,
    isDelegated && Boolean(activeAssociationId),
  );

  const allowed = delegatedWorkspaceRouteAllowed(role, location, access);

  const resolved = authResolved
    && (!isDelegated || !activeAssociationId || (associationResolved && !isLoading));

  useEffect(() => {
    if (resolved && !allowed && location !== "/app") navigate("/app");
  }, [allowed, location, navigate, resolved]);

  if (!resolved || !allowed) return null;
  return <>{children}</>;
}
