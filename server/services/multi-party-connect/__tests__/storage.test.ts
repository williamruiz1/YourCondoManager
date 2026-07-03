/**
 * Unit tests for the pure metadata-reader + flag of the multi-party Connect
 * storage layer. The DB-bound upsert/find paths are exercised via the
 * resolver tests' storage mock; here we test the pure parsing + flag gate
 * (no DB, no Stripe).
 */

import { afterEach, describe, expect, it } from "vitest";
import { readPmRelationshipFromConnection } from "../metadata";
import { isMultiPartyConnectEnabled } from "../flag";
import type { PmRelationshipState } from "../types";

const valid: PmRelationshipState = {
  mode: "pm-relationship",
  pmConnectedAccountId: "acct_PM",
  pmDisplayName: "Acme PM",
  pmFeeBps: 500,
  flow3Routing: "hoa-direct",
  trustAccountId: null,
  updatedAt: new Date().toISOString(),
};

describe("readPmRelationshipFromConnection", () => {
  it("returns null for missing / non-object metadata", () => {
    expect(readPmRelationshipFromConnection({ metadataJson: null })).toBeNull();
    expect(readPmRelationshipFromConnection({ metadataJson: undefined as never })).toBeNull();
    expect(readPmRelationshipFromConnection({ metadataJson: [] as never })).toBeNull();
  });

  it("returns null when _pmRelationship key absent (e.g. only _connect present)", () => {
    expect(
      readPmRelationshipFromConnection({ metadataJson: { _connect: { mode: "connect" } } }),
    ).toBeNull();
  });

  it("returns null when mode is wrong or account id missing", () => {
    expect(
      readPmRelationshipFromConnection({ metadataJson: { _pmRelationship: { mode: "connect" } } }),
    ).toBeNull();
    expect(
      readPmRelationshipFromConnection({
        metadataJson: { _pmRelationship: { mode: "pm-relationship", pmConnectedAccountId: "" } },
      }),
    ).toBeNull();
  });

  it("parses a valid relationship and preserves coexisting metadata", () => {
    const meta = { _connect: { mode: "connect" }, _pmRelationship: valid };
    const result = readPmRelationshipFromConnection({ metadataJson: meta });
    expect(result).toEqual(valid);
  });
});

describe("isMultiPartyConnectEnabled (default OFF)", () => {
  const KEY = "MULTI_PARTY_CONNECT_ENABLED";
  const original = process.env[KEY];
  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it("is OFF by default (unset)", () => {
    delete process.env[KEY];
    expect(isMultiPartyConnectEnabled()).toBe(false);
  });

  it.each(["1", "true", "yes", "on", "TRUE", "On"])("is ON for %s", (v) => {
    process.env[KEY] = v;
    expect(isMultiPartyConnectEnabled()).toBe(true);
  });

  it.each(["0", "false", "no", "off", "", "maybe"])("is OFF for %s", (v) => {
    process.env[KEY] = v;
    expect(isMultiPartyConnectEnabled()).toBe(false);
  });
});
