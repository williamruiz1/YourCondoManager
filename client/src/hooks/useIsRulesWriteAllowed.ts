/**
 * 4.3 Q6 — `useIsRulesWriteAllowed(associationId)`
 *
 * Hook for gating assessment-rule write UI (Edit / Delete / Create buttons
 * on `/app/financial/rules`) based on the caller's admin role and the
 * per-association `assessment_rules_write` PM toggle.
 *
 * Matrix (mirrors `canAssessmentRulesWrite` on the server):
 *   - Manager / Board Officer / PM Assistant / Platform Admin → always ON.
 *   - Assisted Board → ON only when the PM toggle is ON for this association.
 *   - Viewer → always OFF.
 *
 * The hook falls back to `false` (deny) while loading or on error so UI
 * surfaces default to read-only. Server always re-validates on write —
 * this hook is strictly presentational.
 */

import { useQuery } from "@tanstack/react-query";

import { useAdminRole } from "./useAdminRole";

interface PmTogglesResponse {
  toggles: { assessment_rules_write: boolean };
}

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
    role === "board-officer" ||
    role === "pm-assistant";

  // Roles with never-write — short-circuit to deny.
  const unconditionalDenyRole = role === "viewer" || role == null;

  // Only Assisted Board hits the toggle endpoint.
  const shouldQueryToggle =
    role === "assisted-board" &&
    typeof associationId === "string" &&
    associationId.length > 0;

  const { data, isLoading: toggleLoading } = useQuery<PmTogglesResponse>({
    queryKey: ["pm-toggles", associationId ?? null],
    enabled: shouldQueryToggle,
    staleTime: 30_000,
  });

  if (adminLoading) {
    return { allowed: false, isLoading: true };
  }

  if (unconditionalWriteRole) {
    return { allowed: true, isLoading: false };
  }

  if (unconditionalDenyRole) {
    return { allowed: false, isLoading: false };
  }

  // Assisted Board path.
  if (!shouldQueryToggle) {
    return { allowed: false, isLoading: false };
  }

  if (toggleLoading) {
    return { allowed: false, isLoading: true };
  }

  return {
    allowed: data?.toggles?.assessment_rules_write === true,
    isLoading: false,
  };
}
