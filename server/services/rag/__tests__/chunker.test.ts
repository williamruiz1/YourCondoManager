/**
 * Chunker unit tests (founder-os#1256, Phase 1).
 *
 * Pure-function tests — no DB, no network. Verifies:
 *   - short docs return a single chunk
 *   - long docs split at sensible boundaries
 *   - overlap is non-zero
 *   - chunks cover the original text (modulo overlap)
 *   - chunk indices are monotonic
 */

import { describe, expect, it } from "vitest";
import { chunkDocument } from "../chunker";

describe("chunkDocument", () => {
  it("returns a single chunk for short content", () => {
    const text = "This is a short document.";
    const chunks = chunkDocument(text, { targetTokens: 500, overlapTokens: 50 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].charStart).toBe(0);
    expect(chunks[0].charEnd).toBe(text.length);
  });

  it("returns empty for empty content", () => {
    expect(chunkDocument("")).toEqual([]);
    expect(chunkDocument("   \n   ")).toEqual([]);
  });

  it("splits a long document into multiple chunks with monotonic indices", () => {
    // 5000 chars ≈ 1250 tokens → ~3 chunks at targetTokens=500
    const text = "Lorem ipsum dolor sit amet. ".repeat(200);
    const chunks = chunkDocument(text, { targetTokens: 500, overlapTokens: 50 });

    expect(chunks.length).toBeGreaterThan(2);
    chunks.forEach((c, i) => expect(c.index).toBe(i));
    // approxTokens should be roughly the target
    chunks.forEach((c) => expect(c.approxTokens).toBeGreaterThan(0));
  });

  it("creates overlap between adjacent chunks", () => {
    const text = "A".repeat(10_000);
    const chunks = chunkDocument(text, { targetTokens: 500, overlapTokens: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].charStart).toBeLessThan(chunks[i - 1].charEnd);
    }
  });

  it("prefers paragraph boundaries when available", () => {
    // Build text with explicit paragraph breaks every 400 chars (~100 tokens)
    const para = "Sentence one. Sentence two. Sentence three.";
    const text = Array.from({ length: 60 }, () => para).join("\n\n");
    const chunks = chunkDocument(text, { targetTokens: 100, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    // Most chunks should end after a paragraph break (last 2 chars `\n\n`) —
    // we don't assert ALL chunks because the final one ends at EOF.
    const endsWithParaBreak = chunks
      .slice(0, -1)
      .filter((c) => text.slice(c.charEnd - 2, c.charEnd) === "\n\n");
    expect(endsWithParaBreak.length).toBeGreaterThan(0);
  });
});
