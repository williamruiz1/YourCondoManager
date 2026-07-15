/**
 * Pure-logic unit tests for the Violations MANAGEMENT service
 * (founder-os#10569, YCM Redesign M8).
 *
 * Covers the DB-free business rules directly:
 *   - computeManagementStats — the 4 stat-row tiles the wireframe shows
 *     (Open / Notice sent / Escalated / Cured 30d), including the
 *     "3 over 30 days" and "cured in the last 30 days" date-window math.
 *   - ordinalNoticeLabel — "Notice sent" / "2nd notice sent" / "3rd notice
 *     sent" / "4th notice sent" labeling used in the timeline.
 *   - isLegalTransition / ALLOWED_TRANSITIONS — the status-transition guard
 *     that turns a nonsensical status jump into a 409, not a silent write.
 *
 * DB-touching functions (listViolationsForManagement, getViolationDetail,
 * sendViolationNotice, transitionViolationStatus) are exercised at the ROUTE
 * layer instead (server/routes/__tests__/violations-management.test.ts),
 * with the service mocked — the same pattern already used for
 * server/routes/__tests__/arc.test.ts. The service module still does
 * `import { db } from "../db"` at load time (which throws without
 * DATABASE_URL), so — mirroring violation-triage-service.test.ts — stub it
 * minimally here; none of the functions under test in this file touch it.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ db: {} }));

import {
  ALLOWED_TRANSITIONS,
  computeManagementStats,
  isLegalTransition,
  ordinalNoticeLabel,
  type ViolationStatus,
} from "../violations-management-service";

describe("computeManagementStats", () => {
  const NOW = new Date("2026-07-14T12:00:00.000Z").getTime();
  const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

  it("counts open, notice-sent, and escalated at face value", () => {
    const rows = [
      { status: "open" as ViolationStatus, observedAt: daysAgo(1), updatedAt: daysAgo(1) },
      { status: "notice-sent" as ViolationStatus, observedAt: daysAgo(5), updatedAt: daysAgo(5) },
      { status: "notice-sent" as ViolationStatus, observedAt: daysAgo(10), updatedAt: daysAgo(10) },
      { status: "escalated" as ViolationStatus, observedAt: daysAgo(40), updatedAt: daysAgo(2) },
    ];
    const stats = computeManagementStats(rows, NOW);
    expect(stats.open).toBe(1);
    expect(stats.noticeSent).toBe(2);
    expect(stats.escalated).toBe(1);
  });

  it("flags an OPEN violation observed more than 30 days ago as openOver30Days", () => {
    const rows = [
      { status: "open" as ViolationStatus, observedAt: daysAgo(31), updatedAt: daysAgo(31) },
      { status: "open" as ViolationStatus, observedAt: daysAgo(29), updatedAt: daysAgo(29) },
    ];
    const stats = computeManagementStats(rows, NOW);
    expect(stats.open).toBe(2);
    expect(stats.openOver30Days).toBe(1);
  });

  it("only counts a CURED violation toward curedLast30Days if updatedAt is within 30 days", () => {
    const rows = [
      { status: "cured" as ViolationStatus, observedAt: daysAgo(60), updatedAt: daysAgo(10) }, // cured recently
      { status: "cured" as ViolationStatus, observedAt: daysAgo(90), updatedAt: daysAgo(45) }, // cured long ago
    ];
    const stats = computeManagementStats(rows, NOW);
    expect(stats.curedLast30Days).toBe(1);
  });

  it("returns all-zero stats for an empty list", () => {
    expect(computeManagementStats([], NOW)).toEqual({
      open: 0,
      openOver30Days: 0,
      noticeSent: 0,
      escalated: 0,
      curedLast30Days: 0,
    });
  });

  it("does not count `closed` toward any tile (matches the wireframe's 4-tile stat row)", () => {
    const rows = [{ status: "closed" as ViolationStatus, observedAt: daysAgo(1), updatedAt: daysAgo(1) }];
    const stats = computeManagementStats(rows, NOW);
    expect(stats).toEqual({ open: 0, openOver30Days: 0, noticeSent: 0, escalated: 0, curedLast30Days: 0 });
  });
});

describe("ordinalNoticeLabel", () => {
  it("labels the 1st, 2nd, 3rd, and 4th+ notices per the wireframe's timeline copy", () => {
    expect(ordinalNoticeLabel(1)).toBe("Notice sent");
    expect(ordinalNoticeLabel(2)).toBe("2nd notice sent");
    expect(ordinalNoticeLabel(3)).toBe("3rd notice sent");
    expect(ordinalNoticeLabel(4)).toBe("4th notice sent");
    expect(ordinalNoticeLabel(11)).toBe("11th notice sent");
  });
});

describe("isLegalTransition / ALLOWED_TRANSITIONS", () => {
  it("allows open -> notice-sent -> cured (the common happy path)", () => {
    expect(isLegalTransition("open", "notice-sent")).toBe(true);
    expect(isLegalTransition("notice-sent", "cured")).toBe(true);
  });

  it("allows escalating directly from open (no notice required first)", () => {
    expect(isLegalTransition("open", "escalated")).toBe(true);
  });

  it("allows re-opening a cured or closed case (a repeat offense)", () => {
    expect(isLegalTransition("cured", "open")).toBe(true);
    expect(isLegalTransition("closed", "open")).toBe(true);
  });

  it("allows a status to transition to itself (idempotent no-op)", () => {
    for (const s of Object.keys(ALLOWED_TRANSITIONS) as ViolationStatus[]) {
      expect(isLegalTransition(s, s)).toBe(true);
    }
  });

  it("rejects an unknown/garbage status pairing gracefully (false, not a throw)", () => {
    expect(isLegalTransition("open", "not-a-real-status" as ViolationStatus)).toBe(false);
  });

  it("every status has at least one allowed transition (never a dead end)", () => {
    for (const s of Object.keys(ALLOWED_TRANSITIONS) as ViolationStatus[]) {
      expect(ALLOWED_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });
});
