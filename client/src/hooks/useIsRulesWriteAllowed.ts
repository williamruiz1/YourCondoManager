/**
 * 4.3 Q6 — `useIsRulesWriteAllowed(associationId)`
 *
 * Hook for gating assessment-rule write UI (Edit / Delete / Create buttons
 * on `/app/financial/rules`) based on the caller's admin role and the
 * per-association `assessment_rules_write` PM toggle.
 *
 * Matrix (mirrors `canAssessmentRulesWrite` on the server):
 *   - Manager / Board Officer / Platform Admin → always ON.
 *   - Assisted Board / PM Assistant → ON only when their role-specific PM
 *     toggle is ON for this association.
 *   - Viewer → always OFF.
 *
 * The hook falls back to `false` (deny) while loading or on error so UI
 * surfaces default to read-only. Server always re-validates on write —
 * this hook is strictly presentational.
 */

import { useAdminRole } from "./useAdminRole";
import { useAssistedBoardAccess } from "./use-assisted-board-access";

export function useIsRulesWriteAllowed(
  associationId: string | null | undefined,
): {
  allowed: boolean;
  isLoading: boolean;
} {
  const { role, authResolved } = useAdminRole();
  const adminLoading = !authResolved;

  // Roles with unconditional write access — never query the toggle.
  const unconditionalWriteRole =
    role === "platform-admin" ||
    role === "manager" ||
    role === "board-officer";

  // Roles with never-write — short-circuit to deny.
  const unconditionalDenyRole = role === "viewer" || role == null;

  // Delegated personas hit their role-specific toggle endpoint.
  const shouldQueryToggle =
    (role === "assisted-board" || role === "pm-assistant") &&
    typeof associationId === "string" &&
    associationId.length > 0;

  const { access, isLoading: toggleLoading } = useAssistedBoardAccess(
    associationId,
    role === "pm-assistant" ? "pm-assistant" : "assisted-board",
    shouldQueryToggle,
  );

  if (adminLoading) {
    return { allowed: false, isLoading: true };
  }

  if (unconditionalWriteRole) {
    return { allowed: true, isLoading: false };
  }

  if (unconditionalDenyRole) {
    return { allowed: false, isLoading: false };
  }

  // Delegated-persona path.
  if (!shouldQueryToggle) {
    return { allowed: false, isLoading: false };
  }

  if (toggleLoading) {
    return { allowed: false, isLoading: true };
  }

  return {
    allowed: access["financials.assessment-rules"].write,
    isLoading: false,
  };
}
