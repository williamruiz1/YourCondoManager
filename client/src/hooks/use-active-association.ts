import { useMemo } from "react";
import { useAssociationContext } from "@/context/association-context";

export function useActiveAssociation() {
  const { associations, activeAssociationId, associationResolved, setActiveAssociationId } = useAssociationContext();

  const activeAssociation = useMemo(
    () => associations.find((association) => association.id === activeAssociationId) ?? null,
    [associations, activeAssociationId],
  );

  return {
    associations,
    activeAssociationId,
    associationResolved,
    activeAssociation,
    activeAssociationName: activeAssociation?.name ?? "",
    setActiveAssociationId,
  };
}
