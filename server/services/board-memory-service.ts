/**
 * Board-memory service — cross-board-cycle institutional memory (founder-os#9475).
 *
 * A queryable DECISION LOG that survives board turnover. A new treasurer /
 * secretary / president can ask "why was X decided?" or "what did the prior
 * <role> do about this owner / vendor / rule?" and get the prior decision, the
 * reasoning, the actor, the term, and the linked documents — even years and
 * multiple boards later.
 *
 *   READ-ONLY (L1) by design. Querying this memory NEVER actuates: this module
 *   exports NO approve/execute/actuate function. It only:
 *     - recordDecision()  — append an immutable decision to the log (populate),
 *     - queryDecisions()  — surface prior decisions with reasoning attached,
 *     - getDecision()     — one decision's full context + attachments,
 *     - getEntityHistory()— surface owner/vendor/rule/unit decision history.
 *   The log is immutable: no UPDATE / DELETE of a recorded decision (a decision
 *   is a historical FACT). "L1 read-only" == querying has zero side effect on
 *   the record-of-truth; recording is institutional logging, not actuation.
 *
 * Tenant isolation: every read/write is scoped by associationId derived from the
 * caller's session — never from the request body.
 *
 * Design note: the pure filter/rank helpers (`matchesSearch`, `filterBySearch`,
 * `rankDecisions`) carry the query logic and are exported for direct unit
 * testing; the DB operations compose them.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  boardDecisions,
  type BoardDecision,
  type BoardDecisionCategory,
} from "@shared/schema";

export class BoardMemoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = "BoardMemoryError";
  }
}

/**
 * The privilege level of every board-memory operation. Board memory only ever
 * SURFACES prior context — it never actuates — so it is inherently L1 in the
 * agent permission-ladder sense (advisory / read-only). Exported so callers /
 * tests can assert the read-only invariant.
 */
export const BOARD_MEMORY_LEVEL = "L1" as const;

// ── Pure query helpers (exported for unit testing) ───────────────────────────

/**
 * PURE free-text match. Returns true when `term` (case-insensitive) appears in
 * any of a decision's searchable fields: subject, decision, reasoning, actor
 * name, related-entity label, or any tag. An empty/undefined term matches all.
 */
export function matchesSearch(
  d: Pick<BoardDecision, "subject" | "decision" | "reasoning" | "actorName" | "relatedEntityLabel" | "tags">,
  term: string | undefined | null,
): boolean {
  const q = (term ?? "").trim().toLowerCase();
  if (!q) return true;
  const hay = [
    d.subject,
    d.decision,
    d.reasoning,
    d.actorName,
    d.relatedEntityLabel ?? "",
    ...(Array.isArray(d.tags) ? d.tags : []),
  ]
    .join("  ")
    .toLowerCase();
  return hay.includes(q);
}

/** PURE: filter a decision list by a free-text term (see `matchesSearch`). */
export function filterBySearch<T extends Parameters<typeof matchesSearch>[0]>(items: T[], term: string | undefined | null): T[] {
  return items.filter((d) => matchesSearch(d, term));
}

/**
 * PURE ranking. Most-recent decision first (decidedAt desc), tie-broken by
 * createdAt desc so the newest institutional record surfaces at the top.
 */
