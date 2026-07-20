import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/queryClient";
import type {
  AssistedBoardAccessMatrix,
  AssistedBoardToggleKey,
} from "@shared/delegated-feature-access";
import { createDefaultAssistedBoardAccessMatrix } from "@shared/delegated-feature-access";

export interface AssistedBoardAccessResponse {
  toggles: Record<AssistedBoardToggleKey, boolean>;
  access: AssistedBoardAccessMatrix;
  configurable: boolean;
}

export function useAssistedBoardAccess(
  associationId: string | null | undefined,
  enabled = true,
) {
  const query = useQuery<AssistedBoardAccessResponse>({
    queryKey: ["pm-toggles", associationId ?? null],
    enabled: enabled && Boolean(associationId),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/associations/${encodeURIComponent(associationId!)}/pm-toggles`,
      );
      return response.json() as Promise<AssistedBoardAccessResponse>;
    },
  });

  return {
    ...query,
    access: query.data?.access ?? createDefaultAssistedBoardAccessMatrix(),
    toggles: query.data?.toggles ?? {},
  };
}
