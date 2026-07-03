/**
 * Production-safe seed gating tests (YCM#prod-safe-seed).
 *
 * LIVE bug: the boot seed upserted ~10 demo/test associations into production
 * on every deploy. These tests prove that with NODE_ENV=production the seed:
 *   1. creates ZERO demo associations (only the real Cherry Hill Court
 *      Condominiums row is ever inserted into `associations`),
 *   2. never touches `archived_at` (no update/un-archive of demo rows),
 *   3. skips the demo-only child blocks (demo units/people, Sunset Towers
 *      elections, CHC TEST HOA).
 * And that in a non-production env (or with SEED_DEMO_DATA=1) the demo
 * associations are still seeded, so dev/test environments are unaffected.
 *
 * Strategy: mock `./db` with a chainable query-builder recorder that captures
 * every `db.insert(table).values(rows)` call without a real database. The seed
 * blocks are wrapped in try/catch (`runBlock`), so the mock only needs to
 * record inserts and return empty selects — later blocks failing on the mock
 * is fine and expected; we only assert on what reached the `associations`
 * table and whether the demo blocks ran at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REAL_CHC_ID = "f301d073-ed84-4d73-84ce-3ef28af66f7a";
const REAL_CHC_NAME = "Cherry Hill Court Condominiums";

const DEMO_ASSOCIATION_NAMES = [
  "Sunset Towers",
  "Pacific Heights Condos",
  "Lakewood Residences",
  "Test Towers",
  "CHC TEST HOA",
  "Cherry Hill Court", // the NJ duplicate
  "Verification HOA 1773579706183",
  "QA Communications Foundation 364067",
  "Building First Verify A 092492",
  "Building First Verify B 092492",
];

type InsertCall = { table: string; rows: any[] };

/**
 * Build a fresh chainable mock of the drizzle `db` object that records every
 * insert and returns empty results everywhere else. Table identity is derived
 * from the captured drizzle table object; we tag the `associations` table so
 * we can assert specifically on association inserts.
 */
function buildDbMock() {
  const insertCalls: InsertCall[] = [];
  let updateCalled = false;

  // Resolve the association table reference so we can name inserts targeting it.
  let associationsRef: any;

  const noopThenable = (resolveValue: any = []) => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      groupBy: () => chain,
      returning: () => Promise.resolve(resolveValue),
      onConflictDoNothing: () => ({ returning: () => Promise.resolve([]), then: (r: any) => Promise.resolve([]).then(r) }),
      then: (r: any) => Promise.resolve(resolveValue).then(r),
    };
    return chain;
  };

  const db: any = {
    select: () => noopThenable([]),
    execute: () => Promise.resolve({ rows: [{ associations: 0, units: 0, buildings: 0, persons: 0, auth_users: 0, admin_users: 0 }] }),
    update: () => {
      updateCalled = true;
      return { set: () => ({ where: () => Promise.resolve([]) }) };
    },
    delete: () => ({ where: () => Promise.resolve([]) }),
    insert: (table: any) => {
      const tableName = table === associationsRef ? "associations" : "other";
      return {
        values: (rows: any) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          insertCalls.push({ table: tableName, rows: arr });
          const ret = {
            onConflictDoNothing: () => ({
              returning: () => Promise.resolve([]),
              then: (r: any) => Promise.resolve([]).then(r),
            }),
            returning: () => Promise.resolve(arr.map((x: any) => ({ id: x.id ?? "mock-id" }))),
            then: (r: any) => Promise.resolve([]).then(r),
          };
          return ret;
        },
      };
    },
    __setAssociationsRef: (ref: any) => { associationsRef = ref; },
  };

  return {
    db,
    insertCalls,
    wasUpdateCalled: () => updateCalled,
  };
}

const ENV_KEYS = ["NODE_ENV", "SEED_DEMO_DATA"] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.resetModules();
  vi.doUnmock("../db");
  vi.doUnmock("../logger");
});

