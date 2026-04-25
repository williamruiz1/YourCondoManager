/**
 * 5.4 Wave 33 — In-process background job queue (perf 5.4-F3).
 *
 * Spec:
 *   docs/projects/platform-overhaul/implementation-artifacts/5.4-performance-audit.md §6 F3
 *   "Background rule-run for large associations (>500 units) via job queue."
 *
 * Why an in-process queue:
 *   The unified rule-run endpoint (`POST /api/financial/rules/:ruleId/run`)
 *   serially dispatches every in-scope unit through the orchestrator. For
 *   500-unit associations that exceeds typical request timeouts (2 min on
 *   Replit autoscale; 30s on most fronting load balancers). Wave 33 moves
 *   the run off the request thread for those associations only — the sync
 *   path is preserved unchanged for ≤500-unit associations.
 *
 *   We deliberately AVOID Redis / BullMQ / external queue services. The
 *   problem isn't fan-out across workers — it's getting the work off the
 *   express handler. A single-process queue with concurrency = 1 per
 *   associationId, persisted in `background_jobs`, is exactly enough.
 *
 * Persistence + idempotency:
 *   - Every enqueue inserts a `background_jobs` row with state='queued'.
 *   - The optional idempotency key (`derive*` helpers below) coalesces a
 *     duplicate enqueue (same rule + asOfDate while a job is still
 *     queued/running) onto the existing jobId. Implemented via a partial
 *     unique index in migration 0016 — when the insert collides, we read
 *     the existing row and return its id.
 *   - On crash / restart, queued+running rows are re-enqueued by the
 *     `recoverInFlightJobs()` boot helper called from server/index.ts.
 *
 * No PII:
 *   `payload` only carries ids (jobType, ruleType, ruleId, associationId,
 *   asOfDate, dryRun). The orchestrator already owns owner / unit lookups
 *   via direct schema queries.
 */

import { and, eq, inArray } from "drizzle-orm";

import { backgroundJobs, type BackgroundJob, type InsertBackgroundJob } from "@shared/schema";

import { db } from "./db";
import { runOnDemand as runAssessmentOnDemand, type AssessmentRuleType } from "./assessment-execution";
import { log } from "./logger";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type JobState = "queued" | "running" | "done" | "failed";

export type JobType = "assessment-rule-run";

export interface AssessmentRuleRunPayload {
  jobType: "assessment-rule-run";
  ruleType: AssessmentRuleType;
  ruleId: string;
  associationId: string;
  dryRun: boolean;
  /** ISO 8601 timestamp string. */
  asOfDate: string;
}

export type JobPayload = AssessmentRuleRunPayload;

export interface EnqueueResult {
  jobId: string;
  /** True when an existing in-flight job was reused (idempotency hit). */
  reused: boolean;
}

// ---------------------------------------------------------------------------
// In-process state
// ---------------------------------------------------------------------------

/**
 * One slot per associationId. Each slot holds a Promise chain so that two
 * jobs against the same association run serially (concurrency = 1) but jobs
 * across different associations can run in parallel. This matches the
 * orchestrator's existing assumption: per-association inserts are sequential
 * (the assessment_run_log composite key includes associationId).
 */
const associationSlots = new Map<string, Promise<void>>();

// ---------------------------------------------------------------------------
// Idempotency key derivation
// ---------------------------------------------------------------------------

export function deriveAssessmentRuleRunIdempotencyKey(input: {
  ruleType: AssessmentRuleType;
  ruleId: string;
  associationId: string;
  asOfDate: Date;
  dryRun: boolean;
}): string {
  const dayBucket = input.asOfDate.toISOString().slice(0, 10);
  return [
    "assessment-rule-run",
    input.associationId,
    input.ruleType,
    input.ruleId,
    dayBucket,
    input.dryRun ? "dry" : "real",
  ].join(":");
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Enqueue a rule-run job. Persists a `background_jobs` row in state='queued'
 * and schedules an async drain. Idempotent on `(ruleType, ruleId, asOfDate,
 * dryRun)` while a previous job is still queued/running.
 */
export async function enqueueAssessmentRuleRun(opts: {
  ruleType: AssessmentRuleType;
  ruleId: string;
  associationId: string;
  asOfDate: Date;
  dryRun: boolean;
}): Promise<EnqueueResult> {
  const idempotencyKey = deriveAssessmentRuleRunIdempotencyKey(opts);
  const payload: AssessmentRuleRunPayload = {
    jobType: "assessment-rule-run",
    ruleType: opts.ruleType,
    ruleId: opts.ruleId,
    associationId: opts.associationId,
    dryRun: opts.dryRun,
    asOfDate: opts.asOfDate.toISOString(),
  };

  // Try the idempotent insert first. If it collides on the partial unique
  // index, the second select returns the in-flight job's id.
  const insertValues: InsertBackgroundJob = {
    jobType: "assessment-rule-run",
    payload,
    state: "queued",
    idempotencyKey,
  };

  try {
    const [inserted] = await db.insert(backgroundJobs).values(insertValues).returning();
    void scheduleDrainForAssociation(opts.associationId);
    return { jobId: inserted.id, reused: false };
  } catch (err: unknown) {
    // Postgres throws 23505 on unique-constraint violation. Fall back to
    // looking up the existing in-flight row by idempotency key.
    if (!isUniqueViolation(err)) throw err;

    const [existing] = await db
      .select()
      .from(backgroundJobs)
      .where(
        and(
          eq(backgroundJobs.idempotencyKey, idempotencyKey),
          inArray(backgroundJobs.state, ["queued", "running"]),
        ),
      )
      .limit(1);

    if (!existing) {
      // The unique index only covers queued/running rows. If the row
      // collided but is no longer in flight, retry with no idempotency key.
      const [insertedRetry] = await db
        .insert(backgroundJobs)
        .values({ ...insertValues, idempotencyKey: null })
        .returning();
      void scheduleDrainForAssociation(opts.associationId);
      return { jobId: insertedRetry.id, reused: false };
    }
    return { jobId: existing.id, reused: true };
  }
}

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "23505";
}

