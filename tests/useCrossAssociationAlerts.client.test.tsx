/**
 * 4.1 Wave 3 — useCrossAssociationAlerts hook tests.
 *
 * Covers the three Wave-3 acceptance gates for the client hook:
 *   1. Query fires with the correct GET URL (zone/limit/readState params).
 *   2. Polling cadence is exactly 120s (Q8 resolution).
 *   3. `markAsRead` and `dismiss` POST to the Wave-3 mutation endpoints
 *      with the correct URL (no body payload required).
 *
 * @vitest-environment jsdom
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  useCrossAssociationAlerts,
  CROSS_ASSOCIATION_POLL_INTERVAL_MS,
} from "../client/src/hooks/useCrossAssociationAlerts";

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("useCrossAssociationAlerts — polling cadence", () => {
  it("exports the exact 120_000 ms polling constant (Q8)", () => {
    expect(CROSS_ASSOCIATION_POLL_INTERVAL_MS).toBe(120_000);
  });
});

describe("useCrossAssociationAlerts — GET fires with correct URL params", () => {
  it("builds the URL with zone + limit + readState query parameters", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ alerts: [], readStateBy: {} }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(
      () => useCrossAssociationAlerts({ zone: "operations", limit: 10, readState: "unread" }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchSpy).toHaveBeenCalled();
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/api/alerts/cross-association");
    expect(url).toContain("zone=operations");
    expect(url).toContain("limit=10");
    expect(url).toContain("readState=unread");
  });

  it("omits the zone param when not provided but still sends limit + readState", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ alerts: [], readStateBy: {} }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useCrossAssociationAlerts({ limit: 50 }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).not.toContain("zone=");
    expect(url).toContain("limit=50");
    expect(url).toContain("readState=unread"); // default
  });

  it("exposes alerts and readStateBy from the server payload", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        alerts: [
          {
            alertId: "overdue-work-order:work_orders:wo-1",
            associationId: "assoc-1",
            associationName: "Harbor View HOA",
            zone: "operations",
            featureDomain: "operations.work-orders",
            ruleType: "overdue-work-order",
            recordType: "work_orders",
            recordId: "wo-1",
            severity: "high",
            title: "Overdue work order: Fix leak",
            description: "Scheduled for 2026-04-10 — 12 days overdue.",
            createdAt: new Date("2026-04-01T00:00:00Z").toISOString(),
            resolutionHref: "/app/operations/work-orders/wo-1",
            sourceRecord: null,
          },
        ],
        readStateBy: {},
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useCrossAssociationAlerts({ readState: "unread", limit: 10 }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].alertId).toBe("overdue-work-order:work_orders:wo-1");
  });
});

describe("useCrossAssociationAlerts — mutations", () => {
  it("markAsRead POSTs to /api/alerts/:alertId/read", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.startsWith("/api/alerts/cross-association")) {
        return Promise.resolve(jsonResponse({ alerts: [], readStateBy: {} }));
      }
      // Mutation response
      return Promise.resolve(jsonResponse({ alertId: "abc", readAt: new Date().toISOString() }));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useCrossAssociationAlerts({ readState: "unread", limit: 10 }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAsRead("overdue-work-order:work_orders:wo-1");
    });

    const mutationCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("/api/alerts/") && c[0].endsWith("/read"),
    );
    expect(mutationCall).toBeDefined();
    expect(mutationCall![0] as string).toBe(
      "/api/alerts/overdue-work-order%3Awork_orders%3Awo-1/read",
    );
    const init = mutationCall![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({}));
  });

  it("dismiss POSTs to /api/alerts/:alertId/dismiss", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (typeof url === "string" && url.startsWith("/api/alerts/cross-association")) {
        return Promise.resolve(jsonResponse({ alerts: [], readStateBy: {} }));
      }
      return Promise.resolve(jsonResponse({ alertId: "abc", dismissedAt: new Date().toISOString() }));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(
      () => useCrossAssociationAlerts({ readState: "unread", limit: 10 }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.dismiss("overdue-work-order:work_orders:wo-1");
    });

    const mutationCall = fetchSpy.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("/api/alerts/") && c[0].endsWith("/dismiss"),
    );
    expect(mutationCall).toBeDefined();
    expect(mutationCall![0] as string).toBe(
      "/api/alerts/overdue-work-order%3Awork_orders%3Awo-1/dismiss",
    );
    const init = mutationCall![1] as RequestInit;
    expect(init.method).toBe("POST");
  });
});
