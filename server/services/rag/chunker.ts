/**
 * RAG chunker (founder-os#1256, Phase 1).
 *
 * Splits a Document's content into overlapping chunks suitable for
 * embedding. Strategy:
 *   - Target chunk size: ~500 tokens. Tokens approximated as 4 chars per
 *     token (the conservative-but-fast rule of thumb the Anthropic +
 *     OpenAI docs both recommend for English-leaning prose).
 *   - Overlap: ~50 tokens (10%). Keeps cross-chunk references retrievable.
 *   - Boundary preference: paragraph (`\n\n`), then sentence (`.`, `!`, `?`,
 *     `\n`), then word. We never split mid-word.
 *
 * The function is pure + sync — no I/O — so it's trivially testable.
 *
 * Returned shape carries the start offset in the original content so the
 * citation layer can highlight in-page later.
 */

export interface RagChunk {
  /** 0-based position in the document's chunk sequence. */
  index: number;
  /** Chunk text content. */
  content: string;
  /** Character offset in the original document text. */
  charStart: number;
  /** Character offset (exclusive) end in the original document text. */
  charEnd: number;
  /** Approximate token count (chars / 4, rounded). */
  approxTokens: number;
}

export interface ChunkOptions {
  /** Target chunk size in approx tokens. Default 500. */
  targetTokens?: number;
  /** Overlap between adjacent chunks in approx tokens. Default 50. */
  overlapTokens?: number;
}

const CHARS_PER_TOKEN = 4;

export function chunkDocument(text: string, options: ChunkOptions = {}): RagChunk[] {
  const targetTokens = options.targetTokens ?? 500;
  const overlapTokens = options.overlapTokens ?? 50;
  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  // Short documents return as a single chunk.
  if (normalized.length <= targetChars) {
    return [
      {
        index: 0,
        content: normalized,
        charStart: 0,
        charEnd: normalized.length,
        approxTokens: Math.ceil(normalized.length / CHARS_PER_TOKEN),
      },
    ];
  }

  const chunks: RagChunk[] = [];
  let cursor = 0;
  let chunkIndex = 0;

  while (cursor < normalized.length) {
    const tentativeEnd = Math.min(cursor + targetChars, normalized.length);
    let end = tentativeEnd;

    // If we're not at the very end, try to find a clean boundary within the
    // last 20% of the chunk window so we don't split mid-thought.
    if (end < normalized.length) {
      const minBoundary = cursor + Math.floor(targetChars * 0.8);
      const slice = normalized.slice(minBoundary, tentativeEnd);

      // Prefer paragraph break, then sentence end, then any whitespace.
      const paraBreak = slice.lastIndexOf("\n\n");
      const sentenceBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
      const wordBreak = slice.lastIndexOf(" ");

      if (paraBreak !== -1) end = minBoundary + paraBreak + 2;
      else if (sentenceBreak !== -1) end = minBoundary + sentenceBreak + 2;
      else if (wordBreak !== -1) end = minBoundary + wordBreak + 1;
      // If none, fall back to the hard tentativeEnd.
    }

    const content = normalized.slice(cursor, end).trim();
    if (content.length > 0) {
      chunks.push({
        index: chunkIndex++,
        content,
        charStart: cursor,
        charEnd: end,
        approxTokens: Math.ceil(content.length / CHARS_PER_TOKEN),
      });
    }

    if (end >= normalized.length) break;
    cursor = Math.max(end - overlapChars, cursor + 1);
  }

  return chunks;
}
