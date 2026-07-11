/**
 * SCALE-B-003 / A-REL-005 (founder-os#10741) — cross-machine scheduler
 * advisory-lock unit tests.
 *
 * Verifies:
 *   - single-machine: the lock always acquires immediately and runs `fn`
 *     (behavior provably unchanged from the pre-lock world)
 *   - two concurrent invocations of the SAME sweep → only ONE runs the side
 *     effect (the money-double-fire class this fix exists to kill)
 *   - de-provisioning-shaped side effect (email send) fires exactly once under
 *     concurrent runs
 *   - crash mid-sweep RELEASES the lock (a thrown `fn` never leaks the lock; the
 *     pooled client is released) so the next tick can run
 *   - distinct sweep names get distinct keys and never block each other
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// Stateful in-memory advisory-lock mock. `pg_try_advisory_lock` acquires iff the
// key isn't already held; `pg_advisory_unlock` releases it. Keyed by the lock
// NAME (the second SQL param). `outstandingClients` proves every acquired client
// is released, even when `fn` throws.
const heldLocks = new Set<string>();
let outstandingClients = 0;

vi.mock("../logger", () => ({ log: () => {} }));

vi.mock("../db", () => {
  const pool = {
    connect: async () => {
      outstandingClients++;
      return {
        query: async (text: string, params: unknown[]) => {
          const key = String(params?.[1]);
          if (text.includes("pg_try_advisory_lock")) {
            if (heldLocks.has(key)) return { rows: [{ locked: false }] };
            heldLocks.add(key);
            return { rows: [{ locked: true }] };
          }
          if (text.includes("pg_advisory_unlock")) {
            heldLocks.delete(key);
            return { rows: [{ unlocked: true }] };
          }
          return { rows: [] };
        },
        release: () => {
          outstandingClients--;
        },
      };
    },
  };
  return { pool };
});

import { withSchedulerLock, SchedulerLock } from "../scheduler-lock";

afterEach(() => {
  heldLocks.clear();
  outstandingClients = 0;
  vi.restoreAllMocks();
});

describe("withSchedulerLock", () => {
  it("single-machine: acquires immediately and runs fn, returning its value", async () => {
    let ran = false;
    const result = await withSchedulerLock("ycm:test-sweep", async () => {
      ran = true;
      return 42;
    });
    expect(ran).toBe(true);
    expect(result).toEqual({ acquired: true, value: 42 });
    // lock released + client returned to the pool
    expect(heldLocks.size).toBe(0);
    expect(outstandingClients).toBe(0);
  });

  it("two concurrent invocations of the same sweep → the side effect runs exactly once", async () => {
    let sideEffectRuns = 0;
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const fn = async () => {
      sideEffectRuns++;
      await gate; // hold the lock until we release it
      return "done";
    };

    const p1 = withSchedulerLock("ycm:automation-sweep", fn);
    const p2 = withSchedulerLock("ycm:automation-sweep", fn);

    // Let both invocations reach the lock-acquire query before either releases.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    releaseGate();

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(sideEffectRuns).toBe(1); // NEVER double-fires
    const acquiredCount = [r1.acquired, r2.acquired].filter(Boolean).length;
    expect(acquiredCount).toBe(1); // exactly one machine won the lock
    expect(heldLocks.size).toBe(0); // lock released after
    expect(outstandingClients).toBe(0);
  });

  it("de-provisioning-shaped run: concurrent ticks send the deactivation email exactly once", async () => {
    const emailsSent: string[] = [];
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const sweepTick = async () => {
      // stand-in for the real deactivation-email send inside runAdminInactivityCheck
      await gate;
      emailsSent.push("deactivation@owner");
      return { deactivated: 1 };
    };

    const t1 = withSchedulerLock(SchedulerLock.DEPROVISIONING, sweepTick);
    const t2 = withSchedulerLock(SchedulerLock.DEPROVISIONING, sweepTick);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    releaseGate();
    await Promise.all([t1, t2]);

    expect(emailsSent).toHaveLength(1); // no duplicate deactivation email
  });

  it("crash mid-sweep releases the lock and the pooled client, so the next tick can run", async () => {
    await expect(
      withSchedulerLock("ycm:crashy-sweep", async () => {
        throw new Error("boom mid-sweep");
      }),
    ).rejects.toThrow("boom mid-sweep");

    // lock must be released and the client returned even though fn threw
    expect(heldLocks.size).toBe(0);
    expect(outstandingClients).toBe(0);

    // a subsequent tick acquires cleanly and runs
    let ran = false;
    const result = await withSchedulerLock("ycm:crashy-sweep", async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(result.acquired).toBe(true);
  });

  it("distinct sweep names get distinct keys and never block each other", async () => {
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    let electionRan = false;
    let vendorRan = false;

    const election = withSchedulerLock(SchedulerLock.ELECTION_AUTO_CLOSE, async () => {
      electionRan = true;
      await gate;
    });
    const vendor = withSchedulerLock(SchedulerLock.VENDOR_COMPLIANCE, async () => {
      vendorRan = true;
      await gate;
    });

    await Promise.resolve();
    await Promise.resolve();
    // both ran despite overlapping — different lock keys
    expect(electionRan).toBe(true);
    expect(vendorRan).toBe(true);

    releaseGate();
    const [er, vr] = await Promise.all([election, vendor]);
    expect(er.acquired).toBe(true);
    expect(vr.acquired).toBe(true);
  });

  it("exposes stable, distinct lock names for each wrapped sweep", () => {
    const names = Object.values(SchedulerLock);
    expect(new Set(names).size).toBe(names.length); // all distinct
    expect(SchedulerLock.AUTOMATION_SWEEP).toBe("ycm:automation-sweep");
  });
});
