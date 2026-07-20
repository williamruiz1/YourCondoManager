import type { AdminRole } from "./schema";

/**
 * Board-scoped operators remain volunteers even when they serve more than one
 * YCM-hosted association. Association count changes the context-switching UI,
 * never the persona or access envelope.
 */
export function isBoardScopedAdminRole(
  role: AdminRole | null | undefined,
): boolean {
  return role === "board-officer" || role === "assisted-board";
}

/**
 * A Board-scoped operator with zero or one association gets a static context
 * label. With multiple authorized associations they get a switcher, while
 * remaining Board-scoped.
 */
export function shouldUseStaticBoardAssociationLabel(
  role: AdminRole | null | undefined,
  associationCount: number,
): boolean {
  return isBoardScopedAdminRole(role) && associationCount <= 1;
}
