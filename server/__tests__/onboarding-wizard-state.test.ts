/**
 * #1327 — Wizard step-transition state machine.
 *
 * Verifies the invariant that `currentStep` always advances to the lowest
 * 1..7 step that has not been completed or skipped, regardless of which
 * step the user just resolved. Also checks the round-trip from skipped to
 * completed (a user can change their mind).
 *
 * The DatabaseStorage class is exercised end-to-end with an in-memory db
 * mock; the test is intentionally focused on transition correctness, not
 * SQL syntax.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type OnboardingRow = {
  id: string;
  adminUserId: string;
  associationId: string | null;
  currentStep: number;
  stepsCompleted: number[];
  stepsSkipped: number[];
  wizardStartedAt: Date;
  wizardTargetCompletionAt: Date;
  wizardCompletedAt: Date | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const rows = new Map<string, OnboardingRow>();

// ── Drizzle db mock ────────────────────────────────────────────────────────
vi.mock("../db", () => {
  function chain(rowList: OnboardingRow[]) {
    return {
      where: () => ({
        limit: () => rowList,
        returning: () => rowList,
      }),
      returning: () => rowList,
    };
  }
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: (_n: number) => {
              const all = Array.from(rows.values());
              return all;
            },
          }),
        }),
      }),
      insert: () => ({
        values: (data: Partial<OnboardingRow> & { adminUserId: string }) => ({
          onConflictDoNothing: () => ({
            returning: () => {
              if (rows.has(data.adminUserId)) return [];
              const now = new Date();
              const row: OnboardingRow = {
                id: `onb-${data.adminUserId}`,
                adminUserId: data.adminUserId,
                associationId: data.associationId ?? null,
                currentStep: data.currentStep ?? 1,
                stepsCompleted: (data.stepsCompleted as number[]) ?? [],
                stepsSkipped: (data.stepsSkipped as number[]) ?? [],
                wizardStartedAt: data.wizardStartedAt ?? now,
                wizardTargetCompletionAt: data.wizardTargetCompletionAt ?? new Date(now.getTime() + 14 * 86_400_000),
                wizardCompletedAt: null,
                lastActivityAt: data.lastActivityAt ?? now,
                createdAt: now,
                updatedAt: now,
              };
              rows.set(data.adminUserId, row);
              return [row];
            },
          }),
        }),
      }),
      update: () => ({
        set: (patch: Partial<OnboardingRow>) => ({
          where: () => ({
            returning: () => {
              const [row] = Array.from(rows.values());
              if (!row) return [];
              const merged = { ...row, ...patch, updatedAt: new Date() };
              rows.set(row.adminUserId, merged);
              return [merged];
            },
          }),
        }),
      }),
    },
  };
});

vi.mock("../email-provider", () => ({ sendPlatformEmail: vi.fn() }));

import { DatabaseStorage } from "../storage";

describe("#1327 onboarding wizard state machine", () => {
  let storage: DatabaseStorage;
  const ADMIN_ID = "admin-test-1";

  beforeEach(() => {
    rows.clear();
    storage = new DatabaseStorage();
  });

  afterEach(() => {
    rows.clear();
  });

  it("returns an unstarted snapshot when no row exists", async () => {
    const snap = await storage.getOnboardingWizardProgress(ADMIN_ID);
    expect(snap.started).toBe(false);
    expect(snap.currentStep).toBe(1);
    expect(snap.stepsCompleted).toEqual([]);
    expect(snap.stepsSkipped).toEqual([]);
    expect(snap.totalSteps).toBe(7);
  });

  it("startOnboardingWizard is idempotent", async () => {
    const first = await storage.startOnboardingWizard(ADMIN_ID);
    const second = await storage.startOnboardingWizard(ADMIN_ID);
    expect(first.started).toBe(true);
    expect(second.started).toBe(true);
    expect(second.wizardStartedAt).toBe(first.wizardStartedAt);
  });

  it("advances currentStep past completed steps in order", async () => {
    await storage.startOnboardingWizard(ADMIN_ID);
    const afterStep1 = await storage.markOnboardingStepComplete(ADMIN_ID, 1);
    expect(afterStep1.stepsCompleted).toEqual([1]);
    expect(afterStep1.currentStep).toBe(2);

    const afterStep2 = await storage.markOnboardingStepComplete(ADMIN_ID, 2);
    expect(afterStep2.stepsCompleted).toEqual([1, 2]);
    expect(afterStep2.currentStep).toBe(3);
  });

  it("advances currentStep past skipped steps", async () => {
    await storage.startOnboardingWizard(ADMIN_ID);
    await storage.markOnboardingStepComplete(ADMIN_ID, 1);
    const afterSkip2 = await storage.markOnboardingStepSkipped(ADMIN_ID, 2);
    expect(afterSkip2.stepsSkipped).toEqual([2]);
    expect(afterSkip2.currentStep).toBe(3);
  });

  it("supports skipped → completed round-trip", async () => {
    await storage.startOnboardingWizard(ADMIN_ID);
    await storage.markOnboardingStepSkipped(ADMIN_ID, 3);
    const reconciled = await storage.markOnboardingStepComplete(ADMIN_ID, 3);
    expect(reconciled.stepsCompleted).toEqual([3]);
    expect(reconciled.stepsSkipped).toEqual([]);
  });

  it("rejects out-of-range step numbers", async () => {
    await storage.startOnboardingWizard(ADMIN_ID);
    await expect(storage.markOnboardingStepComplete(ADMIN_ID, 0)).rejects.toThrow();
    await expect(storage.markOnboardingStepComplete(ADMIN_ID, 8)).rejects.toThrow();
  });

  it("currentStep settles at 7 once every step is resolved", async () => {
    await storage.startOnboardingWizard(ADMIN_ID);
    for (let i = 1; i <= 7; i++) {
      await storage.markOnboardingStepComplete(ADMIN_ID, i);
    }
    const snap = await storage.getOnboardingWizardProgress(ADMIN_ID);
    expect(snap.stepsCompleted).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(snap.currentStep).toBe(7);
  });

  it("completeOnboardingWizard sets wizardCompletedAt", async () => {
    await storage.startOnboardingWizard(ADMIN_ID);
    const finalized = await storage.completeOnboardingWizard(ADMIN_ID);
    expect(finalized.wizardCompletedAt).not.toBeNull();
  });
});
