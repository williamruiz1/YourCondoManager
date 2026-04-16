/**
 * Auth session mocking utilities for the 3.3 Q4 parity harness.
 *
 * All six operator personas from 0.2 boundary matrix + Owner portal persona.
 * Imports AdminRole from shared/schema.ts — does NOT define its own role types (AC-9).
 */

import { adminUserRoleEnum } from "../../shared/schema";

/** Canonical AdminRole type derived from the schema enum. */
export type AdminRole = (typeof adminUserRoleEnum.enumValues)[number];

/** All six operator personas from the 0.2 boundary matrix. */
export const ALL_ADMIN_ROLES: AdminRole[] = [
  "platform-admin",
  "manager",
  "board-officer",
  "assisted-board",
  "pm-assistant",
  "viewer",
];

export interface MockAdminSession {
  authenticated: true;
  admin: {
    id: string;
    email: string;
    role: AdminRole;
    isActive: number;
  };
  associationIds: string[];
  scopedAssociationId: string | null;
}

export interface MockPortalSession {
  authenticated: true;
  portal: {
    accessId: string;
    email: string;
    role: string;
    associationId: string;
    personId: string;
    unitId: string;
    hasBoardAccess: boolean;
  };
}

export interface MockUnauthenticatedSession {
  authenticated: false;
}

export type MockSession = MockAdminSession | MockPortalSession | MockUnauthenticatedSession;

/**
 * Create a mock admin session for a given operator role.
 * Uses deterministic test IDs derived from the role name.
 */
export function mockAdminSession(
  role: AdminRole,
  options?: {
    associationIds?: string[];
    scopedAssociationId?: string | null;
    email?: string;
  },
): MockAdminSession {
  return {
    authenticated: true,
    admin: {
      id: `test-admin-${role}`,
      email: options?.email ?? `${role}@test.ycm.dev`,
      role,
      isActive: 1,
    },
    associationIds: options?.associationIds ?? ["test-association-1"],
    scopedAssociationId: options?.scopedAssociationId ?? "test-association-1",
  };
}

/**
 * Create a mock portal session for the Owner persona.
 */
export function mockPortalSession(
  portalRole: string = "owner",
  options?: {
    hasBoardAccess?: boolean;
    associationId?: string;
  },
): MockPortalSession {
  return {
    authenticated: true,
    portal: {
      accessId: `test-portal-${portalRole}`,
      email: `${portalRole}@test.ycm.dev`,
      role: portalRole,
      associationId: options?.associationId ?? "test-association-1",
      personId: "test-person-1",
      unitId: "test-unit-1",
      hasBoardAccess: options?.hasBoardAccess ?? false,
    },
  };
}

/**
 * Create a mock unauthenticated session.
 */
export function mockUnauthenticated(): MockUnauthenticatedSession {
  return { authenticated: false };
}
