import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Association } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

const STORAGE_KEY = "activeAssociationId";

type AssociationContextValue = {
  associations: Association[];
  activeAssociationId: string;
  /** True once associations have loaded and activeAssociationId is confirmed valid (or corrected). */
  associationResolved: boolean;
  setActiveAssociationId: (associationId: string) => void;
};

const AssociationContext = createContext<AssociationContextValue>({
  associations: [],
  activeAssociationId: "",
  associationResolved: false,
  setActiveAssociationId: () => {},
});

export function AssociationProvider({ children }: { children: React.ReactNode }) {
  const { data: associations = [], isFetched } = useQuery<Association[]>({ queryKey: ["/api/associations"] });
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

  // associationResolved: true once the server has returned associations and the
  // active ID is confirmed to be in scope (or has been auto-corrected to first valid).
  const associationResolved = useMemo(() => {
    if (!isFetched) return false;
    if (!associations.length) return true; // no associations in scope — resolved (empty)
    return associations.some((assoc) => assoc.id === activeAssociationId);
  }, [isFetched, associations, activeAssociationId]);

  const value = useMemo<AssociationContextValue>(
    () => ({
      associations,
      activeAssociationId,
      associationResolved,
      setActiveAssociationId: (associationId: string) => {
        if (!associationId || associationId === activeAssociationId) return;
        setActiveAssociationIdState(associationId);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, associationId);
        }
        queryClient.invalidateQueries();
      },
    }),
    [associations, activeAssociationId, associationResolved],
  );

  return <AssociationContext.Provider value={value}>{children}</AssociationContext.Provider>;
}

export function useAssociationContext() {
  return useContext(AssociationContext);
}
