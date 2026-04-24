// 4.2 Q3 addendum (3a): pure auth predicate for the per-association amenities
// feature toggle. Extracted so server routes and unit tests share a single
// source of truth.
//
// Rules:
//   - platform-admin: always allowed.
//   - manager: allowed when the target association is in the admin scope.
//   - board-officer: allowed when (a) the target association is in the admin
//     scope AND (b) the association is self-managed.
//   - Any other role (assisted-board, pm-assistant, viewer, owner portal):
//     denied.

export type AmenitiesToggleRole =
  | "platform-admin"
  | "board-officer"
  | "assisted-board"
  | "pm-assistant"
  | "manager"
  | "viewer"
  | null
  | undefined;

export interface AmenitiesToggleAuthInput {
  role: AmenitiesToggleRole;
  associationId: string;
  scopedAssociationIds: string[];
  /** Tenant-config managementType for the target association. */
  managementType?: string | null;
}

export type AmenitiesToggleAuthResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function checkAmenitiesToggleAuth(input: AmenitiesToggleAuthInput): AmenitiesToggleAuthResult {
  const { role, associationId, scopedAssociationIds, managementType } = input;

  if (!associationId) {
    return { allowed: false, reason: "associationId is required" };
  }
  if (!role) {
    return { allowed: false, reason: "Not authenticated" };
  }

  if (role === "platform-admin") return { allowed: true };

  if (role === "manager") {
    if (scopedAssociationIds.includes(associationId)) return { allowed: true };
    return { allowed: false, reason: "Association is outside admin scope" };
  }

  if (role === "board-officer") {
    if (!scopedAssociationIds.includes(associationId)) {
      return { allowed: false, reason: "Association is outside admin scope" };
    }
    const normalizedType = managementType ?? "self-managed";
    if (normalizedType === "self-managed") return { allowed: true };
    return { allowed: false, reason: "Board-officer toggle is limited to self-managed associations" };
  }

  return { allowed: false, reason: "Role may not toggle amenities feature" };
}
