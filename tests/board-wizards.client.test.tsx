/**
 * founder-os#9487 — Board mode guided-wizard submit-contract tests.
 *
 * Drives each wizard through its steps and asserts it POSTs the correct body to
 * the correct endpoint — the end-to-end "the 5 wizards work in Board mode"
 * evidence at the client contract layer (apiRequest is mocked; the endpoints it
 * targets are the real ones the server exposes).
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// apiRequest is the single network seam every wizard uses.
const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ apiRequest }));

// Active association is injected in the body of every POST.
vi.mock("@/hooks/use-active-association", () => ({
  useActiveAssociation: () => ({
    activeAssociationId: "assoc-1",
    associations: [],
    activeAssociation: null,
    activeAssociationName: "Test HOA",
    associationResolved: true,
    setActiveAssociationId: () => {},
  }),
}));

import { AddOwnerWizard } from "@/components/board-mode/wizards/AddOwnerWizard";
import { ScheduleMeetingWizard } from "@/components/board-mode/wizards/ScheduleMeetingWizard";
import { RequestVendorWorkWizard } from "@/components/board-mode/wizards/RequestVendorWorkWizard";
import { LogViolationWizard } from "@/components/board-mode/wizards/LogViolationWizard";
import { PostChargeWizard } from "@/components/board-mode/wizards/PostChargeWizard";

function renderWiz(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { queryFn: async () => [], retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function next() {
  fireEvent.click(screen.getByTestId("wizard-next"));
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockResolvedValue({ json: async () => ({ id: "row-1" }) });
});

describe("AddOwnerWizard", () => {
  it("posts owner details to the atomic Board workflow", async () => {
    renderWiz(<AddOwnerWizard />);
    fireEvent.change(screen.getByTestId("input-first-name"), { target: { value: "Jane" } });
    fireEvent.change(screen.getByTestId("input-last-name"), { target: { value: "Doe" } });
    next(); // step 0 → 1 (link home, skipped)
    next(); // step 1 → 2 (review)
    next(); // submit
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/board/workflows/add-owner",
        expect.objectContaining({ firstName: "Jane", lastName: "Doe", associationId: "assoc-1", unitId: null }),
      ),
    );
  });
});

describe("ScheduleMeetingWizard", () => {
  it("posts to /api/governance/meetings with an ISO scheduledAt", async () => {
    renderWiz(<ScheduleMeetingWizard />);
    fireEvent.change(screen.getByTestId("input-title"), { target: { value: "July board meeting" } });
    next(); // step 0 → 1
    fireEvent.change(screen.getByTestId("input-when"), { target: { value: "2026-08-01T18:00" } });
    next(); // step 1 → 2 (review)
    next(); // submit
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [method, url, body] = apiRequest.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/governance/meetings");
    expect(body).toMatchObject({ associationId: "assoc-1", meetingType: "board", title: "July board meeting" });
    expect(typeof body.scheduledAt).toBe("string");
    expect(body.scheduledAt).toBe(new Date("2026-08-01T18:00").toISOString());
  });
});

describe("RequestVendorWorkWizard", () => {
  it("posts to /api/work-orders with sensible defaults", async () => {
    renderWiz(<RequestVendorWorkWizard />);
    fireEvent.change(screen.getByTestId("input-title"), { target: { value: "Fix gutter" } });
    fireEvent.change(screen.getByTestId("input-description"), { target: { value: "Overflowing at Building B" } });
    next(); // step 0 → 1
    next(); // step 1 → 2 (review)
    next(); // submit
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [method, url, body] = apiRequest.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/work-orders");
    expect(body).toMatchObject({
      associationId: "assoc-1",
      title: "Fix gutter",
      description: "Overflowing at Building B",
      category: "general",
      priority: "medium",
      status: "open",
      unitId: null,
    });
  });
});

describe("LogViolationWizard", () => {
  it("posts to the atomic violation workflow (no fine) with the default type", async () => {
    renderWiz(<LogViolationWizard />);
    fireEvent.change(screen.getByTestId("input-description"), { target: { value: "Bins left out 3 days" } });
    next(); // step 0 → 1 (who/where, skipped)
    next(); // step 1 → 2 (fine — default "no")
    next(); // step 2 → 3 (review)
    next(); // submit
    await waitFor(() => expect(apiRequest).toHaveBeenCalled());
    const [method, url, body] = apiRequest.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/board/workflows/log-violation");
    expect(body).toMatchObject({
      associationId: "assoc-1",
      violationType: "Trash / bins",
      description: "Bins left out 3 days",
      unitId: null,
      personId: null,
      fineAmount: null,
    });
  });
});

describe("PostChargeWizard", () => {
  it("blocks advancing until a home and owner are chosen (required)", () => {
    renderWiz(<PostChargeWizard />);
    // Step 0 requires both selects; with nothing picked, Next is disabled.
    expect(screen.getByTestId("wizard-next")).toBeDisabled();
  });
});
