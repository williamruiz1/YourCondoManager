/**
 * #342 (WS3) — Consent audit trail storage tests.
 *
 * Exercises `recordConsent` + `hasConsented` end-to-end with an in-memory
 * db stub. Verifies:
 *   - first call records a row + returns id/timestamp
 *   - hasConsented returns true after a record for matching (user, version)
 *   - hasConsented returns false for mismatched policy version (re-consent path)
 *   - second consent at same version stacks a new row (multi-device audit signal)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ConsentRow = {
  id: string;
  userId: string;
  userEmail: string;
  policyVersion: string;
  consentedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
};

const rows: ConsentRow[] = [];
let idCounter = 0;

vi.mock("../db", () => {
  const matches = (row: ConsentRow, predicates: Array<{ field: keyof ConsentRow; value: unknown }>) =>
    predicates.every((p) => row[p.field] === p.value);
  let pendingPredicates: Array<{ field: keyof ConsentRow; value: unknown }> = [];
  return {
    db: {
      insert: () => ({
        values: (data: Omit<ConsentRow, "id" | "consentedAt"> & { id?: string; consentedAt?: Date }) => ({
          returning: () => {
            const row: ConsentRow = {
              id: `consent-${++idCounter}`,
              userId: data.userId,
              userEmail: data.userEmail,
              policyVersion: data.policyVersion,
              consentedAt: data.consentedAt ?? new Date(),
              ipAddress: data.ipAddress ?? null,
              userAgent: data.userAgent ?? null,
            };
            rows.push(row);
            return [row];
          },
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => {
              const result = rows.filter((r) => matches(r, pendingPredicates));
              pendingPredicates = [];
              return result;
            },
          }),
        }),
      }),
      // Setter hooks for the mock — tests poke predicates via these helpers.
      __setPredicates: (preds: Array<{ field: keyof ConsentRow; value: unknown }>) => {
        pendingPredicates = preds;
      },
    },
  };
});

vi.mock("../email-provider", () => ({ sendPlatformEmail: vi.fn() }));

import { db } from "../db";
import { DatabaseStorage } from "../storage";

const POLICY_V1 = "2026-05-19";
const POLICY_V2 = "2026-06-01";

describe("#342 consent audit trail", () => {
  let storage: DatabaseStorage;
  beforeEach(() => {
    rows.length = 0;
    idCounter = 0;
    storage = new DatabaseStorage();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recordConsent inserts a row and returns id + consentedAt", async () => {
    const result = await storage.recordConsent({
      userId: "user-1",
      userEmail: "user1@example.com",
      policyVersion: POLICY_V1,
      ipAddress: "10.0.0.1",
      userAgent: "Mozilla/5.0",
    });
    expect(result.id).toMatch(/^consent-/);
    expect(result.consentedAt).toBeInstanceOf(Date);
    expect(rows).toHaveLength(1);
    expect(rows[0].ipAddress).toBe("10.0.0.1");
    expect(rows[0].userAgent).toBe("Mozilla/5.0");
  });

  it("hasConsented returns true after a record for the matching (user, version)", async () => {
    await storage.recordConsent({
      userId: "user-1",
      userEmail: "user1@example.com",
      policyVersion: POLICY_V1,
      ipAddress: null,
      userAgent: null,
    });
    (db as unknown as { __setPredicates: (p: any[]) => void }).__setPredicates([
      { field: "userId", value: "user-1" },
      { field: "policyVersion", value: POLICY_V1 },
    ]);
    expect(await storage.hasConsented("user-1", POLICY_V1)).toBe(true);
  });

  it("hasConsented returns false for a different policy version (re-consent path)", async () => {
    await storage.recordConsent({
      userId: "user-1",
      userEmail: "user1@example.com",
      policyVersion: POLICY_V1,
      ipAddress: null,
      userAgent: null,
    });
    (db as unknown as { __setPredicates: (p: any[]) => void }).__setPredicates([
      { field: "userId", value: "user-1" },
      { field: "policyVersion", value: POLICY_V2 },
    ]);
    expect(await storage.hasConsented("user-1", POLICY_V2)).toBe(false);
  });

  it("multiple consents at the same version stack as separate rows (multi-device audit)", async () => {
    await storage.recordConsent({
      userId: "user-1",
      userEmail: "user1@example.com",
      policyVersion: POLICY_V1,
      ipAddress: "10.0.0.1",
      userAgent: "device-a",
    });
    await storage.recordConsent({
      userId: "user-1",
      userEmail: "user1@example.com",
      policyVersion: POLICY_V1,
      ipAddress: "10.0.0.2",
      userAgent: "device-b",
    });
    expect(rows).toHaveLength(2);
  });
});
