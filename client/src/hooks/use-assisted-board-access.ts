import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/queryClient";
import type {
  AssistedBoardAccessMatrix,
  AssistedBoardToggleKey,
  DelegatedTargetRole,
} from "@shared/delegated-feature-access";
import { createDefaultDelegatedAccessMatrix } from "@shared/delegated-feature-access";

export interface AssistedBoardAccessResponse {
  targetRole: DelegatedTargetRole;
  toggles: Record<AssistedBoardToggleKey, boolean>;
  access: AssistedBoardAccessMatrix;
  configurable: boolean;
}

export function useAssistedBoardAccess(
  associationId: string | null | undefined,
  targetRole: DelegatedTargetRole = "assisted-board",
  enabled = true,
) {
  const query = useQuery<AssistedBoardAccessResponse>({
    queryKey: ["pm-toggles", associationId ?? null, targetRole],
    enabled: enabled && Boolean(associationId),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/associations/${encodeURIComponent(associationId!)}/pm-toggles?targetRole=${encodeURIComponent(targetRole)}`,
      );
      return response.json() as Promise<AssistedBoardAccessResponse>;
    },
  });

  return {
    ...query,
    access: query.data?.access ?? createDefaultDelegatedAccessMatrix(targetRole),
    toggles: query.data?.toggles ?? {},
  };
}
