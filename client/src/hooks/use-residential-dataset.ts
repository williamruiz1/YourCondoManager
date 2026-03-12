import { useQuery } from "@tanstack/react-query";
import type { ResidentialDataset } from "@shared/schema";

export function useResidentialDataset() {
  return useQuery<ResidentialDataset>({
    queryKey: ["/api/residential/dataset"],
  });
}
