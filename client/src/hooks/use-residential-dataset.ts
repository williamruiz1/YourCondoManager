import { useQuery } from "@tanstack/react-query";
import type { ResidentialDataset } from "@shared/schema";

export function useResidentialDataset(associationId?: string) {
  const queryKey = associationId
    ? `/api/residential/dataset?associationId=${associationId}`
    : "/api/residential/dataset";
  return useQuery<ResidentialDataset>({
    queryKey: [queryKey],
  });
}
