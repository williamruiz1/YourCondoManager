/**
 * RAG web-fetcher — the fetch→clean stage the ingester docstring flagged as
 * "a separate concern" (ingester.ts:12-14).
 *
 * Turns a URL into clean Markdown via the shared, SSRF-gated Crawl4AI engine
 * (`crawl-clean.sh`, an in-process Crawl4AI library run inside an isolated venv
 * — NO Docker server), then hands that Markdown to `ingestDocument()` so the
 * existing chunk → embed(voyage-3-lite, 1024-dim) → pgvector path runs unchanged.
 *
 * SECURITY:
 *   - Every fetch is gated by the shared resolve-then-pin SSRF guard BEFORE the
 *     crawl (internal/metadata/loopback/rebind refused, fail-closed). We never
 *     re-implement that check here — one guard, one behaviour.
 *   - Crawled content is UNTRUSTED (channel-of-origin). The helper tags it
 *     `trust_tier: "UNTRUSTED"`; we assert that tag survives to the caller so any
 *     downstream LLM step treats it as untrusted (prompt-injection discipline).
 *   - This is the INGESTION-side path (a batch/worker job on a box where the
 *     helper is installed), NOT the per-request web container. Configure the
 *     helper path with CRAWL_CLEAN_BIN if it is not at the default location.
 *
 * REVERSIBLE: additive module. Deleting this file removes the capability; the
 * existing ingester/embedder/retriever are untouched.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";
import { ingestDocument, type IngestResult } from "./ingester";

const execFileAsync = promisify(execFile);

/** Default location of the shared SSRF-gated crawl helper (cross-machine-synced). */
const DEFAULT_CRAWL_BIN = join(homedir(), ".local", "bin", "founder-os", "crawl-clean.sh");

export interface CleanPage {
  url: string;
  host: string | null;
  /** Channel-of-origin trust tier — always "UNTRUSTED" for crawled web content. */
  trustTier: "UNTRUSTED";
  title: string | null;
  markdown: string;
  chars: number;
  statusCode: number | null;
  fetchedAt: string;
}

interface CrawlCleanJson {
  schema: string;
  url: string;
  host: string | null;
  trust_tier: string;
  fetched_at: string;
  status_code: number | null;
  title: string | null;
  chars: number;
  markdown: string;
}

/**
 * Fetch a URL and return clean, UNTRUSTED-tagged Markdown via the shared engine.
 * Throws if the SSRF guard blocks the URL, the helper is missing, or the crawl
 * fails (fail-closed — no partial/garbage content is returned).
 */
export async function fetchCleanMarkdown(
  url: string,
  opts: { allowHosts?: string[]; timeoutSec?: number; maxChars?: number } = {},
): Promise<CleanPage> {
  const bin = process.env.CRAWL_CLEAN_BIN ?? DEFAULT_CRAWL_BIN;
  const args = [url, "--json"];
  if (opts.allowHosts && opts.allowHosts.length > 0) {
    args.push("--allow", opts.allowHosts.join(","));
  }
  if (opts.timeoutSec) args.push("--timeout", String(opts.timeoutSec));
  if (opts.maxChars) args.push("--max-chars", String(opts.maxChars));

  let stdout: string;
  try {
    const res = await execFileAsync(bin, args, {
      timeout: (opts.timeoutSec ?? 45) * 1000 + 15_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    stdout = res.stdout;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`web-fetcher: crawl-clean failed for ${url} (SSRF-blocked or crawl error): ${msg}`);
  }

  let parsed: CrawlCleanJson;
  try {
    parsed = JSON.parse(stdout) as CrawlCleanJson;
  } catch {
    throw new Error(`web-fetcher: could not parse crawl-clean output for ${url}`);
  }

  // Defence in depth: the content MUST arrive tagged UNTRUSTED.
  if (parsed.trust_tier !== "UNTRUSTED") {
    throw new Error(`web-fetcher: refusing content without UNTRUSTED tag for ${url}`);
  }
  if (!parsed.markdown || parsed.markdown.trim().length === 0) {
    throw new Error(`web-fetcher: empty clean Markdown for ${url}`);
  }

  return {
    url: parsed.url,
    host: parsed.host,
    trustTier: "UNTRUSTED",
    title: parsed.title,
    markdown: parsed.markdown,
    chars: parsed.chars,
    statusCode: parsed.status_code,
    fetchedAt: parsed.fetched_at,
  };
}

/**
 * End-to-end: fetch a URL → clean Markdown → ingest into the association's RAG
 * store (chunk → embed → pgvector). The caller supplies an existing `documentId`
 * (the FK/association-scoping row) exactly as `ingestDocument` requires.
 */
export async function ingestUrl(opts: {
  associationId: string;
  documentId: string;
  url: string;
  allowHosts?: string[];
  timeoutSec?: number;
  maxChars?: number;
}): Promise<IngestResult & { sourceUrl: string; trustTier: "UNTRUSTED"; fetchedChars: number }> {
  const page = await fetchCleanMarkdown(opts.url, {
    allowHosts: opts.allowHosts,
    timeoutSec: opts.timeoutSec,
    maxChars: opts.maxChars,
  });
  const result = await ingestDocument({
    associationId: opts.associationId,
    documentId: opts.documentId,
    content: page.markdown,
    metadata: {
      sourceUrl: page.url,
      sourceHost: page.host,
      sourceTitle: page.title,
      trustTier: page.trustTier, // UNTRUSTED provenance stamped on every chunk
      fetchedAt: page.fetchedAt,
    },
  });
  return { ...result, sourceUrl: page.url, trustTier: "UNTRUSTED", fetchedChars: page.chars };
}
