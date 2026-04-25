/**
 * Wave 33 — server/job-queue.ts unit tests (5.4-F3).
 *
 * Strategy:
 *   Mock both `server/db` (in-memory background_jobs store) and
 *   `server/assessment-execution` (deterministic synthetic SweepSummary)
 *   so we can exercise the queue's contract without booting the full
 *   orchestrator.
 *
 * Coverage:
 *   1. enqueue inserts a 'queued' row and returns its id
 *   2. drain transitions queued → running → done with a populated resultJson
 *   3. idempotent enqueue: same (rule, asOfDate, dryRun) → reused jobId
 *   4. recoverInFlightJobs flips 'running' rows back to 'queued' and re-drains
 *   5. handler error → state='failed' with error message persisted
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- DB mock --------------------------------------------------------------
//
// We model `background_jobs` as an in-memory array. The mock exposes the
// same drizzle-shaped chain the production code uses (`db.insert(table).values(x)
// .returning()`, `db.select().from(table).where(...).limit(1)`, etc.).

type StoredJob = {
  id: string;
  jobType: string;
  payload: any;
  state: "queued" | "running" | "done" | "failed";
  idempotencyKey: string | null;
  enqueuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  resultJson: any;
};

type DbState = { jobs: StoredJob[]; nextId: number };
const dbState: DbState = { jobs: [], nextId: 1 };

function nextId(): string {
  return `job-${dbState.nextId++}`;
}

class UniqueViolation extends Error {
  code = "23505";
  constructor(message = "duplicate key") {
    super(message);
  }
}

vi.mock("../server/db", () => {
  function applyPredicate(job: StoredJob, pred: any): boolean {
    if (!pred) return true;
    if (Array.isArray(pred?.__preds)) {
      return pred.__preds.every((p: any) => applyPredicate(job, p));
    }
    if (pred.op === "eq") return (job as any)[pred.col] === pred.value;
    if (pred.op === "inArray") return pred.value.includes((job as any)[pred.col]);
    return true;
  }

  return {
    db: {
      insert: (_tbl: any) => ({
        values: (val: any) => ({
          returning: async () => {
            // Idempotency check: if there's already a queued/running row with
            // the same idempotencyKey, throw a unique-violation just like
            // Postgres would under the partial unique index.
            if (val.idempotencyKey) {
              const collision = dbState.jobs.find(
                (j) =>
                  j.idempotencyKey === val.idempotencyKey &&
                  (j.state === "queued" || j.state === "running"),
              );
              if (collision) throw new UniqueViolation();
            }
            const row: StoredJob = {
              id: nextId(),
              jobType: val.jobType,
              payload: val.payload,
              state: val.state ?? "queued",
              idempotencyKey: val.idempotencyKey ?? null,
              enqueuedAt: new Date(),
              startedAt: null,
              completedAt: null,
              error: null,
              resultJson: null,
            };
            dbState.jobs.push(row);
            return [row];
          },
        }),
      }),

      select: () => ({
        from: (_tbl: any) => ({
          where: (pred: any) => {
            const filtered = dbState.jobs.filter((j) => applyPredicate(j, pred));
            // IMPORTANT: the `then` resolver must yield a plain array — if it
            // resolves to the same Object.assign'd value, the JS await machinery
            // sees `then` again and recurses forever.
            const plainCopy = () => filtered.slice();
            const chain: any = {
              limit: (n: number) => filtered.slice(0, n),
              then: (resolve: (v: any) => void) => resolve(plainCopy()),
            };
            return chain;
          },
        }),
      }),

      update: (_tbl: any) => ({
        set: (patch: any) => ({
          where: async (pred: any) => {
            for (const j of dbState.jobs) {
              if (applyPredicate(j, pred)) Object.assign(j, patch);
            }
          },
        }),
      }),
    },
  };
});

// ---- drizzle-orm mock — shape predicates as the db mock expects ----------

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    eq: (col: any, value: any) => ({ col: col?.__colName, op: "eq", value }),
    inArray: (col: any, value: any) => ({ col: col?.__colName, op: "inArray", value }),
    and: (...preds: any[]) => ({ __preds: preds.flat().filter(Boolean) }),
  };
});

// ---- @shared/schema — minimal column sentinels ---------------------------

vi.mock("@shared/schema", () => {
  function col(name: string) {
    return { __colName: name };
  }
  return {
    backgroundJobs: {
      __name: "background_jobs",
      id: col("id"),
      jobType: col("jobType"),
      payload: col("payload"),
      state: col("state"),
      idempotencyKey: col("idempotencyKey"),
      enqueuedAt: col("enqueuedAt"),
      startedAt: col("startedAt"),
      completedAt: col("completedAt"),
      error: col("error"),
      resultJson: col("resultJson"),
    },
  };
});

// ---- assessment-execution mock — return a synthetic SweepSummary ---------

const runOnDemandMock = vi.fn();
vi.mock("../server/assessment-execution", () => ({
  runOnDemand: (...args: any[]) => runOnDemandMock(...args),
}));

// ---- logger no-op --------------------------------------------------------

vi.mock("../server/logger", () => ({
  log: () => {},
  debug: () => {},
}));

// ---- Imports under test (lazy, to ensure mocks are wired first) ---------

import {
  enqueueAssessmentRuleRun,
  getJobStatus,
  recoverInFlightJobs,
  __resetSlotsForTests__,
  deriveAssessmentRuleRunIdempotencyKey,
} from "../server/job-queue";

beforeEach(() => {
  dbState.jobs = [];
  dbState.nextId = 1;
  __resetSlotsForTests__();
  runOnDemandMock.mockReset();
});

async function flushUntilDone(jobId: string, maxIters = 50): Promise<void> {
  for (let i = 0; i < maxIters; i++) {
    const row = await getJobStatus(jobId);
    if (row && (row.state === "done" || row.state === "failed")) return;
    // Yield to any scheduled microtasks.
    await new Promise((r) => setImmediate(r));
  }
}

describe("job-queue — enqueue + drain", () => {
  it("enqueues a job and drains it to state='done' with a populated resultJson", async () => {
    runOnDemandMock.mockResolvedValueOnce({
      dryRun: false,
      totalDispatched: 600,
      perStatus: { success: 600, failed: 0, retrying: 0, skipped: 0, deferred: 0 },
      runLogRowIds: ["log-1", "log-2"],
    });

    const { jobId, reused } = await enqueueAssessmentRuleRun({
      ruleType: "recurring",
      ruleId: "rule-1",
      associationId: "assoc-1",
      asOfDate: new Date("2026-04-01T00:00:00Z"),
      dryRun: false,
    });

    expect(reused).toBe(false);
    expect(jobId).toMatch(/^job-/);

    await flushUntilDone(jobId);

    const final = await getJobStatus(jobId);
    expect(final?.state).toBe("done");
    expect(final?.resultJson).toMatchObject({
      totalDispatched: 600,
      runLogRowIds: ["log-1", "log-2"],
    });
    expect(runOnDemandMock).toHaveBeenCalledTimes(1);
  });

  it("idempotent enqueue returns the same jobId for a duplicate (ruleId, asOfDate, dryRun)", async () => {
    // Block runOnDemand so the first job stays in 'running' across the
    // duplicate enqueue. The partial unique index on idempotency_key fires
    // on the second insert and we return the first jobId.
    let release: (v: unknown) => void = () => undefined;
    runOnDemandMock.mockImplementation(
      () => new Promise((r) => { release = r; }),
    );

    const first = await enqueueAssessmentRuleRun({
      ruleType: "recurring",
      ruleId: "rule-1",
      associationId: "assoc-1",
      asOfDate: new Date("2026-04-01T00:00:00Z"),
      dryRun: false,
    });

    // Issue the duplicate enqueue immediately (no awaited yields between).
    const dup = await enqueueAssessmentRuleRun({
      ruleType: "recurring",
      ruleId: "rule-1",
      associationId: "assoc-1",
      asOfDate: new Date("2026-04-01T12:00:00Z"), // same day bucket
      dryRun: false,
    });

    expect(dup.reused).toBe(true);
    expect(dup.jobId).toBe(first.jobId);

    // Clean up: release runOnDemand so the test doesn't leak a hung promise.
    release({
      dryRun: false,
      totalDispatched: 0,
      perStatus: { success: 0, failed: 0, retrying: 0, skipped: 0, deferred: 0 },
      runLogRowIds: [],
    });
    await flushUntilDone(first.jobId);
  });

  it("derives idempotency keys that change with asOfDate day-bucket and dryRun", () => {
    const k1 = deriveAssessmentRuleRunIdempotencyKey({
      ruleType: "recurring",
      ruleId: "rule-1",
      associationId: "assoc-1",
      asOfDate: new Date("2026-04-01T00:00:00Z"),
      dryRun: false,
    });
    const k2 = deriveAssessmentRuleRunIdempotencyKey({
      ruleType: "recurring",
      ruleId: "rule-1",
      associationId: "assoc-1",
      asOfDate: new Date("2026-04-02T00:00:00Z"),
      dryRun: false,
    });
    const k3 = deriveAssessmentRuleRunIdempotencyKey({
      ruleType: "recurring",
      ruleId: "rule-1",
      associationId: "assoc-1",
      asOfDate: new Date("2026-04-01T00:00:00Z"),
      dryRun: true,
    });
    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
  });

  it("captures handler errors as state='failed' with the message persisted", async () => {
    runOnDemandMock.mockRejectedValueOnce(new Error("orchestrator blew up"));

    const { jobId } = await enqueueAssessmentRuleRun({
      ruleType: "special-assessment",
      ruleId: "rule-2",
      associationId: "assoc-2",
      asOfDate: new Date("2026-04-01T00:00:00Z"),
      dryRun: false,
    });

    await flushUntilDone(jobId);
    const final = await getJobStatus(jobId);
    expect(final?.state).toBe("failed");
    expect(final?.error).toContain("orchestrator blew up");
  });

  it("recoverInFlightJobs flips 'running' rows back to 'queued' and re-drains", async () => {
    runOnDemandMock.mockResolvedValue({
      dryRun: false,
      totalDispatched: 1,
      perStatus: { success: 1, failed: 0, retrying: 0, skipped: 0, deferred: 0 },
      runLogRowIds: ["log-x"],
    });

    // Simulate a crash mid-run by directly inserting a 'running' row.
    dbState.jobs.push({
      id: "job-recovered",
      jobType: "assessment-rule-run",
      payload: {
        jobType: "assessment-rule-run",
        ruleType: "recurring",
        ruleId: "rule-recover",
        associationId: "assoc-recover",
        dryRun: false,
        asOfDate: new Date("2026-04-01T00:00:00Z").toISOString(),
      },
      state: "running",
      idempotencyKey: null,
      enqueuedAt: new Date(Date.now() - 60_000),
      startedAt: new Date(Date.now() - 30_000),
      completedAt: null,
      error: null,
      resultJson: null,
    });

    const recovered = await recoverInFlightJobs();
    expect(recovered).toBe(1);

    await flushUntilDone("job-recovered");
    const final = await getJobStatus("job-recovered");
    expect(final?.state).toBe("done");
  });
});
