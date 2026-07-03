/**
 * Tests for the tenant sending-alias resolver
 * (feature: per-HOA / per-PM sending identity).
 *
 * Maps to docs/operations/tenant-sending-alias-spec.md §7 acceptance tests:
 *   R1 slug gen + validate
 *   R2 reserved local-parts rejected
 *   R3 resolver derives From/display/Reply-To from associationId only
 *   R4 a tenant cannot resolve as another tenant's alias
 *   R5 flag OFF → global default (unchanged behavior)
 *   R7 owner-facing send uses the alias when flag ON + associationId present
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the DB so resolveTenantSender / isSlugAvailable are testable without a
// real Postgres. We capture the WHERE-keyed lookup to prove the resolver only
// ever returns the row for the association it was asked about.
const dbState: {
  rows: Array<{
    associationId: string;
    emailSlug: string | null;
    emailDisplayName: string | null;
    emailReplyToOverride: string | null;
    supportEmail: string | null;
  }>;
  lastWhereAssociationId: string | null;
} = { rows: [], lastWhereAssociationId: null };

vi.mock("../../db", () => {
  // A tiny chainable stub that records the equality target and returns the
  // matching rows from dbState.
  function makeQuery() {
    let whereAssoc: string | null = null;
    const chain: any = {
      from() {
        return chain;
      },
      where(predicate: any) {
        // Our resolver always filters by associationId; the predicate carries it.
        whereAssoc = predicate?.__assoc ?? null;
        dbState.lastWhereAssociationId = whereAssoc;
        const rows = dbState.rows.filter((r) => r.associationId === whereAssoc);
        return Promise.resolve(rows);
      },
    };
    return chain;
  }
  return {
    db: {
      select() {
        return makeQuery();
      },
    },
  };
});

// Partially mock drizzle-orm: keep the REAL module (so shared/schema.ts can use
// sql/pgTable/etc.) and override only the operators our resolver passes to
// `.where(...)`, so the stub predicate carries the association id we key on.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: any, val: any) =>
      ({ __col: col, __assoc: typeof val === "string" ? val : null, __op: "eq", __val: val }) as any,
    and: (...preds: any[]) => {
      const assoc = preds.find(
        (p) => p && p.__op === "eq" && typeof p.__val === "string" && p.__col !== undefined,
      );
      return { __assoc: assoc?.__assoc ?? null, __preds: preds } as any;
    },
    ne: (col: any, val: any) => ({ __op: "ne", __col: col, __val: val }) as any,
    isNotNull: (col: any) => ({ __op: "isNotNull", __col: col }) as any,
  };
});

import {
  slugifyAssociationName,
  validateSlug,
  composeFromHeader,
  aliasAddress,
  composeTenantSender,
  globalDefaultSender,
  isTenantAliasEnabled,
  resolveTenantSender,
  RESERVED_LOCAL_PARTS,
  SENDING_DOMAIN,
} from "../tenant-sender";

const ENABLED_ENV = { TENANT_SENDING_ALIAS_ENABLED: "true" } as NodeJS.ProcessEnv;

beforeEach(() => {
  dbState.rows = [];
  dbState.lastWhereAssociationId = null;
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("R1 — slug generation + validation", () => {
  it("slugifies an association name safely", () => {
    expect(slugifyAssociationName("Cherry Hill Court")).toBe("cherry-hill-court");
    expect(slugifyAssociationName("  The Oaks @ Lakeside!! ")).toBe("the-oaks-lakeside");
    expect(slugifyAssociationName("A&B  --  C")).toBe("a-b-c");
  });

  it("clamps to max length and trims a trailing hyphen", () => {
    const long = "x".repeat(60);
    const s = slugifyAssociationName(long);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });

  it("accepts a valid slug", () => {
    expect(validateSlug("cherryhill")).toEqual({ ok: true, slug: "cherryhill" });
    expect(validateSlug("Cherry-Hill-2")).toEqual({ ok: true, slug: "cherry-hill-2" });
  });

  it("rejects too-short, too-long, and malformed slugs", () => {
    expect(validateSlug("ab").ok).toBe(false);
    expect(validateSlug("x".repeat(41)).ok).toBe(false);
    expect(validateSlug("-lead").ok).toBe(false);
    expect(validateSlug("trail-").ok).toBe(false);
    expect(validateSlug("has space").ok).toBe(false);
    expect(validateSlug("UPPER_only").ok).toBe(false); // underscore not allowed
  });

  it("composes the alias address on the verified domain", () => {
    expect(aliasAddress("cherryhill")).toBe(`cherryhill@${SENDING_DOMAIN}`);
  });
});

describe("R2 — reserved local-parts cannot be claimed", () => {
  it("rejects every reserved local-part", () => {
    for (const reserved of RESERVED_LOCAL_PARTS) {
      const v = validateSlug(reserved);
      expect(v.ok, `expected "${reserved}" to be rejected`).toBe(false);
    }
  });

  it("specifically protects the legal/policy aliases", () => {
    for (const legal of ["support", "privacy", "legal", "noreply", "contact"]) {
      expect(validateSlug(legal).ok).toBe(false);
    }
  });
});

describe("composeFromHeader — safe RFC header", () => {
  it("quotes the display name", () => {
    expect(composeFromHeader("Cherry Hill Court", "cherryhill@yourcondomanager.org")).toBe(
      `"Cherry Hill Court" <cherryhill@yourcondomanager.org>`,
    );
  });
  it("strips header-injection characters (CR/LF/quotes) from the display name", () => {
    const out = composeFromHeader('Evil"\r\nBcc: x@y.com', "a@yourcondomanager.org");
    expect(out).not.toContain("\r");
    expect(out).not.toContain("\n");
    // The injected quote is collapsed so it cannot terminate the quoted-string.
    expect(out).toBe('"Evil Bcc: x@y.com" <a@yourcondomanager.org>');
  });
  it("falls back to bare address when display name is empty", () => {
    expect(composeFromHeader("", "a@yourcondomanager.org")).toBe("a@yourcondomanager.org");
    expect(composeFromHeader(null, "a@yourcondomanager.org")).toBe("a@yourcondomanager.org");
  });
});

describe("R3/R5 — composeTenantSender (pure) derives sender; falls back", () => {
  it("derives From + display + Reply-To from config fields", () => {
    const s = composeTenantSender(
      {
        emailSlug: "cherryhill",
        emailDisplayName: "Cherry Hill Court",
        emailReplyToOverride: null,
        supportEmail: "board@cherryhill.org",
      },
      ENABLED_ENV,
    );
    expect(s).not.toBeNull();
    expect(s!.fromHeader).toBe(`"Cherry Hill Court" <cherryhill@${SENDING_DOMAIN}>`);
    expect(s!.fromAddress).toBe(`cherryhill@${SENDING_DOMAIN}`);
    expect(s!.replyTo).toBe("board@cherryhill.org");
    expect(s!.source).toBe("tenant-alias");
  });

  it("prefers an explicit reply-to override over supportEmail", () => {
    const s = composeTenantSender({
      emailSlug: "cherryhill",
      emailDisplayName: "CH",
      emailReplyToOverride: "replies@cherryhill.org",
      supportEmail: "board@cherryhill.org",
    });
    expect(s!.replyTo).toBe("replies@cherryhill.org");
  });

  it("returns null (→ global default) when no slug is configured", () => {
    expect(composeTenantSender({ emailSlug: null })).toBeNull();
    expect(composeTenantSender({ emailSlug: "" })).toBeNull();
    expect(composeTenantSender(null)).toBeNull();
  });

  it("refuses a slug that is (now) reserved/invalid on read", () => {
    // A stored slug that later became reserved must NOT be used to send.
    expect(composeTenantSender({ emailSlug: "support" })).toBeNull();
  });

  it("globalDefaultSender uses env defaults", () => {
    const g = globalDefaultSender({
      EMAIL_FROM_ADDRESS: "noreply@yourcondomanager.org",
      EMAIL_FROM_NAME: "Your Condo Manager",
      EMAIL_REPLY_TO: "contact@yourcondomanager.org",
    } as NodeJS.ProcessEnv);
    expect(g.source).toBe("global-default");
    expect(g.fromHeader).toBe(`"Your Condo Manager" <noreply@yourcondomanager.org>`);
    expect(g.replyTo).toBe("contact@yourcondomanager.org");
  });
});

describe("isTenantAliasEnabled — flag gate", () => {
  it("is OFF by default and for falsy values", () => {
    expect(isTenantAliasEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isTenantAliasEnabled({ TENANT_SENDING_ALIAS_ENABLED: "0" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isTenantAliasEnabled({ TENANT_SENDING_ALIAS_ENABLED: "false" } as NodeJS.ProcessEnv)).toBe(false);
  });
  it("is ON for truthy values", () => {
    for (const v of ["1", "true", "yes", "on", "TRUE"]) {
      expect(isTenantAliasEnabled({ TENANT_SENDING_ALIAS_ENABLED: v } as NodeJS.ProcessEnv)).toBe(true);
    }
  });
});

describe("R5 — resolveTenantSender returns global default when flag OFF", () => {
  it("ignores a configured alias when the flag is off", async () => {
    dbState.rows = [
      {
        associationId: "assoc-1",
        emailSlug: "cherryhill",
        emailDisplayName: "Cherry Hill",
        emailReplyToOverride: null,
        supportEmail: "board@cherryhill.org",
      },
    ];
    const s = await resolveTenantSender("assoc-1", {
      EMAIL_FROM_ADDRESS: "noreply@yourcondomanager.org",
    } as NodeJS.ProcessEnv);
    expect(s.source).toBe("global-default");
    expect(s.fromAddress).toBe("noreply@yourcondomanager.org");
  });

  it("returns global default for a null associationId even when flag ON", async () => {
    const s = await resolveTenantSender(null, ENABLED_ENV);
    expect(s.source).toBe("global-default");
  });
});

describe("R3/R7 — resolveTenantSender returns the tenant alias when flag ON", () => {
  it("derives the alias for the requested association", async () => {
    dbState.rows = [
      {
        associationId: "assoc-1",
        emailSlug: "cherryhill",
        emailDisplayName: "Cherry Hill Court",
        emailReplyToOverride: null,
        supportEmail: "board@cherryhill.org",
      },
    ];
    const s = await resolveTenantSender("assoc-1", ENABLED_ENV);
    expect(s.source).toBe("tenant-alias");
    expect(s.fromAddress).toBe(`cherryhill@${SENDING_DOMAIN}`);
    expect(s.replyTo).toBe("board@cherryhill.org");
  });
});

describe("R4 — a tenant CANNOT resolve as another tenant's alias", () => {
  it("only ever returns the alias for the requested associationId", async () => {
    dbState.rows = [
      {
        associationId: "assoc-A",
        emailSlug: "alpha",
        emailDisplayName: "Alpha HOA",
        emailReplyToOverride: null,
        supportEmail: "a@alpha.org",
      },
      {
        associationId: "assoc-B",
        emailSlug: "bravo",
        emailDisplayName: "Bravo HOA",
        emailReplyToOverride: null,
        supportEmail: "b@bravo.org",
      },
    ];

    const a = await resolveTenantSender("assoc-A", ENABLED_ENV);
    expect(a.fromAddress).toBe(`alpha@${SENDING_DOMAIN}`);
    // The DB lookup was keyed by the requested association — never the other one.
    expect(dbState.lastWhereAssociationId).toBe("assoc-A");

    const b = await resolveTenantSender("assoc-B", ENABLED_ENV);
    expect(b.fromAddress).toBe(`bravo@${SENDING_DOMAIN}`);
    expect(dbState.lastWhereAssociationId).toBe("assoc-B");

    // assoc-A's resolved alias is NEVER bravo's, and vice versa — there is no
    // code path by which one association resolves to another's alias.
    expect(a.fromAddress).not.toBe(b.fromAddress);
  });

  it("falls back to global default (NOT another tenant) when the association has no alias", async () => {
    dbState.rows = [
      {
        associationId: "assoc-A",
        emailSlug: "alpha",
        emailDisplayName: "Alpha HOA",
        emailReplyToOverride: null,
        supportEmail: "a@alpha.org",
      },
    ];
    // assoc-C has no row → must NOT borrow assoc-A's alias.
    const c = await resolveTenantSender("assoc-C", {
      ...ENABLED_ENV,
      EMAIL_FROM_ADDRESS: "noreply@yourcondomanager.org",
    } as NodeJS.ProcessEnv);
    expect(c.source).toBe("global-default");
    expect(c.fromAddress).toBe("noreply@yourcondomanager.org");
  });
});
