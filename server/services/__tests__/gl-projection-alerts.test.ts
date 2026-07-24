import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  updated: null as Record<string, unknown> | null,
  whereValue: null as unknown,
  conflict: null as Record<string, unknown> | null,
}));

vi.mock("drizzle-orm", () => ({
  eq: (_column: unknown, value: unknown) => ({ kind: "eq", value }),
}));

vi.mock("@shared/schema", () => ({
  financialAlerts: {
    id: "id",
  },
}));

vi.mock("../../db", () => ({
  db: {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        dbMocks.inserted = values;
        return {
          onConflictDoUpdate: (config: Record<string, unknown>) => {
            dbMocks.conflict = config;
            return Promise.resolve();
          },
        };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        dbMocks.updated = values;
        return {
          where: (predicate: unknown) => {
            dbMocks.whereValue = predicate;
            return Promise.resolve();
          },
        };
      },
    }),
  },
}));

import {
  recordGlProjectionFailure,
  resolveGlProjectionFailure,
} from "../gl/projection-alerts";

beforeEach(() => {
  dbMocks.inserted = null;
  dbMocks.updated = null;
  dbMocks.whereValue = null;
  dbMocks.conflict = null;
});

describe("GL projection continuity alerts", () => {
  it("upserts one critical association-scoped alert without owner/payment data", async () => {
    await recordGlProjectionFailure("assoc-1", "error");

    expect(dbMocks.inserted).toEqual(expect.objectContaining({
      id: "gl-projection-assoc-1",
      associationId: "assoc-1",
      alertType: "audit_anomaly",
      severity: "critical",
      entityType: "gl-projection",
      entityId: "owner-ledger-continuity",
      isDismissed: 0,
    }));
    expect(JSON.stringify(dbMocks.inserted)).not.toMatch(
      /personId|unitId|paymentIntent|stripe|amountCents|providerId/i,
    );
    expect(dbMocks.conflict).toEqual(expect.objectContaining({
      target: "id",
    }));
  });

  it("resolves the deterministic alert only after a successful projection", async () => {
    await resolveGlProjectionFailure("assoc-1");

    expect(dbMocks.updated).toEqual(expect.objectContaining({
      isDismissed: 1,
      dismissedBy: "system:gl-projection-reconciler",
      dismissedAt: expect.any(Date),
    }));
    expect(dbMocks.whereValue).toEqual({
      kind: "eq",
      value: "gl-projection-assoc-1",
    });
  });
});
