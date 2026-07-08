/**
 * draft-generator.ts — grounded owner-FAQ reply drafter (pure, DB-free).
 *
 * founder-os#9476. Given a classified inquiry + a normalized GroundingSnapshot
 * (the owner's REAL ledger/portal state, fetched by the storage adapter), it
 * composes a reply draft AND the explainability record (the exact source data
 * used + a human-readable "why"). Never fabricates a number — if the grounding
 * data is missing, it produces a safe "we're checking" draft flagged
 * needsData:true so the reviewer knows the agent couldn't ground it.
 *
 * Pure: takes data in, returns text out. The triage-service does the fetching.
 */

import type { InquiryCategory } from "./classifier";

/** Money is carried as integer cents everywhere (no float drift). */
export interface GroundingSnapshot {
  ownerName?: string;
  associationName?: string;
  unitLabel?: string; // e.g. "Unit 4B" / "CHC-0007"

  // balance
  balanceCents?: number; // positive = owed
  balanceAsOf?: string; // ISO date

  // payment-status
  lastPayment?: {
    amountCents: number;
    date: string; // ISO date
    status: string; // "posted" | "pending" | "failed" | ...
    method?: string;
  };

  // meeting-schedule
  nextMeeting?: {
    title: string;
    scheduledAt: string; // ISO datetime
    location?: string;
  };

  // document-request
  availableDocuments?: Array<{ title: string; category?: string }>;
}

export interface DraftResult {
  /** The reply body a reviewer approves before send. */
  draftText: string;
  /** Human-readable "why the agent drafted this" — surfaced in the queue. */
  reasoning: string;
  /** The exact source data the draft was grounded in (explainability). */
  sourceData: Record<string, unknown>;
  /** True when the agent could NOT ground the reply — reviewer must supply data. */
  needsData: boolean;
}

function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function prettyDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function prettyDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function greeting(g: GroundingSnapshot): string {
  return g.ownerName ? `Hi ${g.ownerName},` : "Hello,";
}

function signoff(g: GroundingSnapshot): string {
  const who = g.associationName ? `${g.associationName} management` : "your association's management";
  return `\n\nBest regards,\n${who}`;
}

/**
 * Compose a grounded draft for a classified inquiry. Deterministic + pure.
 */
export function generateDraft(category: InquiryCategory, g: GroundingSnapshot): DraftResult {
  const hi = greeting(g);
  const bye = signoff(g);
  const unit = g.unitLabel ? ` for ${g.unitLabel}` : "";

  switch (category) {
    case "balance": {
      if (g.balanceCents === undefined) {
        return {
          draftText: `${hi}\n\nThanks for reaching out. We're pulling up your account balance${unit} and will follow up shortly with the exact figure.${bye}`,
          reasoning: "Classified as a balance inquiry, but no ledger balance was available to ground the reply. Flagged for the reviewer to supply the balance before send.",
          sourceData: { category: "balance", balanceCents: null },
          needsData: true,
        };
      }
      const asOf = g.balanceAsOf ? ` (as of ${prettyDate(g.balanceAsOf)})` : "";
      const owed = g.balanceCents > 0;
      const body = owed
        ? `your current account balance${unit} is ${dollars(g.balanceCents)}${asOf}.`
        : g.balanceCents === 0
          ? `your account${unit} is paid in full — the current balance is $0.00${asOf}.`
          : `your account${unit} carries a credit of ${dollars(Math.abs(g.balanceCents))}${asOf}.`;
      return {
        draftText: `${hi}\n\nThanks for checking in — ${body} You can view the full ledger any time in the owner portal.${bye}`,
        reasoning: `Classified as a balance inquiry. Grounded in the unit ledger balance ${dollars(g.balanceCents)}${asOf}.`,
        sourceData: { category: "balance", balanceCents: g.balanceCents, balanceAsOf: g.balanceAsOf ?? null },
        needsData: false,
      };
    }

    case "payment-status": {
      if (!g.lastPayment) {
        return {
          draftText: `${hi}\n\nThanks for reaching out. We don't see a recent payment on the account${unit} yet — if you've sent one, it may still be processing. We'll confirm as soon as it posts.${bye}`,
          reasoning: "Classified as a payment-status inquiry; no recent payment record was found to ground the reply. Reviewer should confirm before send.",
          sourceData: { category: "payment-status", lastPayment: null },
          needsData: false,
        };
      }
      const p = g.lastPayment;
      const method = p.method ? ` via ${p.method}` : "";
      const statusPhrase =
        p.status === "posted"
          ? `posted successfully`
          : p.status === "pending"
            ? `received and is still processing`
            : p.status === "failed"
              ? `did not go through`
              : p.status;
      return {
        draftText: `${hi}\n\nYour payment of ${dollars(p.amountCents)}${method} on ${prettyDate(p.date)} has ${statusPhrase}. You can see it in the owner portal under payment history.${bye}`,
        reasoning: `Classified as a payment-status inquiry. Grounded in the most recent payment record: ${dollars(p.amountCents)} on ${p.date}, status "${p.status}".`,
        sourceData: { category: "payment-status", lastPayment: p },
        needsData: false,
      };
    }

    case "meeting-schedule": {
      if (!g.nextMeeting) {
        return {
          draftText: `${hi}\n\nThanks for asking. There isn't a meeting on the calendar at the moment — we'll notify all owners as soon as the next one is scheduled.${bye}`,
          reasoning: "Classified as a meeting-schedule inquiry; no upcoming meeting is scheduled to ground the reply.",
          sourceData: { category: "meeting-schedule", nextMeeting: null },
          needsData: false,
        };
      }
      const m = g.nextMeeting;
      const where = m.location ? ` at ${m.location}` : "";
      return {
        draftText: `${hi}\n\nThe next meeting is "${m.title}" on ${prettyDateTime(m.scheduledAt)}${where}. We hope to see you there.${bye}`,
        reasoning: `Classified as a meeting-schedule inquiry. Grounded in the next scheduled governance meeting: "${m.title}" at ${m.scheduledAt}.`,
        sourceData: { category: "meeting-schedule", nextMeeting: m },
        needsData: false,
      };
    }

    case "document-request": {
      const docs = g.availableDocuments ?? [];
      if (docs.length === 0) {
        return {
          draftText: `${hi}\n\nThanks for your request. We'll locate the document you're asking about and send it over shortly.${bye}`,
          reasoning: "Classified as a document request; no document catalog was available to ground the reply. Reviewer should attach or confirm the document.",
          sourceData: { category: "document-request", availableDocuments: [] },
          needsData: true,
        };
      }
      const list = docs.slice(0, 6).map((d) => `• ${d.title}`).join("\n");
      return {
        draftText: `${hi}\n\nHere are the association documents currently available in the owner portal:\n\n${list}\n\nLet us know which one you'd like and we'll make sure you have it.${bye}`,
        reasoning: `Classified as a document request. Grounded in the ${docs.length} document(s) available in the portal catalog.`,
        sourceData: { category: "document-request", availableDocuments: docs.slice(0, 6) },
        needsData: false,
      };
    }

    case "other":
    default: {
      return {
        draftText: `${hi}\n\nThanks for reaching out — we've received your message and a member of the management team will follow up with you personally.${bye}`,
        reasoning: "The inquiry did not confidently match a routine FAQ category, so it was routed to a human with a safe acknowledgment draft rather than an auto-grounded answer.",
        sourceData: { category: "other" },
        needsData: true,
      };
    }
  }
}
