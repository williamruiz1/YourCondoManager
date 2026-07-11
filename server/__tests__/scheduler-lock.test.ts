// server/__tests__/scheduler-lock.test.ts (founder-os#10741, SCALE-B-003 / A-REL-005)
//
// Proves the cross-machine advisory lock that guards the side-effect schedulers:
//   - two concurrent acquirers → only ONE runs the sweep (the other skips)
//   - a crash mid-sweep still RELEASES the lock (finally) so the next tick can run
//   - fail-CLOSED: lock unavailable / connect error / lock-query error → sweep
//     is SKIPPED, never run unlocked (a money sweep must never double-fire)
//
// The pg pool is mocked (mirrors bank-feed-sync.test.ts) so no real Postgres is
// needed; each fake client returns a scripted pg_try_advisory_lock result.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Scripted lock results: one boolean per pg_try_advisory_lock call, in order.
let lockResults: boolean[] = [];
let lockCallIdx = 0;
let unlockCalls = 0;
let connectShouldThrow = false;
let lockQueryShouldThrow = false;

vi.mock("../db", () => {
  const makeClient = () => ({
    query: vi.fn(async (text: string) => {
      if (text.includes("pg_try_advisory_lock")) {
        if (lockQueryShouldThrow) throw new Error("simulated lock-query failure");
        const locked = lockResults[lockCallIdx] ?? false;
        lockCallIdx += 1;
        return { rows: [{ locked }] };
      }
      if (text.includes("pg_advisory_unlock")) {
        unlockCalls += 1;
        return { rows: [{ ok: true }] };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  });
  const pool = {
    connect: vi.fn(async () => {
      if (connectShouldThrow) throw new Error("simulated connect failure");
      return makeClient();
    }),
  };
  return { pool, db: {} };
});

import { withSchedulerLock } from "../scheduler-lock";

beforeEach(() => {
  lockResults = [];
  lockCallIdx = 0;
  unlockCalls = 0;
  connectShouldThrow = false;
  lockQueryShouldThrow = false;
});

describe("withSchedulerLock", () => {
  it("runs fn and releases the lock when acquired (single-machine no-op path)", async () => {
    lockResults = [true];
    const fn = vi.fn(async () => {});
    const ran = await withSchedulerLock("sweep", fn);
    expect(ran).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
    expect(unlockCalls).toBe(1); // lock released
  });

  it("two concurrent acquirers: only ONE runs the sweep, the other skips", async () => {
    // First acquire wins (locked:true), second loses (locked:false).
    lockResults = [true, false];
    const sideEffect = vi.fn(async () => {});
    const [a, b] = await Promise.all([
      withSchedulerLock("autopay-sweep", sideEffect),
      withSchedulerLock("autopay-sweep", sideEffect),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1); // exactly one ran
    expect(sideEffect).toHaveBeenCalledOnce(); // no double-fire
    expect(unlockCalls).toBe(1); // only the winner unlocks
  });

  it("crash mid-sweep still releases the lock (finally) and does not throw", async () => {
    lockResults = [true];
    const fn = vi.fn(async () => {
      throw new Error("sweep blew up");
    });
    const ran = await withSchedulerLock("deprov", fn);
    expect(ran).toBe(false); // swallowed, reported as not-run
    expect(unlockCalls).toBe(1); // lock RELEASED despite the crash → next tick can run
  });

  it("fail-closed: lock held elsewhere → sweep is skipped (fn never runs)", async () => {
    lockResults = [false];
    const fn = vi.fn(async () => {});
    const ran = await withSchedulerLock("election-close", fn);
    expect(ran).toBe(false);
    expect(fn).not.toHaveBeenCalled();
    expect(unlockCalls).toBe(0); // never acquired → nothing to unlock
  });

  it("fail-closed: DB connection error → sweep is skipped, never runs unlocked", async () => {
    connectShouldThrow = true;
    const fn = vi.fn(async () => {});
    const ran = await withSchedulerLock("vendor-compliance", fn);
    expect(ran).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("fail-closed: lock-query error → sweep is skipped", async () => {
    lockQueryShouldThrow = true;
    const fn = vi.fn(async () => {});
    const ran = await withSchedulerLock("autopay-sweep", fn);
    expect(ran).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
