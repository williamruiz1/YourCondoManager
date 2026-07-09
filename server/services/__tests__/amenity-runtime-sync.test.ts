/**
 * Amenity GL runtime sync — Slice 5 orchestration suite (founder-os#10181).
 *
 * Verifies the wrapper that wires the previously-ORPHANED syncAssociationAmenityGl
 * into a live trigger, and the latent-bug fix it depends on:
 *   1. PER-ASSOC — gates on isGlEnabledForAssociation (NOT the global isGlEnabled),
 *      so the CHC-only allowlist rollout activates amenity posting for CHC without
 *      flipping it on for everyone. This is the Slice-5 bug fix.
 *   2. NON-FATAL — a GL-sync error never propagates into the money path.
 *   3. FORWARD    — delegates to syncAssociationAmenityGl with { force: true } once
 *      the gate passes (the writer still validates invariants before writing).
 *
 * The DB writer is mocked so the GATE LOGIC is tested without a live database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the amenity GL DB writer so we can assert it's (not) called + force errors.
let syncBehavior: "ok" | "throw" = "ok";
const syncSpy = vi.fn();
vi.mock("../gl/amenity-posting-service", () => ({
  syncAssociationAmenityGl: async (associationId: string, opts: any) => {
    syncSpy(associationId, opts);
    if (syncBehavior === "throw") throw new Error("amenity db exploded");
    return {
      skipped: false,
      accountsSeeded: 13,
      reservationsConsidered: 1,
      journalsConsidered: 2,
      legsInserted: 4,
    };
  },
}));

import {
  maybeSyncAssociationAmenityGl,
  syncAssociationAmenityGlGated,
} from "../gl/amenity-runtime-sync";

const ASSOC = "assoc-1";

beforeEach(() => {
  syncBehavior = "ok";
  syncSpy.mockClear();
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});
afterEach(() => {
  vi.clearAllMocks();
  delete process.env.GL_ENABLED;
  delete process.env.GL_ENABLED_ASSOCIATIONS;
});

describe("syncAssociationAmenityGlGated — per-association enablement gate (Slice-5 bug fix)", () => {
  it("skips when the GL is not enabled (no flag, not allowlisted) — never posts", async () => {
    const out = await syncAssociationAmenityGlGated(ASSOC);
    expect(out).toEqual({ posted: false, reason: "not-enabled" });
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it("runs when the association is on the GL_ENABLED_ASSOCIATIONS allowlist (the CHC-only rollout)", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = `other,${ASSOC}`;
    const out = await syncAssociationAmenityGlGated(ASSOC);
    expect(out.posted).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith(ASSOC, { force: true });
  });

  it("runs when the global GL_ENABLED flag is on", async () => {
    process.env.GL_ENABLED = "1";
    const out = await syncAssociationAmenityGlGated(ASSOC);
    expect(out.posted).toBe(true);
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT enable a non-allowlisted association when others are listed (the bug that would've broken CHC rollout)", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = "someone-else";
    const out = await syncAssociationAmenityGlGated(ASSOC);
    expect(out).toEqual({ posted: false, reason: "not-enabled" });
    expect(syncSpy).not.toHaveBeenCalled();
  });
});

describe("maybeSyncAssociationAmenityGl — NON-FATAL best-effort wrapper", () => {
  it("swallows a DB error and reports it (never throws into the money path)", async () => {
    process.env.GL_ENABLED_ASSOCIATIONS = ASSOC;
    syncBehavior = "throw";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await maybeSyncAssociationAmenityGl(ASSOC, "amenity-booking-capture");
    expect(out.posted).toBe(false);
    if (!out.posted) expect(out.reason).toBe("error");
    errSpy.mockRestore();
  });

  it("returns the not-enabled outcome cleanly when disabled (the common default)", async () => {
    const out = await maybeSyncAssociationAmenityGl(ASSOC, "amenity-booking-capture");
    expect(out).toEqual({ posted: false, reason: "not-enabled" });
  });

  it("reports posted with the legs inserted on the happy path", async () => {
    process.env.GL_ENABLED = "1";
    const out = await maybeSyncAssociationAmenityGl(ASSOC, "amenity-deposit-resolution");
    expect(out.posted).toBe(true);
    if (out.posted) expect(out.result.legsInserted).toBe(4);
  });
});
