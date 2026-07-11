/**
 * founder-os#10741 (SCALE-B-003 / A-REL-005) — cross-machine scheduler
 * single-firing. Proves the advisory-lock wrapper: (1) runs the tick + unlocks
 * when the lock is acquired (the single-machine no-op path — always acquires →
 * zero behavior change); (2) SKIPS the tick when another machine holds the lock
 * (the double-fire fix); (3) is FAIL-CLOSED on a connect error (money-safe —
 * never runs a money-adjacent sweep unlocked); (4) releases the client + unlocks
 * even when the tick throws.
 */
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

let mockLocked = true;
let mockConnectThrows = false;
const queries: string[] = [];
let released = false;

vi.mock("../db", () => {
  const pool: any = {
    connect: async () => {
      if (mockConnectThrows) throw new Error("connect failed");
      released = false;
      return {
        query: async (sql: string) => {
          queries.push(sql);
          if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked: mockLocked }] };
          return { rows: [] };
        },
        release: () => {
          released = true;
        },
      };
    },
  };
  return { pool, db: {} };
});

import { withSchedulerLock } from "../lib/scheduler-lock";

afterEach(() => {
  mockLocked = true;
  mockConnectThrows = false;
  queries.length = 0;
  released = false;
});

describe("withSchedulerLock (founder-os#10741)", () => {
  it("runs the tick + unlocks + releases when the lock is acquired (single-machine: always acquires → no behavior change)", async () => {
    mockLocked = true;
    let ran = false;
    await withSchedulerLock("automation-sweep", async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(queries.some((q) => q.includes("pg_try_advisory_lock"))).toBe(true);
    expect(queries.some((q) => q.includes("pg_advisory_unlock"))).toBe(true);
    expect(released).toBe(true);
  });

  it("SKIPS the tick when another machine holds the lock (kills the cross-machine double-fire)", async () => {
    mockLocked = false;
    let ran = false;
    await withSchedulerLock("automation-sweep", async () => {
      ran = true;
    });
    expect(ran).toBe(false); // did NOT run — the holder runs it
    expect(queries.some((q) => q.includes("pg_advisory_unlock"))).toBe(false); // never acquired → never unlocks
    expect(released).toBe(true); // client still released
  });

  it("FAIL-CLOSED: SKIPS the tick on a DB connect error (money-safe — never runs a sweep unlocked)", async () => {
    mockConnectThrows = true;
    let ran = false;
    await withSchedulerLock("automation-sweep", async () => {
      ran = true;
    });
    expect(ran).toBe(false);
  });

  it("releases the client + unlocks even if the tick throws", async () => {
    mockLocked = true;
    await expect(
      withSchedulerLock("election-close", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(released).toBe(true);
    expect(queries.some((q) => q.includes("pg_advisory_unlock"))).toBe(true); // unlock in finally
  });
});
