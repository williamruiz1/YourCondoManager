// @zone: (cross-cutting — test infrastructure)
// Canonical test user fixtures per persona. Phase 0b.2 deliverable.
//
// Six operator personas from the 0.2 boundary matrix + Owner portal persona.
// `AdminRole` is derived from `adminUserRoleEnum.enumValues` in shared/schema.ts
// rather than imported as a named type — the schema file exposes the Drizzle
// enum object, not a standalone `AdminRole` type export. This mirrors the
// convention already in tests/utils/auth-helpers.ts (AC-9).

import { adminUserRoleEnum } from "../../shared/schema";

/** Canonical AdminRole type derived from the schema enum. */
export type AdminRole = (typeof adminUserRoleEnum.enumValues)[number];

export interface MockAdminUser {
  id: string;
  email: string;
  role: AdminRole;
  isActive: 1 | 0;
  displayName: string;
  associationIds: string[]; // mock association UUIDs
}

export interface MockPortalUser {
  id: string;
  email: string;
  role: "owner";
  isActive: 1 | 0;
  displayName: string;
  associationIds: string[];
}

// Fixed UUIDs so tests can reference by constant.
export const FIXTURE_ASSOCIATION_IDS = {
  alpha: "00000000-0000-0000-0000-000000000001",
  beta: "00000000-0000-0000-0000-000000000002",
  gamma: "00000000-0000-0000-0000-000000000003",
} as const;

export const MOCK_ADMINS: Record<AdminRole, MockAdminUser> = {
  "platform-admin": {
    id: "00000000-0000-0000-0000-000000000010",
    email: "platform-admin@test.ycm",
    role: "platform-admin",
    isActive: 1,
    displayName: "Platform Admin",
    associationIds: [
      FIXTURE_ASSOCIATION_IDS.alpha,
      FIXTURE_ASSOCIATION_IDS.beta,
      FIXTURE_ASSOCIATION_IDS.gamma,
    ],
  },
  manager: {
    id: "00000000-0000-0000-0000-000000000011",
    email: "manager@test.ycm",
    role: "manager",
    isActive: 1,
    displayName: "Test Manager",
    associationIds: [FIXTURE_ASSOCIATION_IDS.alpha, FIXTURE_ASSOCIATION_IDS.beta],
  },
  "board-officer": {
    id: "00000000-0000-0000-0000-000000000012",
    email: "board-officer@test.ycm",
    role: "board-officer",
    isActive: 1,
    displayName: "Test Board Officer",
    associationIds: [FIXTURE_ASSOCIATION_IDS.alpha],
  },
  "assisted-board": {
    id: "00000000-0000-0000-0000-000000000013",
    email: "assisted-board@test.ycm",
    role: "assisted-board",
    isActive: 1,
    displayName: "Test Assisted Board",
    associationIds: [FIXTURE_ASSOCIATION_IDS.alpha],
  },
  "pm-assistant": {
    id: "00000000-0000-0000-0000-000000000014",
    email: "pm-assistant@test.ycm",
    role: "pm-assistant",
    isActive: 1,
    displayName: "Test PM Assistant",
    associationIds: [FIXTURE_ASSOCIATION_IDS.alpha, FIXTURE_ASSOCIATION_IDS.beta],
  },
  viewer: {
    id: "00000000-0000-0000-0000-000000000015",
    email: "viewer@test.ycm",
    role: "viewer",
    isActive: 1,
    displayName: "Test Viewer",
    associationIds: [FIXTURE_ASSOCIATION_IDS.alpha],
  },
};

export const MOCK_OWNER: MockPortalUser = {
  id: "00000000-0000-0000-0000-000000000020",
  email: "owner@test.ycm",
  role: "owner",
  isActive: 1,
  displayName: "Test Owner",
  associationIds: [FIXTURE_ASSOCIATION_IDS.alpha],
};

// Convenience iterator for parity-harness tests.
export const ALL_PERSONAS: ReadonlyArray<{ role: AdminRole; user: MockAdminUser }> =
  (Object.keys(MOCK_ADMINS) as AdminRole[]).map((role) => ({
    role,
    user: MOCK_ADMINS[role],
  }));
