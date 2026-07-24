/**
 * grounding-adapter.ts — normalize the owner's REAL portal state into a
 * GroundingSnapshot (founder-os#9476).
 *
 * Storage-coupled; kept separate so triage-service.ts stays pure/injectable.
 * Only fetches what the classified category needs. Tenant-scoped: reads are
 * filtered to the caller's associationId + their own units (the CallerContext
 * is the authoritative scope — never trusts an inquiry-supplied id). A missing
 * datum leaves the field undefined → the draft generator flags needsData and
 * the item files as an L1 suggestion (safe: never fabricates, never auto-sends).
 */
import { storage } from "../../storage";
import { toCents } from "../ar-aging-math";
import type { GroundingSnapshot } from "./draft-generator";
import type { InquiryCategory } from "./classifier";
import type { TriageInput } from "./triage-service";

async function ownerAndUnit(input: TriageInput): Promise<Pick<GroundingSnapshot, "ownerName" | "associationName" | "unitLabel">> {
  const out: Pick<GroundingSnapshot, "ownerName" | "associationName" | "unitLabel"> = {};
  try {
    const persons = await storage.getPersons(input.associationId);
    const me = persons.find((p) => p.id === input.personId);
    if (me) out.ownerName = [me.firstName, me.lastName].filter(Boolean).join(" ") || undefined;
  } catch { /* leave undefined — draft greets generically */ }
  try {
    const unitId = input.unitIds[0];
    if (unitId) {
      const unit = await storage.getUnitById(unitId);
      if (unit) out.unitLabel = unit.unitAccountRef || (unit.unitNumber ? `Unit ${unit.unitNumber}` : undefined);
    }
  } catch { /* optional */ }
  return out;
}

/**
 * The production grounding function. Fetches only the category's data.
 */
export async function defaultGround(input: TriageInput, category: InquiryCategory): Promise<GroundingSnapshot> {
  const snap: GroundingSnapshot = await ownerAndUnit(input);
  const myUnits = new Set(input.unitIds);

  switch (category) {
    case "balance": {
      try {
        const summary = await storage.getOwnerLedgerSummary(input.associationId);
        // Unit is the balance-bearing entity — sum this owner's units.
        const rows = summary.filter((r) => myUnits.has(r.unitId));
        if (rows.length > 0) {
          const totalDollars = rows.reduce((sum, r) => sum + (r.balance ?? 0), 0);
          snap.balanceCents = toCents(totalDollars);
          snap.balanceAsOf = new Date().toISOString().slice(0, 10);
        }
      } catch { /* leave balance undefined → needsData */ }
      break;
    }
    case "payment-status": {
      try {
        const entries = await storage.getOwnerLedgerEntries(input.associationId);
        const payments = entries
          .filter((e) => myUnits.has(e.unitId) && e.entryType === "payment")
          .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
        const latest = payments[0];
        if (latest) {
          snap.lastPayment = {
            // payments are stored NEGATIVE (money received) → present the magnitude.
            amountCents: Math.abs(toCents(latest.amount)),
            date: new Date(latest.postedAt).toISOString().slice(0, 10),
            status: latest.settledAt ? "posted" : "pending",
          };
        }
      } catch { /* leave undefined */ }
      break;
    }
    case "meeting-schedule": {
      try {
        const meetings = await storage.getGovernanceMeetings(input.associationId);
        const now = Date.now();
        const upcoming = meetings
          .filter((m) => m.status === "scheduled" && new Date(m.scheduledAt).getTime() >= now)
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        const next = upcoming[0];
        if (next) {
          snap.nextMeeting = {
            title: next.title,
            scheduledAt: new Date(next.scheduledAt).toISOString(),
            location: next.location ?? undefined,
          };
        }
      } catch { /* leave undefined */ }
      break;
    }
    case "document-request": {
      try {
        const docs = await storage.getDocuments(input.associationId);
        snap.availableDocuments = docs.slice(0, 12).map((d) => ({ title: d.title }));
      } catch { /* leave undefined → needsData */ }
      break;
    }
    case "other":
    default:
      break;
  }
  return snap;
}
