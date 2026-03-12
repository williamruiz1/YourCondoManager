import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Association } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

const STORAGE_KEY = "activeAssociationId";

type AssociationContextValue = {
  associations: Association[];
  activeAssociationId: string;
  setActiveAssociationId: (associationId: string) => void;
};

const AssociationContext = createContext<AssociationContextValue>({
  associations: [],
  activeAssociationId: "",
  setActiveAssociationId: () => {},
});

export function AssociationProvider({ children }: { children: React.ReactNode }) {
  const { data: associations = [] } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
  const [activeAssociationId, setActiveAssociationIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_KEY) || "";
  });

  useEffect(() => {
    if (!associations.length) return;
    const currentExists = associations.some((assoc) => assoc.id === activeAssociationId);
    if (currentExists) return;
    const next = associations[0]?.id ?? "";
    if (next) {
      setActiveAssociationIdState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      queryClient.invalidateQueries();
    }
  }, [associations, activeAssociationId]);

  const value = useMemo<AssociationContextValue>(
    () => ({
      associations,
      activeAssociationId,
      setActiveAssociationId: (associationId: string) => {
        if (!associationId || associationId === activeAssociationId) return;
        setActiveAssociationIdState(associationId);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, associationId);
        }
        queryClient.invalidateQueries();
      },
    }),
    [associations, activeAssociationId],
  );

  return <AssociationContext.Provider value={value}>{children}</AssociationContext.Provider>;
}

export function useAssociationContext() {
  return useContext(AssociationContext);
}
