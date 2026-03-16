export type AdminRole = "platform-admin" | "board-admin" | "manager" | "viewer";

const wipRouteRoleAllowlist: Record<string, AdminRole[]> = {
  "/app/ai/ingestion": ["platform-admin"],
};

export function canAccessWipRoute(route: string, role?: AdminRole | null): boolean {
  const allowedRoles = wipRouteRoleAllowlist[route];
  if (!allowedRoles) return true;
  if (!role) return false;
  return allowedRoles.includes(role);
}
