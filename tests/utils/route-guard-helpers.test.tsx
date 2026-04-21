/**
 * Unit tests for `renderWithAuth` (tests/utils/route-guard-helpers.tsx).
 *
 * These tests protect the ADR 0b OQ-1 Option A contract: seeding the
 * shared `["/api/auth/me", "session"]` cache entry must make
 * `useAdminRole()` resolve synchronously without triggering any network
 * or auth context plumbing.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { useLocation } from "wouter";

import { renderWithAuth } from "./route-guard-helpers";
import { useAdminRole } from "@/hooks/useAdminRole";

function Probe() {
  const { role, authResolved } = useAdminRole();
  return (
    <div data-testid="probe">
      {authResolved ? (role ?? "null") : "loading"}
    </div>
  );
}

function LocationProbe() {
  const [location] = useLocation();
  return <div data-testid="location">{location}</div>;
}

describe("renderWithAuth", () => {
  it("seeds an authenticated admin session so useAdminRole() returns the role synchronously", () => {
    renderWithAuth(<Probe />, { role: "manager" });

    // Synchronous: no waitFor — the cache is pre-seeded before the first
    // render, so useAdminRole resolves on the initial commit.
    expect(screen.getByTestId("probe")).toHaveTextContent("manager");
  });

  it.each([
    "platform-admin",
    "manager",
    "board-officer",
    "assisted-board",
    "pm-assistant",
    "viewer",
  ] as const)(
    "seeds role=%s and useAdminRole() reports it",
    (role) => {
      renderWithAuth(<Probe />, { role });
      expect(screen.getByTestId("probe")).toHaveTextContent(role);
    },
  );

  it("with role=null + authResolved=true reports { role: null, authResolved: true }", () => {
    renderWithAuth(<Probe />, { role: null, authResolved: true });

    // authResolved is true but role is null → probe renders the string "null"
    // (because we surface `role ?? "null"` when resolved).
    expect(screen.getByTestId("probe")).toHaveTextContent("null");
  });

  it("with no options defaults to role=null + authResolved=true (unauthenticated)", () => {
    renderWithAuth(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("null");
  });

  it("with authResolved=false reports loading state (isLoading=true, role=null)", () => {
    renderWithAuth(<Probe />, { authResolved: false });

    // authResolved is false → probe renders "loading".
    expect(screen.getByTestId("probe")).toHaveTextContent("loading");
  });

  it("provides wouter routing context (useLocation() works without throwing)", () => {
    renderWithAuth(<LocationProbe />, { role: "manager", initialPath: "/app/hello" });

    expect(screen.getByTestId("location")).toHaveTextContent("/app/hello");
  });

  it("defaults initialPath to '/' when not specified", () => {
    renderWithAuth(<LocationProbe />, { role: "manager" });

    expect(screen.getByTestId("location")).toHaveTextContent("/");
  });
});
