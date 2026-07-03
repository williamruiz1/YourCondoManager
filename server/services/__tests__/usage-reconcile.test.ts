/**
 * usage-reconcile.test.ts — per-subscription metered usage resolution + idempotency.
 *
 * Validates the orchestration layer that ties live counts → tier → meter event:
 *   - a metered (per-unit) self-managed subscription resolves the right event_name +
 *     reports the live unit count as the meter value;
 *   - a flat (Small $129) subscription resolves to a no-op (not metered);
 *   - the local ledger makes the report idempotent: a subscription whose
 *     current_period_end already matches the ledger is skipped (never double-reported
 *     to the SUM meter).
 *
 * `../../db` and `../pricing-service` are mocked so the test runs without a database
 * or live Stripe. The POST is a captured stub.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlatformSubscription } from "@shared/schema";
import type { MeterPoster } from "../stripe-meter-reporting";

// ── Mock the live unit-count + tier resolution so we drive resolveMeteredUsage. ──
let MOCK_UNIT_COUNT = 0;
let MOCK_PLANS: any[] = [];
const ledgerWrites: any[] = [];

vi.mock("../../db", () => {
  // A tiny chainable stub. select(...).from(units).where(...) resolves to a count
  // row; select().from(planCatalog).where(...) resolves to the mocked plans;
  // update(...).set(...).where(...) records the ledger write.
  const makeSelect = () => {
    const chain: any = {};
    chain.from = (tbl: any) => {
      chain.__table = tbl;
      return chain;
    };
    chain.where = () => chain;
    chain.groupBy = () => Promise.resolve([{ associationId: "assoc_1", c: MOCK_UNIT_COUNT }]);
    chain.then = (resolve: any) => {
      // planCatalog selects return the plans; units count returns [{ c }].
      if (chain.__table === "PLAN_CATALOG") return resolve(MOCK_PLANS);
      return resolve([{ c: MOCK_UNIT_COUNT }]);
    };
    return chain;
  };
  return {
    db: {
      select: () => makeSelect(),
      update: () => ({
        set: (vals: any) => ({
          where: () => {
            ledgerWrites.push(vals);
            return Promise.resolve();
          },
        }),
      }),
    },
    pool: {},
  };
});

// Tag the schema tables the mock branches on.
vi.mock("@shared/schema", async (orig) => {
  const actual = (await orig()) as any;
  return { ...actual, units: "UNITS", planCatalog: "PLAN_CATALOG", platformSubscriptions: "PLATFORM_SUBS", associations: "ASSOC", adminAssociationScopes: "SCOPES", adminUsers: "ADMINS" };
});

vi.mock("../pricing-service", () => ({
  resolveSelfManagedPlanFromList: (unitCount: number, plans: any[]) => {
    // Mimic real resolution: Small (1–40) flat, Mid (41–100) per_door.
    if (unitCount >= 41) return { planKey: "mid_community", pricingModel: "per_door" };
    return { planKey: "small_community", pricingModel: "flat_per_association" };
  },
  computePmPortfolioMonthlyBillFromList: () => ({ resolvedTierPlanKey: "pm_starter", totalDoors: 0, manualReviewRequired: false }),
}));

vi.mock("../platform-secrets-store", () => ({ getSecret: vi.fn(async () => "sk_test_x") }));

import { resolveMeteredUsage, reportSubscriptionUsage } from "../usage-reconcile";

function makeSub(overrides: Partial<PlatformSubscription> = {}): PlatformSubscription {
  return {
    id: "ps_1",
    associationId: "assoc_1",
    plan: "self-managed",
    status: "active",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    currentPeriodStart: null,
    currentPeriodEnd: new Date(1780500000 * 1000),
    trialEndsAt: null,
    cancelAtPeriodEnd: 0,
    unitTier: null,
    unitCount: null,
    adminEmail: "owner@example.com",
    lastUsageReportedValue: null,
    lastUsageReportedPeriodEnd: null,
    lastUsageReportedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PlatformSubscription;
}

beforeEach(() => {
  MOCK_UNIT_COUNT = 0;
  MOCK_PLANS = [];
  ledgerWrites.length = 0;
});

describe("resolveMeteredUsage", () => {
  it("metered Mid Community self-managed → ycm_sm_units_mid_community + live unit count", async () => {
    MOCK_UNIT_COUNT = 60;
    const res = await resolveMeteredUsage(makeSub());
    expect(res).toEqual({ eventName: "ycm_sm_units_mid_community", value: 60 });
  });

  it("flat Small Community self-managed → null (not metered, no usage report)", async () => {
    MOCK_UNIT_COUNT = 20; // Small tier
    const res = await resolveMeteredUsage(makeSub());
    expect(res).toBeNull();
  });

  it("zero units → null (nothing to bill)", async () => {
    MOCK_UNIT_COUNT = 0;
    const res = await resolveMeteredUsage(makeSub());
    expect(res).toBeNull();
  });
});

describe("reportSubscriptionUsage — reports right count + idempotent per period", () => {
  it("reports the live unit count as the meter value, then writes the ledger", async () => {
    MOCK_UNIT_COUNT = 60;
    const calls: Record<string, string>[] = [];
    const post: MeterPoster = vi.fn(async (_p, body) => {
      calls.push(Object.fromEntries(body.entries()));
      return {};
    });

    const result = await reportSubscriptionUsage(makeSub(), post);

    expect(result.status).toBe("reported");
    if (result.status === "reported") {
      expect(result.eventName).toBe("ycm_sm_units_mid_community");
      expect(result.value).toBe(60);
    }
    expect(calls[0]["payload[value]"]).toBe("60");
    // Ledger written with the reported value + period.
    expect(ledgerWrites[0].lastUsageReportedValue).toBe(60);
    expect(ledgerWrites[0].lastUsageReportedPeriodEnd).toBeInstanceOf(Date);
  });

  it("skips when the current period was already reported (no double-count on SUM meter)", async () => {
    MOCK_UNIT_COUNT = 60;
    const post: MeterPoster = vi.fn(async () => ({}));
    // Ledger already records THIS period as reported.
    const sub = makeSub({ lastUsageReportedPeriodEnd: new Date(1780500000 * 1000) });

    const result = await reportSubscriptionUsage(sub, post);

    expect(result.status).toBe("skipped-already-reported");
    expect(post).not.toHaveBeenCalled();
    expect(ledgerWrites.length).toBe(0);
  });

  it("re-reports when forced even if the period matches (a detected count change)", async () => {
    MOCK_UNIT_COUNT = 75;
    const post: MeterPoster = vi.fn(async () => ({}));
    const sub = makeSub({ lastUsageReportedPeriodEnd: new Date(1780500000 * 1000) });

    const result = await reportSubscriptionUsage(sub, post, { force: true });

    expect(result.status).toBe("reported");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("skips a subscription with no Stripe customer", async () => {
    const post: MeterPoster = vi.fn(async () => ({}));
    const result = await reportSubscriptionUsage(makeSub({ stripeCustomerId: "" }), post);
    expect(result.status).toBe("skipped-no-customer");
    expect(post).not.toHaveBeenCalled();
  });
});
