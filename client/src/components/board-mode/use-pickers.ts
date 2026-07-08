// founder-os#9487 — Board-mode wizard dropdown data.
//
// The default react-query queryFn uses the queryKey as the URL and auto-appends
// `?associationId=<active>` on GETs, so these return items scoped to the active
// community with no extra wiring.

import { useQuery } from "@tanstack/react-query";

export type UnitOption = { id: string; unitNumber: string; building?: string | null };
export type PersonOption = { id: string; firstName: string; lastName: string; email?: string | null };

export function useUnitOptions() {
  return useQuery<UnitOption[]>({ queryKey: ["/api/units"], staleTime: 60_000 });
}

export function usePersonOptions() {
  return useQuery<PersonOption[]>({ queryKey: ["/api/persons"], staleTime: 60_000 });
}

export function unitLabel(u: UnitOption): string {
  return u.building ? `${u.building} · ${u.unitNumber}` : u.unitNumber;
}

export function personLabel(p: PersonOption): string {
  return `${p.firstName} ${p.lastName}`.trim();
}
