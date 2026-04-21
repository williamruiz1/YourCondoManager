/**
 * Phase 10 parity-harness skeleton — persona fixture coherence.
 *
 * Asserts the canonical test fixtures landed in Wave 16
 * (tests/fixtures/personas.ts) match the 0.2 Persona Boundary Matrix:
 *   - 6 operator personas (AdminRole values)
 *   - 1 portal persona (owner) as a separate export
 *
 * These are pure data-level assertions — no component rendering.
 */

import { describe, it, expect } from "vitest";
import {
  MOCK_ADMINS,
  MOCK_OWNER,
  ALL_PERSONAS,
  FIXTURE_ASSOCIATION_IDS,
  type AdminRole,
} from "../fixtures/personas";
import { ALL_ADMIN_ROLES } from "../utils/auth-helpers";

describe("parity: persona-fixtures — MOCK_ADMINS shape", () => {
  it("has exactly 6 keys (the six operator personas)", () => {
    const keys = Object.keys(MOCK_ADMINS);
    expect(keys).toHaveLength(6);
  });

  it("keys match exactly the AdminRole enum values", () => {
    const keys = Object.keys(MOCK_ADMINS).sort();
    const expected = [...ALL_ADMIN_ROLES].sort();
    expect(keys).toEqual(expected);
  });

  it("every fixture's role matches its key", () => {
    for (const [key, user] of Object.entries(MOCK_ADMINS)) {
      expect(user.role, `Fixture under key "${key}" has role "${user.role}"`).toBe(key);
    }
  });

  it("every fixture has isActive === 1", () => {
    for (const user of Object.values(MOCK_ADMINS)) {
      expect(user.isActive).toBe(1);
    }
  });

  it("every fixture has a unique id", () => {
    const ids = Object.values(MOCK_ADMINS).map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every fixture has a unique email", () => {
    const emails = Object.values(MOCK_ADMINS).map((u) => u.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("every fixture has at least one association id", () => {
    for (const [key, user] of Object.entries(MOCK_ADMINS)) {
      expect(
        user.associationIds.length,
        `Fixture "${key}" has no associations`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("association ids reference known fixture association constants", () => {
    const known = new Set(Object.values(FIXTURE_ASSOCIATION_IDS) as string[]);
    for (const user of Object.values(MOCK_ADMINS)) {
      for (const assocId of user.associationIds) {
        expect(known.has(assocId), `Unknown association id "${assocId}"`).toBe(true);
      }
    }
  });
});

describe("parity: persona-fixtures — MOCK_OWNER shape", () => {
  it("has role === 'owner'", () => {
    expect(MOCK_OWNER.role).toBe("owner");
  });

  it("is active and has at least one association id", () => {
    expect(MOCK_OWNER.isActive).toBe(1);
    expect(MOCK_OWNER.associationIds.length).toBeGreaterThanOrEqual(1);
  });

  it("email is unique from any admin fixture", () => {
    const adminEmails = Object.values(MOCK_ADMINS).map((u) => u.email);
    expect(adminEmails).not.toContain(MOCK_OWNER.email);
  });

  it("id is unique from any admin fixture", () => {
    const adminIds = Object.values(MOCK_ADMINS).map((u) => u.id);
    expect(adminIds).not.toContain(MOCK_OWNER.id);
  });
});

describe("parity: persona-fixtures — ALL_PERSONAS iterator", () => {
  it("has 6 entries", () => {
    expect(ALL_PERSONAS).toHaveLength(6);
  });

  it("every entry's role matches the corresponding MOCK_ADMINS entry", () => {
    for (const { role, user } of ALL_PERSONAS) {
      expect(MOCK_ADMINS[role as AdminRole]).toBe(user);
    }
  });

  it("covers every role in MOCK_ADMINS exactly once", () => {
    const roles = ALL_PERSONAS.map((p) => p.role).sort();
    const expected = Object.keys(MOCK_ADMINS).sort();
    expect(roles).toEqual(expected);
  });
});