export function rankDecisions<T extends { decidedAt: Date; createdAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const d = b.decidedAt.getTime() - a.decidedAt.getTime();
    if (d !== 0) return d;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

// ── DB operations ────────────────────────────────────────────────────────────

export interface RecordDecisionInput {
  associationId: string;
  subject: string;
  decision: string;
  reasoning: string;
  category?: BoardDecisionCategory;
  actorType?: string;
  actorName: string;
  actorRole?: string | null;
  recordedByUserId?: string | null;
  boardTerm?: string | null;
  decidedAt?: Date | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityLabel?: string | null;
  sourceActionId?: string | null;
  attachments?: { name: string; url: string }[];
  tags?: string[];
}

/**
 * Append an immutable decision to the institutional-memory log. This is
 * institutional LOGGING (populating the memory), never actuation of any other
 * system. No update/delete path exists — a decision is a historical fact.
 */
export async function recordDecision(input: RecordDecisionInput): Promise<BoardDecision> {
  if (!input.associationId) throw new BoardMemoryError("associationId required", "VALIDATION");
  if (!input.subject || !input.subject.trim()) throw new BoardMemoryError("subject required", "VALIDATION");
  if (!input.decision || !input.decision.trim()) throw new BoardMemoryError("decision required", "VALIDATION");
  if (!input.reasoning || !input.reasoning.trim()) throw new BoardMemoryError("reasoning required", "VALIDATION");
  if (!input.actorName || !input.actorName.trim()) throw new BoardMemoryError("actorName required", "VALIDATION");

  const [created] = await db
    .insert(boardDecisions)
    .values({
      associationId: input.associationId,
      subject: input.subject.trim(),
      decision: input.decision.trim(),
      reasoning: input.reasoning.trim(),
      category: input.category ?? "general",
      actorType: input.actorType ?? "board",
      actorName: input.actorName.trim(),
      actorRole: input.actorRole ?? null,
      recordedByUserId: input.recordedByUserId ?? null,
      boardTerm: input.boardTerm ?? null,
      decidedAt: input.decidedAt ?? new Date(),
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      relatedEntityLabel: input.relatedEntityLabel ?? null,
      sourceActionId: input.sourceActionId ?? null,
      attachments: input.attachments ?? [],
      tags: input.tags ?? [],
    })
    .returning();
  return created;
}

export interface QueryDecisionsOptions {
  category?: BoardDecisionCategory;
  boardTerm?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  search?: string;
  limit?: number;
}

/**
 * Query the institutional memory. Tenant-scoped. Narrows on the indexed columns
 * (category / term / entity) in the DB, then applies the pure free-text filter
 * (subject / decision / reasoning / actor / label / tags) and recency ranking.
 * Every result carries its `reasoning` — the "why" is never dropped.
 */
export async function queryDecisions(associationId: string, opts: QueryDecisionsOptions = {}): Promise<BoardDecision[]> {
  if (!associationId) throw new BoardMemoryError("associationId required", "VALIDATION");
  const clauses = [eq(boardDecisions.associationId, associationId)];
  if (opts.category) clauses.push(eq(boardDecisions.category, opts.category));
  if (opts.boardTerm) clauses.push(eq(boardDecisions.boardTerm, opts.boardTerm));
  if (opts.relatedEntityType) clauses.push(eq(boardDecisions.relatedEntityType, opts.relatedEntityType));
  if (opts.relatedEntityId) clauses.push(eq(boardDecisions.relatedEntityId, opts.relatedEntityId));

  const rows = await db
    .select()
    .from(boardDecisions)
    .where(and(...clauses))
    .orderBy(desc(boardDecisions.decidedAt));

  const ranked = rankDecisions(filterBySearch(rows, opts.search));
  return typeof opts.limit === "number" && opts.limit > 0 ? ranked.slice(0, opts.limit) : ranked;
}

/** One decision's full context (scoped). */
export async function getDecision(decisionId: string, associationId: string): Promise<BoardDecision> {
  const [row] = await db
    .select()
    .from(boardDecisions)
    .where(and(eq(boardDecisions.id, decisionId), eq(boardDecisions.associationId, associationId)));
  if (!row) throw new BoardMemoryError("board decision not found", "NOT_FOUND", 404);
  return row;
}

/**
 * Surface the decision history for one entity — owner / vendor / rule / unit —
 * with the reasoning tied to each decision. This is the "what did the prior
 * <role> do about this owner/vendor?" lookup, most-recent first.
 */
export async function getEntityHistory(
  associationId: string,
  entityType: string,
  entityId: string,
  opts: { limit?: number } = {},
): Promise<BoardDecision[]> {
  if (!entityType) throw new BoardMemoryError("entityType required", "VALIDATION");
  if (!entityId) throw new BoardMemoryError("entityId required", "VALIDATION");
  return queryDecisions(associationId, {
    relatedEntityType: entityType,
    relatedEntityId: entityId,
    limit: opts.limit,
  });
}
