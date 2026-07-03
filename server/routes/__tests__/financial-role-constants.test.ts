/**
 * P1-7 — Financial-route role-constant DRIFT GUARD (Issue #214 / dispatch #8537).
 *
 * The sibling `financial-security.test.ts` proves the enforcement works end-to-end
 * on the representative payments route. THIS file locks the *source-of-truth role
 * constants* for every money-mutation surface so a future edit cannot silently
 * widen a gate (e.g. adding `viewer` to disbursements) without turning CI red.
 *
 * It imports the REAL exported constants (not contract copies) — so if someone
 * edits admin-payments.ts / admin-disbursements.ts / admin-reconciliation.ts,
 * these assertions run against the edited value.
 *
 * The 2026-07-03 drift re-audit (dispatch #8537) confirmed zero enforcement gaps
 * across all financial-mutation routes; this suite is the guard that keeps it so.
 */

import { describe, it, expect } from "vitest";
import type { AdminRole } from "@shared/schema";
import {
  RECORD_ROLES,
  REFUND_ROLES,
  DISBURSEMENT_WRITE_ROLES,
  RECON_WRITE_ROLES,
} from "../financial-role-constants";

// The one role that must NEVER be able to mutate any financial state.
const READ_ONLY_ROLE: AdminRole = "viewer";

// Roles that are board/PM members but NOT the treasurer-equivalent — they must
// never be able to POST a payment or move money OUT.
const NON_TREASURER_ROLES: AdminRole[] = ["assisted-board", "pm-assistant"];

const ALL_MONEY_MUTATION_ROLE_SETS: Array<{ name: string; roles: AdminRole[] }> = [
  { name: "RECORD_ROLES (post payment)", roles: RECORD_ROLES },
  { name: "REFUND_ROLES (refund money out)", roles: REFUND_ROLES },
  { name: "DISBURSEMENT_WRITE_ROLES (disburse money out)", roles: DISBURSEMENT_WRITE_ROLES },
  { name: "RECON_WRITE_ROLES (alter ledger reconciliation)", roles: RECON_WRITE_ROLES },
];

describe("P1-7 § Money-mutation role constants — viewer is excluded everywhere", () => {
  it.each(ALL_MONEY_MUTATION_ROLE_SETS)(
    "$name never includes `viewer`",
    ({ roles }) => {
      expect(roles).not.toContain(READ_ONLY_ROLE);
    },
  );

  it("every money-mutation write set is non-empty (fail-closed, but never open)", () => {
    for (const { name, roles } of ALL_MONEY_MUTATION_ROLE_SETS) {
      expect(roles.length, `${name} must gate at least one role`).toBeGreaterThan(0);
    }
  });
});

describe("P1-7 § Payment recording is treasurer-tight", () => {
  it("RECORD_ROLES is exactly platform-admin + board-officer (treasurer-equivalent)", () => {
    // A plain board member (assisted-board), PM, manager, or viewer must NOT be
    // able to post a payment — only the treasurer-equivalent + platform staff.
    expect([...RECORD_ROLES].sort()).toEqual(
      ["board-officer", "platform-admin"].sort(),
    );
  });

  it("RECORD_ROLES excludes every non-treasurer board/PM role", () => {
    for (const role of NON_TREASURER_ROLES) {
      expect(RECORD_ROLES).not.toContain(role);
    }
    expect(RECORD_ROLES).not.toContain("manager");
  });
});

describe("P1-7 § Money-OUT (refund + disbursement) excludes non-officer board roles", () => {
  it("REFUND_ROLES excludes assisted-board + pm-assistant", () => {
    for (const role of NON_TREASURER_ROLES) {
      expect(REFUND_ROLES).not.toContain(role);
    }
  });

  it("DISBURSEMENT_WRITE_ROLES excludes assisted-board + pm-assistant", () => {
    for (const role of NON_TREASURER_ROLES) {
      expect(DISBURSEMENT_WRITE_ROLES).not.toContain(role);
    }
  });

  it("money-OUT sets are a superset gate of platform-admin + board-officer", () => {
    // Both money-out surfaces must at minimum admit the treasurer-equivalent
    // and platform staff — never LESS than that (which would strand the queue).
    for (const roles of [REFUND_ROLES, DISBURSEMENT_WRITE_ROLES]) {
      expect(roles).toContain("platform-admin");
      expect(roles).toContain("board-officer");
    }
  });
});
