/**
 * migration-health-skippable.test.ts — founder-os#14790
 *
 * Pins the environment-skippable-migration allowlist added to
 * server/migration-health.ts, and — more importantly — pins that the
 * pre-existing OP #2476 guarantee is UNCHANGED when the allowlist is unset
 * (i.e. on prod, staging, dev and CI).
 *
 * The originating defect: the redesign-preview app runs an unmanaged Fly
 * postgres-flex DB with no `vector` extension, so 0034_pgvector_extension and
 * 0035_document_embeddings can never apply there. That made health "stale" →
 * /api/health 503 → Fly proxy marked every route unhealthy on the preview app.
 * Prod and staging run Neon (founder-os#2470), which ships pgvector, so they
 * are unaffected and MUST keep failing closed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../logger", () => ({ log: () => {} }));

const TAG_A = "0034_pgvector_extension";
const TAG_B = "0035_document_embeddings";
const TAG_OK = "0001_baseline";

/** Build a throwaway migrations/ tree and point process.cwd() at it. */
function makeJournal(tags: string[]): { dir: string; sqlByTag: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), "mh-test-"));
  mkdirSync(join(dir, "migrations", "meta"), { recursive: true });
  const sqlByTag: Record<string, string> = {};
  tags.forEach((tag, i) => {
    const sql = `-- ${tag}\nSELECT ${i};\n`;
    sqlByTag[tag] = sql;
    writeFileSync(join(dir, "migrations", `${tag}.sql`), sql);
  });
  writeFileSync(
    join(dir, "migrations", "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: tags.map((tag, idx) => ({
        idx,
        version: "7",
        when: 1700000000000 + idx,
        tag,
        breakpoints: true,
      })),
    }),
  );
  return { dir, sqlByTag };
}

function sha256(s: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("node:crypto").createHash("sha256").update(Buffer.from(s)).digest("hex");
}

/** Minimal pg.Pool stand-in returning the given applied hashes. */
function poolWith(hashes: string[]) {
  return {
    query: async () => ({ rows: hashes.map((hash) => ({ hash })) }),
  } as never;
}

describe("migration health — environment-skippable allowlist (founder-os#14790)", () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  const dirs: string[] = [];
  const ORIGINAL = process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS;
  });

  afterEach(() => {
    cwdSpy?.mockRestore();
    if (ORIGINAL === undefined) delete process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS;
    else process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS = ORIGINAL;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  async function run(tags: string[], appliedTags: string[]) {
    const { dir, sqlByTag } = makeJournal(tags);
    dirs.push(dir);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
    const mod = await import("../migration-health");
    return mod.runMigrationHealthCheck(poolWith(appliedTags.map((t) => sha256(sqlByTag[t]))));
  }

  it("REGRESSION GUARD: allowlist unset (prod/staging/dev/CI) → unapplied migrations still go stale", async () => {
    const health = await run([TAG_OK, TAG_A, TAG_B], [TAG_OK]);
    expect(health.status).toBe("stale");
    expect(health.missing).toEqual([TAG_A, TAG_B]);
    expect(health.skipped).toEqual([]);
  });

  it("allowlisted unapplied migrations do NOT flip status to stale", async () => {
    process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS = `${TAG_A},${TAG_B}`;
    const health = await run([TAG_OK, TAG_A, TAG_B], [TAG_OK]);
    expect(health.status).toBe("ok");
    expect(health.missing).toEqual([]);
  });

  it("allowlisted-but-unapplied tags are REPORTED under `skipped`, never hidden", async () => {
    process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS = `${TAG_A},${TAG_B}`;
    const health = await run([TAG_OK, TAG_A, TAG_B], [TAG_OK]);
    expect(health.skipped).toEqual([TAG_A, TAG_B]);
  });

  it("a NON-allowlisted missing migration still goes stale even when the allowlist is set", async () => {
    process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS = TAG_A;
    const health = await run([TAG_OK, TAG_A, TAG_B], [TAG_OK]);
    expect(health.status).toBe("stale");
    expect(health.missing).toEqual([TAG_B]); // B is NOT allowlisted
    expect(health.skipped).toEqual([TAG_A]);
  });

  it("an allowlisted migration that DID apply appears in neither missing nor skipped", async () => {
    process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS = TAG_A;
    const health = await run([TAG_OK, TAG_A], [TAG_OK, TAG_A]);
    expect(health.status).toBe("ok");
    expect(health.missing).toEqual([]);
    expect(health.skipped).toEqual([]);
  });

  it("empty / whitespace-only allowlist behaves exactly like unset (fails closed)", async () => {
    process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS = "  ,  , ";
    const health = await run([TAG_OK, TAG_A], [TAG_OK]);
    expect(health.status).toBe("stale");
    expect(health.missing).toEqual([TAG_A]);
    expect(health.skipped).toEqual([]);
  });

  it("tolerates spaces around commas in the allowlist", async () => {
    process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS = ` ${TAG_A} , ${TAG_B} `;
    const health = await run([TAG_OK, TAG_A, TAG_B], [TAG_OK]);
    expect(health.status).toBe("ok");
    expect(health.skipped).toEqual([TAG_A, TAG_B]);
  });

  it("all migrations applied → ok, regardless of allowlist contents", async () => {
    process.env.MIGRATION_HEALTH_SKIPPABLE_TAGS = `${TAG_A},${TAG_B}`;
    const health = await run([TAG_OK, TAG_A, TAG_B], [TAG_OK, TAG_A, TAG_B]);
    expect(health.status).toBe("ok");
    expect(health.missing).toEqual([]);
    expect(health.skipped).toEqual([]);
  });
});
