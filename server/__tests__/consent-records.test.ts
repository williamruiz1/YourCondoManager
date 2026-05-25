/**
 * #342 (WS3) — Consent audit trail storage tests.
 *
 * Exercises `recordConsent` + `hasConsented` + `getConsentHistory` +
 * `listConsentAuditRecords` end-to-end with an in-memory db stub. Verifies:
 *   - first call records a row + returns id/timestamp
 *   - hasConsented returns true after a record for matching (user, version)
 *   - hasConsented returns false for mismatched policy version (re-consent path)
 *   - second consent at same version stacks a new row (multi-device audit signal)
 *   - getConsentHistory returns per-user rows newest-first
 *   - listConsentAuditRecords supports filter composition + result limit
 *   - IP + user-agent values are persisted on insert (forensic capture)
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
  let pendingOrder: { field: keyof ConsentRow; dir: "asc" | "desc" } | null = null;

  // Chainable builder that supports the patterns the storage methods use:
  //   select().from(t).where(...).limit(n)
  //   select().from(t).where(...).orderBy(...).limit(n)
  //   select().from(t).orderBy(...).limit(n)
  function builder(rowsView: ConsentRow[]) {
    let withWhere = false;
    const applyOrderAndLimit = (limit: number | null) => {
      let result = rowsView.filter((r) =>
        withWhere ? matches(r, pendingPredicates) : true,
      );
      if (pendingOrder) {
        const { field, dir } = pendingOrder;
        result = [...result].sort((a, b) => {
          const av = a[field] as unknown;
          const bv = b[field] as unknown;
          if (av instanceof Date && bv instanceof Date) {
            return dir === "desc" ? bv.getTime() - av.getTime() : av.getTime() - bv.getTime();
          }
          if (typeof av === "string" && typeof bv === "string") {
            return dir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
          }
          return 0;
        });
      }
      if (limit !== null) result = result.slice(0, limit);
      pendingPredicates = [];
      pendingOrder = null;
      return result;
    };
    const orderable = {
      orderBy: () => ({
        limit: (n: number) => applyOrderAndLimit(n),
        // For storage paths that orderBy without a limit (history).
        then: undefined,
        // Allow awaiting the orderBy chain directly.
        // Drizzle returns an awaitable — emulate by returning a thenable.
        ...({
          then: (onFulfilled: (v: ConsentRow[]) => unknown) =>
            Promise.resolve(applyOrderAndLimit(null)).then(onFulfilled),
        } as unknown as { then: (cb: (v: ConsentRow[]) => unknown) => Promise<unknown> }),
      }),
      limit: (n: number) => applyOrderAndLimit(n),
      then: (onFulfilled: (v: ConsentRow[]) => unknown) =>
        Promise.resolve(applyOrderAndLimit(null)).then(onFulfilled),
    };
    return {
      where: () => {
        withWhere = true;
        return orderable;
      },
      orderBy: orderable.orderBy,
      limit: orderable.limit,
      then: orderable.then,
    };
  }

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
        from: () => builder(rows),
      }),
      // Setter hooks for the mock — tests poke predicates via these helpers.
      __setPredicates: (preds: Array<{ field: keyof ConsentRow; value: unknown }>) => {
        pendingPredicates = preds;
      },
      __setOrder: (order: { field: keyof ConsentRow; dir: "asc" | "desc" } | null) => {
        pendingOrder = order;
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

  it("recordConsent persists ip + user_agent verbatim (forensic capture)", async () => {
    await storage.recordConsent({
      userId: "user-forensic",
      userEmail: "forensic@example.com",
      policyVersion: POLICY_V1,
      ipAddress: "203.0.113.42",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36",
    });
    const row = rows.find((r) => r.userId === "user-forensic");
    expect(row).toBeDefined();
    expect(row?.ipAddress).toBe("203.0.113.42");
    expect(row?.userAgent).toBe("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36");
  });

  it("getConsentHistory returns per-user rows ordered newest-first", async () => {
    // Insert three rows for user-history; manually set consentedAt to known order.
    rows.push({
      id: "consent-h1",
      userId: "user-history",
      userEmail: "history@example.com",
      policyVersion: POLICY_V1,
      consentedAt: new Date("2026-05-01T10:00:00Z"),
      ipAddress: null,
      userAgent: null,
    });
    rows.push({
      id: "consent-h2",
      userId: "user-history",
      userEmail: "history@example.com",
      policyVersion: POLICY_V2,
      consentedAt: new Date("2026-05-15T10:00:00Z"),
      ipAddress: null,
      userAgent: null,
    });
    rows.push({
      id: "consent-h3",
      userId: "user-other",
      userEmail: "other@example.com",
      policyVersion: POLICY_V1,
      consentedAt: new Date("2026-05-10T10:00:00Z"),
      ipAddress: null,
      userAgent: null,
    });
    (db as unknown as { __setPredicates: (p: any[]) => void; __setOrder: (o: any) => void }).__setPredicates([
      { field: "userId", value: "user-history" },
    ]);
    (db as unknown as { __setPredicates: (p: any[]) => void; __setOrder: (o: any) => void }).__setOrder({ field: "consentedAt", dir: "desc" });
    const history = await storage.getConsentHistory("user-history");
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe("consent-h2"); // newer first
    expect(history[1].id).toBe("consent-h1");
  });

  it("listConsentAuditRecords filters by policyVersion + applies result limit", async () => {
    for (let i = 0; i < 3; i++) {
      rows.push({
        id: `consent-list-${i}`,
        userId: `user-${i}`,
        userEmail: `u${i}@example.com`,
        policyVersion: POLICY_V1,
        consentedAt: new Date(`2026-05-0${i + 1}T10:00:00Z`),
        ipAddress: null,
        userAgent: null,
      });
    }
    rows.push({
      id: "consent-list-v2",
      userId: "user-9",
      userEmail: "u9@example.com",
      policyVersion: POLICY_V2,
      consentedAt: new Date("2026-05-15T10:00:00Z"),
      ipAddress: null,
      userAgent: null,
    });
    (db as unknown as { __setPredicates: (p: any[]) => void; __setOrder: (o: any) => void }).__setPredicates([
      { field: "policyVersion", value: POLICY_V1 },
    ]);
    (db as unknown as { __setPredicates: (p: any[]) => void; __setOrder: (o: any) => void }).__setOrder({ field: "consentedAt", dir: "desc" });
    const list = await storage.listConsentAuditRecords({ policyVersion: POLICY_V1, limit: 2 });
    expect(list).toHaveLength(2);
    // Newest two of the three v1 rows.
    expect(list[0].id).toBe("consent-list-2");
    expect(list[1].id).toBe("consent-list-1");
  });
});
