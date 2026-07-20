import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("client/src/App.tsx", "utf8");
const shellSource = readFileSync("client/src/pages/portal/portal-shell.tsx", "utf8");
const accountSource = readFileSync("client/src/pages/portal/portal-account.tsx", "utf8");
const routeSource = readFileSync("server/routes.ts", "utf8");
const amenitySource = readFileSync("server/routes/amenities.ts", "utf8");
const storageSource = readFileSync("server/storage.ts", "utf8");

describe("owner workflow continuity controls", () => {
  it("keeps profile, occupancy, notification, and privacy controls reachable", () => {
    expect(appSource).toContain('path="/portal/account"');
    expect(shellSource).toContain('href="/portal/account"');
    expect(accountSource).toContain('defaultValue="profile"');
    expect(accountSource).toContain('value="occupancy"');
    expect(accountSource).toContain('value="notifications"');
    expect(accountSource).toContain('value="privacy"');
  });

  it("binds every account mutation to its authenticated owner endpoint", () => {
    expect(accountSource).toContain('portalFetch("/api/portal/me"');
    expect(accountSource).toContain('portalFetch("/api/portal/me/sms-opt-in"');
    expect(accountSource).toContain('portalFetch("/api/portal/occupancy"');
    expect(accountSource).toContain('portalFetch("/api/portal/push/vapid-public-key"');
    expect(accountSource).toContain('href="/portal/privacy/my-consents"');
  });

  it("sends real maintenance status email and records delivery evidence", () => {
    const start = storageSource.indexOf("async updateMaintenanceRequest");
    const block = storageSource.slice(start, start + 5200);
    expect(block).toContain("sendPlatformEmail({");
    expect(block).toContain('templateKey: "maintenance-request-status-owner"');
    expect(block).toContain("deliveryStatus");
    expect(block).toContain("providerMessageId");
  });

  it("notifies both sides of contact and occupancy mutations", () => {
    expect(routeSource).toContain('templateKey: "contact-update-request-owner"');
    expect(routeSource).toContain('templateKey: "contact-update-request-admin"');
    expect(routeSource).toContain('templateKey: "contact-update-review-owner"');
    expect(routeSource).toContain('templateKey: "occupancy-update-owner"');
    expect(routeSource).toContain('templateKey: "occupancy-update-admin"');
    expect(storageSource).toContain(".update(portalAccess)");
    expect(storageSource).toContain(".where(eq(portalAccess.personId, result.personId))");
  });

  it("notifies owners through the amenity reservation lifecycle", () => {
    expect(amenitySource).toContain('templateKey: "amenity-reservation-created-owner"');
    expect(amenitySource).toContain('templateKey: "amenity-reservation-status-owner"');
    expect(amenitySource).toContain('templateKey: "amenity-reservation-cancelled-owner"');
    expect(amenitySource).toContain('templateKey: "amenity-reservation-admin"');
  });
});
