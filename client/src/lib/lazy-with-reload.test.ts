/**
 * Stale-chunk guard (2026-06-30) — tests for the dynamic-import failure
 * detector that recovers the Expenses / Reports / Statements lazy routes from
 * the "Failed to fetch dynamically imported module" error after a deploy
 * renames content-hashed chunks (William findings #1 / #2 — stale cache).
 */
import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./lazy-with-reload";

describe("isChunkLoadError — cross-browser stale-chunk detection", () => {
  it("matches the exact Chrome error William hit", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Failed to fetch dynamically imported module: https://app.yourcondomanager.org/assets/financial-expenses-OLDHASH.js",
        ),
      ),
    ).toBe(true);
  });

  it("matches the Firefox / Safari variants", () => {
    expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("matches the SPA-index-served-for-missing-chunk MIME error", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Expected a JavaScript module script but the server responded with a MIME type of \"text/html\". 'text/html' is not a valid JavaScript MIME type.",
        ),
      ),
    ).toBe(true);
  });

  it("matches webpack-style ChunkLoadError text too", () => {
    expect(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 42 failed."))).toBe(true);
  });

  it("accepts a raw string message", () => {
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(true);
  });

  it("does NOT match a genuine application error (so the ErrorBoundary still shows it)", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'map')"))).toBe(
      false,
    );
    expect(isChunkLoadError(new Error("Network request failed: 500"))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError("")).toBe(false);
  });
});
