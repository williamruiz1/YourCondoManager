import { describe, it, expect } from "vitest";
import {
  slugifyCommunityName,
  sanitizeSlug,
  isReservedSlug,
  ensureUniqueSlug,
  RESERVED_COMMUNITY_SLUGS,
} from "./community-slug";

describe("slugifyCommunityName", () => {
  it("produces a clean, short, recognizable slug from a full legal name", () => {
    expect(slugifyCommunityName("Cherry Hill Court Condominiums")).toBe("cherryhill");
  });

  it("drops legal/structure suffixes and stop-words", () => {
    expect(slugifyCommunityName("The Oaks at Riverside HOA")).toBe("oaksriverside");
    expect(slugifyCommunityName("Maple Grove Condominium Association")).toBe("maplegrove");
    expect(slugifyCommunityName("Sunset Villas Homeowners Association, LLC")).toBe("sunset");
  });

  it("keeps numerals and distinctive tokens", () => {
    expect(slugifyCommunityName("123 Main")).toBe("123main");
  });

  it("strips accents to ascii", () => {
    expect(slugifyCommunityName("Cañada Verde")).toBe("canadaverde");
  });

  it("falls back to all words when the name is entirely structure words", () => {
    // "The Condominium Association" — all stop-words; must still yield something.
    const slug = slugifyCommunityName("The Condominium Association");
    expect(slug.length).toBeGreaterThan(0);
    expect(slug).toBe("thecondominiumassociation");
  });

  it("returns empty string for an empty / symbol-only name", () => {
    expect(slugifyCommunityName("")).toBe("");
    expect(slugifyCommunityName("!!! ???")).toBe("");
  });

  it("hyphenates + truncates very long distinctive names", () => {
    const slug = slugifyCommunityName(
      "Northwestern Mountainside Lakeview Meadowbrook Highlands Riverside Pointe",
    );
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).not.toMatch(/-$/); // no trailing hyphen
  });
});

describe("sanitizeSlug", () => {
  it("normalizes arbitrary input to the canonical slug shape", () => {
    expect(sanitizeSlug("  Cherry  Hill!! ")).toBe("cherry-hill");
    expect(sanitizeSlug("Already-Clean")).toBe("already-clean");
    expect(sanitizeSlug("__weird__chars__")).toBe("weird-chars");
  });

  it("returns empty string when nothing usable remains", () => {
    expect(sanitizeSlug("///")).toBe("");
  });
});

describe("isReservedSlug", () => {
  it("flags route/system + generic words (case-insensitive)", () => {
    expect(isReservedSlug("portal")).toBe(true);
    expect(isReservedSlug("API")).toBe(true);
    expect(isReservedSlug("Admin")).toBe(true);
    expect(isReservedSlug("community")).toBe(true);
  });

  it("does not flag a distinctive community slug", () => {
    expect(isReservedSlug("cherryhill")).toBe(false);
    expect(RESERVED_COMMUNITY_SLUGS.has("cherryhill")).toBe(false);
  });
});

describe("ensureUniqueSlug", () => {
  const never = async () => false;

  it("returns the base when it is free + not reserved", async () => {
    expect(await ensureUniqueSlug({ base: "cherryhill", isTaken: never })).toBe("cherryhill");
  });

  it("appends a numeric suffix on collision", async () => {
    const taken = new Set(["cherryhill", "cherryhill-2"]);
    const slug = await ensureUniqueSlug({
      base: "cherryhill",
      isTaken: async (c) => taken.has(c),
    });
    expect(slug).toBe("cherryhill-3");
  });

  it("escapes a reserved base word instead of using it raw", async () => {
    const slug = await ensureUniqueSlug({ base: "portal", isTaken: never });
    expect(slug).toBe("portal-community");
    expect(isReservedSlug(slug)).toBe(false);
  });

  it("falls back to the seed when the base is empty", async () => {
    const slug = await ensureUniqueSlug({
      base: "",
      fallbackSeed: "Riverbend Estates",
      isTaken: never,
    });
    expect(slug).toBe("riverbend-estates");
  });

  it("falls back to 'community' when base + seed are both empty", async () => {
    const slug = await ensureUniqueSlug({ base: "", fallbackSeed: "", isTaken: never });
    expect(slug).toBe("community-community"); // "community" is reserved -> escaped
  });

  it("uses a random tail when numeric suffixes are exhausted", async () => {
    const slug = await ensureUniqueSlug({
      base: "cherryhill",
      isTaken: async () => true, // everything taken
      maxAttempts: 3,
    });
    expect(slug).toMatch(/^cherryhill-[a-z0-9]{4}$/);
  });
});