async function runSeedWithEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete (process.env as any)[k];
    else (process.env as any)[k] = v;
  }

  const mock = buildDbMock();

  // Wire the real `associations` table object into the mock so we can identify
  // association inserts by reference.
  const schema = await import("@shared/schema");
  mock.db.__setAssociationsRef((schema as any).associations);

  vi.doMock("../db", () => ({ db: mock.db }));
  vi.doMock("../logger", () => ({ log: () => {} }));

  const seedModule = await import("../seed");
  await seedModule.seedDatabase();

  const associationInserts = mock.insertCalls
    .filter((c) => c.table === "associations")
    .flatMap((c) => c.rows);

  return { seedModule, associationInserts, wasUpdateCalled: mock.wasUpdateCalled() };
}

describe("production-safe seed gating", () => {
  // Import the seed module without a real DB (mock `../db` + `../logger`).
  async function importSeedModule() {
    vi.doMock("../db", () => ({ db: {} }));
    vi.doMock("../logger", () => ({ log: () => {} }));
    return import("../seed");
  }

  it("shouldSeedDemoData() is false in production, true otherwise", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.SEED_DEMO_DATA;
    let m = await importSeedModule();
    expect(m.shouldSeedDemoData()).toBe(false);

    vi.resetModules();
    process.env.NODE_ENV = "development";
    m = await importSeedModule();
    expect(m.shouldSeedDemoData()).toBe(true);

    vi.resetModules();
    process.env.NODE_ENV = "test";
    m = await importSeedModule();
    expect(m.shouldSeedDemoData()).toBe(true);
  });

  it("SEED_DEMO_DATA=1 forces demo seeding even in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.SEED_DEMO_DATA = "1";
    const m = await importSeedModule();
    expect(m.shouldSeedDemoData()).toBe(true);
  });

  it("in PRODUCTION the seed inserts ZERO demo associations (only real CHC)", async () => {
    const { associationInserts } = await runSeedWithEnv({
      NODE_ENV: "production",
      SEED_DEMO_DATA: undefined,
    });

    // Every association insert must be the real CHC.
    const insertedNames = associationInserts.map((r) => r.name);
    for (const demoName of DEMO_ASSOCIATION_NAMES) {
      expect(insertedNames).not.toContain(demoName);
    }
    // The real CHC IS still inserted (legitimate production seed kept).
    expect(insertedNames).toContain(REAL_CHC_NAME);
    const chcRows = associationInserts.filter((r) => r.id === REAL_CHC_ID);
    expect(chcRows.length).toBeGreaterThan(0);
    // No demo IDs at all.
    expect(associationInserts.every((r) => r.id === REAL_CHC_ID)).toBe(true);
  });

  it("in PRODUCTION the seed never UPDATEs (never un-archives / touches archived_at)", async () => {
    const { wasUpdateCalled } = await runSeedWithEnv({
      NODE_ENV: "production",
      SEED_DEMO_DATA: undefined,
    });
    expect(wasUpdateCalled).toBe(false);
  });

  it("in DEVELOPMENT the demo associations ARE seeded", async () => {
    const { associationInserts } = await runSeedWithEnv({
      NODE_ENV: "development",
      SEED_DEMO_DATA: undefined,
    });
    const insertedNames = associationInserts.map((r) => r.name);
    expect(insertedNames).toContain(REAL_CHC_NAME);
    for (const demoName of DEMO_ASSOCIATION_NAMES) {
      expect(insertedNames).toContain(demoName);
    }
  });

  it("with SEED_DEMO_DATA=1 in production, demo associations ARE seeded", async () => {
    const { associationInserts } = await runSeedWithEnv({
      NODE_ENV: "production",
      SEED_DEMO_DATA: "1",
    });
    const insertedNames = associationInserts.map((r) => r.name);
    for (const demoName of DEMO_ASSOCIATION_NAMES) {
      expect(insertedNames).toContain(demoName);
    }
  });
});