// ---------------------------------------------------------------------------
// Status read
// ---------------------------------------------------------------------------

export async function getJobStatus(jobId: string): Promise<BackgroundJob | null> {
  const [row] = await db
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.id, jobId))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Drain (per-association serializer)
// ---------------------------------------------------------------------------

function scheduleDrainForAssociation(associationId: string): Promise<void> {
  const previous = associationSlots.get(associationId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => drainOneForAssociation(associationId));
  associationSlots.set(associationId, next);
  return next;
}

async function drainOneForAssociation(associationId: string): Promise<void> {
  // Pick the oldest queued job for this association by scanning the small
  // queued set. We deliberately avoid a Postgres jsonb @> predicate because
  // it would force a heavier import and the queue is small (handful of
  // rows). The candidate is the first row whose payload.associationId
  // matches.
  const queued = await db
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.state, "queued"));
  const job = (queued as BackgroundJob[]).find((row) => {
    const p = row.payload as JobPayload | null;
    return p?.associationId === associationId;
  });
  if (!job) return;

  await runJob(job);

  // Re-scan: if another queued row exists for this association, schedule
  // another drain step. Otherwise leave the slot map untouched — when the
  // next enqueue arrives it will populate a new chain.
  const remaining = await db
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.state, "queued"));
  const more = (remaining as BackgroundJob[]).some((row) => {
    const p = row.payload as JobPayload | null;
    return p?.associationId === associationId;
  });
  if (more) {
    // A direct recursive call would unbounded-grow the chain; schedule via
    // the slot so concurrency-1 ordering is preserved.
    void scheduleDrainForAssociation(associationId);
  }
}

async function runJob(job: BackgroundJob): Promise<void> {
  const startedAt = new Date();
  await db
    .update(backgroundJobs)
    .set({ state: "running", startedAt })
    .where(eq(backgroundJobs.id, job.id));

  const payload = job.payload as JobPayload;
  try {
    if (payload.jobType !== "assessment-rule-run") {
      throw new Error(`Unsupported jobType: ${payload.jobType}`);
    }
    const summary = await runAssessmentOnDemand({
      ruleType: payload.ruleType,
      ruleId: payload.ruleId,
      associationId: payload.associationId,
      dryRun: payload.dryRun,
      now: new Date(payload.asOfDate),
    });

    await db
      .update(backgroundJobs)
      .set({
        state: "done",
        completedAt: new Date(),
        // Result is purely a denormalized convenience for the polling
        // endpoint; the canonical record is the assessment_run_log rows.
        resultJson: {
          dryRun: summary.dryRun,
          totalDispatched: summary.totalDispatched,
          perStatus: summary.perStatus,
          runLogRowIds: summary.runLogRowIds,
        },
        error: null,
      })
      .where(eq(backgroundJobs.id, job.id));
    log(
      `[job-queue] assessment-rule-run ${job.id} done (dispatched=${summary.totalDispatched}, success=${summary.perStatus.success ?? 0}, failed=${summary.perStatus.failed ?? 0})`,
      "job-queue",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(backgroundJobs)
      .set({ state: "failed", completedAt: new Date(), error: message })
      .where(eq(backgroundJobs.id, job.id));
    // eslint-disable-next-line no-console
    console.error(`[job-queue] job ${job.id} failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Boot recovery
// ---------------------------------------------------------------------------

/**
 * Server-start hook. Re-enqueues any rows still in 'queued' or 'running'
 * state — the latter implies a crash mid-run and is treated identically to
 * 'queued' (the orchestrator is idempotent at the run-log row level since
 * each insert generates a fresh id; duplicate run-log rows will not corrupt
 * the ledger because no ledgerEntry insert will succeed twice for the same
 * (rule, unit, dueDate) tuple).
 */
export async function recoverInFlightJobs(): Promise<number> {
  const inFlight = await db
    .select()
    .from(backgroundJobs)
    .where(inArray(backgroundJobs.state, ["queued", "running"]));
  if (inFlight.length === 0) return 0;
  // Force any 'running' rows back to 'queued' so the drain picks them up.
  await db
    .update(backgroundJobs)
    .set({ state: "queued", startedAt: null })
    .where(inArray(backgroundJobs.state, ["running"]));
  for (const job of inFlight) {
    const payload = job.payload as JobPayload;
    void scheduleDrainForAssociation(payload.associationId);
  }
  log(`[job-queue] recovered ${inFlight.length} in-flight job(s) on boot`, "job-queue");
  return inFlight.length;
}

// ---------------------------------------------------------------------------
// Test helpers (only used by job-queue tests)
// ---------------------------------------------------------------------------

export function __resetSlotsForTests__(): void {
  associationSlots.clear();
}
